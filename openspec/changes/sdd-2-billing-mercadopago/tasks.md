# SDD 2 Tasks — Billing + MercadoPago MVP

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800–1,200 (schema ~150, Edge Functions ~300, frontend ~350, settings/legal/tests ~250) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: Schema/RLS → PR 2: Edge Functions → PR 3: Frontend gate → PR 4: Settings/legal/checklist |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

---

## PR Dependency Diagram

```text
main
 └─ PR 1 📍 DB billing schema + RLS + trial trigger + SQL tests
     └─ PR 2 Edge Functions (create/cancel/webhook) + env docs
         └─ PR 3 Frontend billing state + gate + tests
             └─ PR 4 Settings/legal/pricing alignment + webhook checklist
```

---

## Global Rules (All PRs)

1. **Strict TDD**: Every behavior change must show RED → GREEN → TRIANGULATE → REFACTOR evidence. Record test names and outputs in commit messages or PR description.
2. **No secrets in frontend**: `MERCADOPAGO_ACCESS_TOKEN`, webhook secret, and `SUPABASE_SERVICE_ROLE_KEY` must never appear in `VITE_*` env vars or client bundles.
3. **Tenant isolation**: Every new table gets `workshop_id uuid NOT NULL`, RLS enabled, and policies using `public.get_current_workshop_id()`.
4. **Feature-sliced**: All billing frontend code lives under `src/features/billing/`. Only generic utilities go to `src/shared/`.
5. **Type safety**: Update `src/shared/types/database.ts` manually; include `Relationships: []` for new tables.
6. **Rollback first**: Every PR lists its fast rollback step before implementation starts.

---

## Approval Gates

| Gate | Condition | PR Blocked Until |
|------|-----------|----------------|
| AG-1 | MercadoPago sandbox account ready with access token | PR 2 |
| AG-2 | Webhook signature/secret mechanism confirmed from MercadoPago docs | PR 2 |
| AG-3 | Supabase Function secrets can be set in staging | PR 2 |
| AG-4 | PR 1 schema verified in staging (trial trigger fires, RLS blocks cross-tenant) | PR 2 |
| AG-5 | PR 2 Edge Functions deploy and manual sandbox checklist passes | PR 3 |
| AG-6 | PR 3 frontend tests pass and gate blocks/unblocks correctly in staging | PR 4 |

---

## PR 1 — Database Schema, RLS, Trial Trigger, and SQL Tests

**Estimated changed lines**: 150–250
**Budget risk**: Medium
**Depends on**: SDD-1 complete (verified)
**Blocks**: PR 2, PR 3, PR 4

### Rollback (pre-production)
- Revert migration: `supabase migration revert 0022` or drop `subscriptions`/`billing_webhook_events` tables, indexes, trigger, and enum values.
- Revert `src/shared/types/database.ts` additions.

### Task 1.1 — Write failing SQL/RLS assertions (RED)
**Target files**:
- `supabase/migrations/0022_billing_schema.sql` (test-only section at top)

**Action**:
- Add `DO $$ BEGIN ... END $$` assertions that will fail before the schema exists:
  1. `assert_subscriptions_has_workshop_id` — fails if `information_schema.columns` does not show `workshop_id` on `subscriptions`.
  2. `assert_rls_enabled` — fails if `pg_class.relrowsecurity` is false for `subscriptions`.
  3. `assert_cross_tenant_select_blocked` — create two test roles/workshops, insert rows, assert role A cannot see role B’s row.
  4. `assert_direct_insert_denied` — assert authenticated role cannot `INSERT` into `subscriptions` for another `workshop_id`.
  5. `assert_trial_trigger_fires` — update `profiles.onboarded_at`, assert `subscriptions` row created with `status = 'trialing'`.
  6. `assert_trial_trigger_idempotent` — re-update same `onboarded_at`, assert no duplicate row and dates unchanged.

**TDD evidence required**: `git diff` showing assertions that fail when run against current DB.
**Verification**: `supabase db reset && supabase migration up` → expect failure.

### Task 1.2 — Implement schema migration (GREEN)
**Target file**: `supabase/migrations/0022_billing_schema.sql`

**Action**:
- Create `subscription_status` enum: `trialing`, `active`, `past_due`, `unpaid`, `cancelled`.
- Create `subscriptions` table with all columns from spec/design:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE`
  - `status text NOT NULL` (use enum or CHECK constraint)
  - `plan text NOT NULL DEFAULT 'pro_monthly'`
  - `provider text NOT NULL DEFAULT 'mercadopago'`
  - `trial_starts_at timestamptz`
  - `trial_ends_at timestamptz`
  - `current_period_starts_at timestamptz`
  - `current_period_ends_at timestamptz`
  - `provider_subscription_id text`
  - `provider_preapproval_id text`
  - `provider_status text`
  - `cancel_at_period_end boolean NOT NULL DEFAULT false`
  - `cancelled_at timestamptz`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
- Indexes:
  - `CREATE UNIQUE INDEX subscriptions_one_per_workshop ON public.subscriptions(workshop_id);`
  - `CREATE INDEX subscriptions_workshop_id_idx ON public.subscriptions(workshop_id);`
  - `CREATE UNIQUE INDEX subscriptions_provider_preapproval_id_idx ON public.subscriptions(provider_preapproval_id) WHERE provider_preapproval_id IS NOT NULL;`
- Enable RLS.
- RLS policies:
  - `subscriptions_select_own`: `FOR SELECT TO authenticated USING (workshop_id = public.get_current_workshop_id())`.
  - No INSERT/UPDATE/DELETE policies for authenticated role (service role only).
- Trigger on `public.profiles` after update of `onboarded_at`:
  - When `OLD.onboarded_at IS NULL AND NEW.onboarded_at IS NOT NULL`.
  - Insert into `subscriptions` with `status = 'trialing'`, `trial_starts_at = now()`, `trial_ends_at = now() + interval '14 days'`, `plan = 'pro_monthly'`, `provider = 'mercadopago'`.
  - Use `ON CONFLICT (workshop_id) DO NOTHING` for idempotency.
- `updated_at` trigger using existing project pattern or `moddatetime` extension.
- Create `billing_webhook_events` table:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `provider text NOT NULL DEFAULT 'mercadopago'`
  - `provider_event_id text NOT NULL`
  - `event_type text NOT NULL`
  - `provider_resource_id text`
  - `workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE`
  - `processed_at timestamptz NOT NULL DEFAULT now()`
  - `payload jsonb NOT NULL DEFAULT '{}'`
  - Unique `(provider, provider_event_id)`
  - RLS enabled; no authenticated SELECT/INSERT/UPDATE/DELETE policies (service role only).
- Keep assertions from Task 1.1 at bottom of migration so they pass after schema creation.

**TDD evidence required**: Run migration; all assertions pass.
**Verification commands**:
```bash
supabase db reset
supabase migration up
# Check assertions output
```

### Task 1.3 — SQL tests triangulate edge cases (TRIANGULATE)
**Target file**: `supabase/migrations/0022_billing_schema.sql` or separate `0022_billing_schema_tests.sql`

**Action**:
- Add assertion: workshop A can SELECT its own subscription row.
- Add assertion: workshop A with `status = 'trialing'` and `trial_ends_at` in past is still SELECTable (gate logic is frontend/edge, not RLS).
- Add assertion: trigger does NOT fire when `onboarded_at` changes from non-NULL to another non-NULL value.
- Add assertion: `billing_webhook_events` unique constraint prevents duplicate `provider_event_id`.

**TDD evidence required**: All assertions pass after schema implementation.

### Task 1.4 — Refactor and update TypeScript types (REFACTOR)
**Target file**: `src/shared/types/database.ts`

**Action**:
- Add `subscriptions` and `billing_webhook_events` to `Database['public']['Tables']`.
- Include `Relationships: []` for both (no FK relationships exposed in the type unless desired).
- Verify `npm test` still passes (no TypeScript regressions).
- Refactor migration for readability: group related DDL (table, indexes, RLS, trigger) with clear comments.

**Verification commands**:
```bash
npm test
npm run lint
npm run build
```

### PR 1 Checklist
- [ ] Task 1.1 RED: failing SQL assertions committed.
- [ ] Task 1.2 GREEN: migration passes all assertions.
- [ ] Task 1.3 TRIANGULATE: edge-case assertions added and passing.
- [ ] Task 1.4 REFACTOR: types updated, lint/build/test pass.
- [ ] `workshop_id uuid NOT NULL` present on both tables.
- [ ] RLS enabled on both tables.
- [ ] No authenticated INSERT/UPDATE/DELETE on subscriptions.
- [ ] Trial trigger is idempotent.
- [ ] Approval Gate AG-4 passed in staging.

---

## PR 2 — Supabase Edge Functions: Create, Cancel, Webhook

**Estimated changed lines**: 250–400
**Budget risk**: Medium/High
**Depends on**: PR 1 (schema deployed and verified)
**Blocks**: PR 3, PR 4

### Rollback
- Remove function secrets from Supabase dashboard.
- Disable or delete Edge Function routes in Supabase dashboard.
- App continues to work in trial-only mode; no billing gate active yet.

### Task 2.1 — Write shared Edge Function utilities with pure-helper tests (RED)
**Target files**:
- `supabase/functions/_shared/auth.ts`
- `supabase/functions/_shared/mercadopago.ts`
- `supabase/functions/_shared/billing.ts`
- `supabase/functions/_shared/response.ts`
- `tests/supabase/functions/billingHelpers.test.ts` (pure helpers only)

**Action**:
- `auth.ts`: Parse `Authorization` header, create Supabase service client, verify JWT, load profile/workshop_id. Return typed `{ user, workshopId }` or throw 401.
- `mercadopago.ts`: Configurable base URL, request helper with `MERCADOPAGO_ACCESS_TOKEN` from Deno env. Functions: `createPreapproval(workshopId, plan, returnUrl)`, `getPreapproval(id)`, `cancelPreapproval(id)`.
- `billing.ts`: Pure mapping functions (testable without Deno runtime):
  - `mapMercadoPagoStatusToAppStatus(providerStatus: string): SubscriptionStatus`
  - `calculateNextPeriodDates(startDate: Date): { starts: Date; ends: Date }`
  - `isValidSignature(payload: string, signature: string, secret: string): boolean` (placeholder until exact MercadoPago algorithm confirmed).
- `response.ts`: Standard JSON response helpers with CORS.
- Write Vitest unit tests for `billing.ts` pure functions only (RED: tests fail because functions are stubbed).

**TDD evidence required**: Commit failing pure-helper tests.
**Verification**: `npm test -- tests/supabase/functions/billingHelpers.test.ts` → RED.

### Task 2.2 — Implement create-subscription Edge Function (GREEN)
**Target file**: `supabase/functions/create-subscription/index.ts`

**Action**:
- `POST /functions/v1/create-subscription`.
- Parse auth header → verify JWT → derive `workshop_id` from `profiles` via service client.
- Load existing `subscriptions` row for workshop.
- If already `active` with a valid `provider_preapproval_id`, return existing state (idempotent).
- Call MercadoPago preapproval API:
  - `auto_recurring`: frequency `monthly`, frequency_type `months`, transaction_amount `4990.00`, currency_id `ARS`.
  - `external_reference`: subscription ID or workshop ID.
  - `back_url`: app billing settings URL.
  - `status`: `pending` initially.
- On success: update `subscriptions` row with `provider_preapproval_id`, `provider_status`, `status` (if payment captured immediately → `active`, else stays `trialing` or transitions as appropriate).
- Return `{ initPoint, preapprovalId, status }` to frontend.
- On failure: log error without token payload, return 500/502 with safe message.

**TDD evidence required**: Unit test or manual local invocation with mocked MercadoPago API.
**Verification**: Deploy to staging; invoke with curl and valid JWT.

### Task 2.3 — Implement cancel-subscription Edge Function (GREEN)
**Target file**: `supabase/functions/cancel-subscription/index.ts`

**Action**:
- `POST /functions/v1/cancel-subscription`.
- Verify JWT → derive `workshop_id`.
- Load subscription row; require `provider_preapproval_id`.
- Attempt period-end cancellation via MercadoPago API if supported:
  - If supported: call provider cancel-at-period-end, set `cancel_at_period_end = true`.
  - If not supported: call provider immediate cancel, set `status = 'cancelled'`, `cancelled_at = now()`.
- Return updated subscription state.

**TDD evidence required**: Manual curl test in staging with mocked/sandbox provider.

### Task 2.4 — Implement mercadopago-webhook Edge Function (GREEN)
**Target file**: `supabase/functions/mercadopago-webhook/index.ts`

**Action**:
- `POST /functions/v1/mercadopago-webhook`.
- Read raw body before JSON parsing for signature verification.
- Verify signature using `MERCADOPAGO_WEBHOOK_SECRET` / signature material (exact algorithm from MercadoPago docs).
- Reject invalid signatures with HTTP 401/403.
- Parse payload; extract event type, provider event ID, and resource ID.
- Fetch current preapproval/payment state from MercadoPago API (do not trust payload alone).
- Find `subscriptions` row by `provider_preapproval_id`.
- If no row found: log anomaly, return HTTP 200 (prevent retry storms).
- Deduplicate: check `billing_webhook_events` for `(provider, provider_event_id)`. If exists, return 200.
- Insert into `billing_webhook_events` with resolved `workshop_id`.
- Map provider state to app status; update `subscriptions`:
  - `authorized` / `active` charge → `status = 'active'`
  - `pending` → keep current or `trialing` if within trial
  - `paused` / `rejected` / `failure` → `status = 'past_due'` or `unpaid`
  - `cancelled` → `status = 'cancelled'`
- Update `current_period_starts_at`, `current_period_ends_at`, `provider_status`.
- Return HTTP 200.

**TDD evidence required**: Manual sandbox checklist (see Task 2.6). Pure `mapMercadoPagoStatusToAppStatus` tests from Task 2.1 must pass.

### Task 2.5 — Triangulate webhook edge cases (TRIANGULATE)
**Target files**:
- `supabase/functions/mercadopago-webhook/index.ts`
- `tests/supabase/functions/billingHelpers.test.ts`

**Action**:
- Add pure tests for:
  - Duplicate event ID returns 200 without DB mutation.
  - Stale provider state (older than recorded) is ignored.
  - Unknown `provider_preapproval_id` returns 200 without mutation.
  - Invalid signature returns 401/403.
- If local Deno testing is available, add integration test for webhook handler with mocked MercadoPago fetch.

**TDD evidence required**: Tests pass.

### Task 2.6 — Document env vars and manual webhook checklist (REFACTOR)
**Target files**:
- `.env.example`
- `docs/mercadopago-webhook-checklist.md` (new)

**Action**:
- `.env.example` add:
  ```
  MERCADOPAGO_ACCESS_TOKEN=mp_access_token
  MERCADOPAGO_WEBHOOK_SECRET=webhook_secret_or_signature_material
  SUPABASE_SERVICE_ROLE_KEY=service_role_key_for_edge_functions
  ```
  - Do NOT add `VITE_MERCADOPAGO_PUBLIC_KEY` unless frontend SDK initialization absolutely requires it; if so, it must be the public key only.
- Document Supabase Function secrets deployment command.
- Create manual webhook checklist:
  1. Configure MercadoPago sandbox webhook URL to staging function.
  2. Trigger test event from MercadoPago dashboard; verify function logs show receipt.
  3. Send payload with invalid signature; verify HTTP 401/403 and no DB change.
  4. Send valid payload for `preapproval.updated`; verify `billing_webhook_events` insert and `subscriptions` status update.
  5. Send duplicate event ID; verify HTTP 200 and no double update.
  6. Simulate rejected payment event; verify `status` becomes `unpaid`.
  7. Verify cross-tenant safety: event for unknown `provider_preapproval_id` returns 200 without touching other rows.

**Verification**: Checklist executed in staging; results recorded in PR description.

### PR 2 Checklist
- [ ] Task 2.1 RED: pure helper tests committed and failing.
- [ ] Task 2.2 GREEN: create-subscription deploys and creates provider preapproval.
- [ ] Task 2.3 GREEN: cancel-subscription deploys and updates state.
- [ ] Task 2.4 GREEN: webhook function verifies signatures, handles dedup, updates state.
- [ ] Task 2.5 TRIANGULATE: edge-case tests added and passing.
- [ ] Task 2.6 REFACTOR: env docs complete, manual checklist created and executed.
- [ ] No `MERCADOPAGO_ACCESS_TOKEN` in frontend bundle (verify with `grep` on `dist/`).
- [ ] Approval Gates AG-1, AG-2, AG-3, AG-5 passed.

---

## PR 3 — Frontend Billing State, Gate, and Tests

**Estimated changed lines**: 300–450
**Budget risk**: Medium/High
**Depends on**: PR 1 (schema), PR 2 (Edge Functions deployed)
**Blocks**: PR 4

### Rollback
- Remove `BillingGate` from `AppLayout`; restore pre-PR `AppLayout.tsx`.
- Remove `src/features/billing/` directory.
- App returns to auth/onboarding-only gating; billing records remain in DB for audit.

### Task 3.1 — Write pure access logic tests (RED)
**Target files**:
- `src/features/billing/lib/access.ts`
- `src/features/billing/lib/access.test.ts`

**Action**:
- Create `access.ts` with pure functions:
  ```ts
  export function getBillingAccess(
    subscription: Subscription | null | undefined,
    now: Date
  ): 'allowed' | 'blocked' | 'loading';
  export function isTrialActive(subscription: Subscription, now: Date): boolean;
  export function formatBillingStatus(subscription: Subscription): string;
  ```
- Write failing tests for:
  - `null`/`undefined` subscription → `'loading'` (fail-closed; gate waits).
  - `status = 'active'` → `'allowed'`.
  - `status = 'trialing'`, `trial_ends_at` in future → `'allowed'`.
  - `status = 'trialing'`, `trial_ends_at` in past (even 1 second) → `'blocked'`.
  - `status = 'past_due'` → `'blocked'`.
  - `status = 'unpaid'` → `'blocked'`.
  - `status = 'cancelled'` → `'blocked'`.
  - `cancel_at_period_end = true`, `current_period_ends_at` in future → `'allowed'`.
  - `cancel_at_period_end = true`, `current_period_ends_at` in past → `'blocked'`.

**TDD evidence required**: Commit failing tests.
**Verification**: `npm test -- src/features/billing/lib/access.test.ts` → RED.

### Task 3.2 — Implement billing API and hooks (GREEN)
**Target files**:
- `src/features/billing/api/subscriptions.ts`
- `src/features/billing/hooks/useSubscription.ts`
- `src/features/billing/hooks/useBillingActions.ts`
- `src/features/billing/types.ts`

**Action**:
- `types.ts`: Define `BillingAccess`, `SubscriptionStatus`, `Subscription` (from DB type or local refinement).
- `api/subscriptions.ts`:
  - `fetchSubscription(workshopId: string)` → typed Supabase select from `subscriptions`.
  - `invokeCreateSubscription()` → `supabase.functions.invoke('create-subscription')`.
  - `invokeCancelSubscription()` → `supabase.functions.invoke('cancel-subscription')`.
- `hooks/useSubscription.ts`: TanStack Query wrapper with key `['subscription', workshopId]`, enabled when `workshopId && onboardedAt`.
- `hooks/useBillingActions.ts`: Mutations for create/cancel with toast success/error and query invalidation.

**TDD evidence required**: Hook tests using `renderHook` + `waitFor` with mocked Supabase client.
**Verification**: `npm test -- src/features/billing/hooks/useSubscription.test.ts` → GREEN.

### Task 3.3 — Implement billing gate and blocked screen (GREEN)
**Target files**:
- `src/features/billing/components/BillingGate.tsx`
- `src/features/billing/components/BillingBlockedScreen.tsx`
- `src/features/billing/components/BillingBlockedScreen.test.tsx`

**Action**:
- `BillingGate.tsx`:
  - Accepts `subscription` and `children`.
  - Uses `getBillingAccess(subscription, new Date())`.
  - `'loading'` → render skeleton/loader.
  - `'allowed'` → render `children`.
  - `'blocked'` → render `<BillingBlockedScreen />`.
- `BillingBlockedScreen.tsx`:
  - Show subscription status (trial expired, payment failed, etc.).
  - Primary action: "Suscribirse" or "Actualizar pago" depending on state.
  - Secondary actions: logout, link to support WhatsApp.
  - Must NOT render any app nav, business data, or route outlets.
  - Must be responsive (mobile + desktop).
- Write component tests:
  - Render `BillingBlockedScreen`; assert no nav items, no business data.
  - Assert primary action button and logout link are present.
  - Assert correct status text for each blocked reason.

**TDD evidence required**: Component tests pass.
**Verification**: `npm test -- src/features/billing/components/BillingBlockedScreen.test.tsx` → GREEN.

### Task 3.4 — Integrate gate into AppLayout (GREEN)
**Target file**: `src/app/layouts/AppLayout.tsx`

**Action**:
- Import `useSubscription` and `BillingGate`.
- After `onboardedAt` check, fetch subscription state.
- While subscription query is loading, show loading spinner (same as auth loading).
- Wrap the normal layout shell with `<BillingGate>` so blocked users see `BillingBlockedScreen` instead of sidebar/nav/outlet.
- Allow `/settings` and `/profile` routes when blocked? **Decision**: No. Blocked UX is billing-only access plus logout/support. The blocked screen itself can offer a link to settings billing section, but app routes must redirect/remain blocked.
- Ensure wizard paths (`/quotes/:id`) are also gated (they render outside the normal shell but should still check billing status or be unreachable when blocked).
- Add minimal `AppLayout.test.tsx` or extend existing tests:
  - Mock `useAuth` (authenticated, onboarded) + mock `useSubscription` returning active → assert normal layout renders.
  - Mock `useSubscription` returning past_due → assert blocked screen renders.

**TDD evidence required**: `AppLayout` integration tests pass.
**Verification**: `npm test -- src/app/layouts/AppLayout.test.tsx` → GREEN.

### Task 3.5 — Triangulate gate edge cases (TRIANGULATE)
**Target files**:
- `src/features/billing/lib/access.test.ts`
- `src/features/billing/components/BillingBlockedScreen.test.tsx`
- `src/app/layouts/AppLayout.test.tsx`

**Action**:
- Add test: subscription query error → gate should treat as `'blocked'` (fail-closed).
- Add test: user manually navigates to `/quotes/123` while blocked → redirect or blocked screen.
- Add test: `cancel_at_period_end = true` with period still active → allowed.
- Add test: `cancel_at_period_end = true` with period ended → blocked.
- Add test: trial ends exactly at current second → blocked (strictly greater than).

**TDD evidence required**: All new tests pass.

### Task 3.6 — Refactor and verify build (REFACTOR)
**Action**:
- Extract any duplicated loading skeleton into shared component if not already shared.
- Ensure `BillingGate` does not cause extra re-renders (memoize `access` result if needed).
- Verify no cross-feature imports from billing into non-billing features (except app shell).
- Run full verification suite.

**Verification commands**:
```bash
npm test
npm run lint
npm run build
```

### PR 3 Checklist
- [ ] Task 3.1 RED: access logic tests committed and failing.
- [ ] Task 3.2 GREEN: API/hooks implemented and tested.
- [ ] Task 3.3 GREEN: gate and blocked screen implemented and tested.
- [ ] Task 3.4 GREEN: AppLayout integration complete and tested.
- [ ] Task 3.5 TRIANGULATE: edge-case tests added and passing.
- [ ] Task 3.6 REFACTOR: build/lint/test pass, no cross-feature violations.
- [ ] Approval Gate AG-6 passed in staging.

---

## PR 4 — Settings Billing, Legal/ Pricing Alignment, and Final Checklist

**Estimated changed lines**: 200–350
**Budget risk**: Medium
**Depends on**: PR 3 (frontend gate active)
**Blocks**: None (last in chain)

### Rollback
- Revert `WorkshopSettings.tsx` to pre-billing version.
- Revert legal/pricing copy if needed.
- Keep backend billing data and gate intact.

### Task 4.1 — Write settings billing card tests (RED)
**Target files**:
- `src/features/billing/components/BillingSettingsCard.tsx`
- `src/features/billing/components/BillingSettingsCard.test.tsx`

**Action**:
- Write failing tests for:
  - `status = 'trialing'` → shows trial end date, "Empezar suscripción" button.
  - `status = 'active'` → shows period dates, next charge ARS 4,990, "Cancelar" button.
  - `status = 'past_due'` / `'unpaid'` → shows payment required message, "Actualizar pago" button.
  - `cancel_at_period_end = true` → shows "Cancelación programada" with final access date.
  - Clicking start/cancel triggers correct mutation.

**TDD evidence required**: Commit failing tests.
**Verification**: `npm test -- src/features/billing/components/BillingSettingsCard.test.tsx` → RED.

### Task 4.2 — Implement BillingSettingsCard (GREEN)
**Target file**: `src/features/billing/components/BillingSettingsCard.tsx`

**Action**:
- Accept `subscription` prop; use `useBillingActions` for mutations.
- Render status-specific UI with clear calls to action.
- Price display: ARS 4,990/mes (from constant, not hard-coded string duplication).
- For active subscriptions: show cancel button; on click, confirm dialog, then call cancel mutation.
- For trial: show start-subscription button linking to MercadoPago flow (via `invokeCreateSubscription` + redirect).
- For blocked: show fix-payment button.
- Use existing Card/CardHeader/CardContent/CardTitle/Label/Button components.

**TDD evidence required**: Tests pass after implementation.

### Task 4.3 — Integrate billing card into settings (GREEN)
**Target file**: `src/features/settings/components/WorkshopSettings.tsx`

**Action**:
- Import `BillingSettingsCard` and `useSubscription`.
- Add billing section near the top of settings (above workshop details).
- Pass subscription data to card.
- Ensure blocked users can still reach settings billing section if they navigate there from blocked screen, but other workshop data should be hidden/minimized when subscription is blocked. **Decision**: The blocked screen is the primary gate; settings page remains accessible but billing card is the dominant content. Alternatively, the blocked screen itself renders the billing card. Keep it simple: blocked screen renders `BillingSettingsCard` directly.

**TDD evidence required**: Settings component tests or manual verification.

### Task 4.4 — Align legal and pricing copy (GREEN)
**Target files**:
- `src/features/landing/data/pricing.ts`
- `src/features/landing/components/ROICalculatorSection.tsx`
- `src/features/legal/pages/TermsPage.tsx`
- `src/features/legal/pages/PrivacyPage.tsx`

**Action**:
- `pricing.ts`: Ensure ARS 4,990/mes and 14-day trial copy are accurate. No semantic changes needed if already aligned.
- `ROICalculatorSection.tsx`: Ensure `SUBSCRIPTION_PRICE = 4_990` constant is used consistently; do not duplicate magic number.
- `TermsPage.tsx`: Update text to state:
  - Trial begins upon onboarding completion (not signup).
  - Immediate block at trial end (no grace period).
  - Cancellation via Settings billing section or MercadoPago dashboard.
  - Period-end cancellation when provider supports it.
- `PrivacyPage.tsx`: Confirm MercadoPago is listed as payment processor and subscription data is described accurately.

**Verification**: Read each page; confirm copy matches implemented behavior.

### Task 4.5 — Triangulate settings and legal edge cases (TRIANGULATE)
**Target files**:
- `src/features/billing/components/BillingSettingsCard.test.tsx`

**Action**:
- Add test: mutation loading state shows spinner/disabled button.
- Add test: mutation error shows toast/error message in card.
- Add test: legal terms render without throwing; snapshot if useful.

**TDD evidence required**: Tests pass.

### Task 4.6 — Final verification and checklist (REFACTOR)
**Action**:
- Run full test suite: `npm test`.
- Run lint: `npm run lint`.
- Run build: `npm run build`.
- Execute manual MercadoPago sandbox checklist from PR 2 in staging:
  1. New onboarding creates trial (14 days).
  2. Start subscription redirects to MercadoPago.
  3. Successful webhook updates subscription to `active`.
  4. Simulated rejected payment updates subscription to `unpaid`.
  5. Past-due workshop is blocked from app; sees billing screen.
  6. Cancellation sets `cancel_at_period_end` or immediate `cancelled`.
  7. Cancelled workshop is blocked.
  8. Cross-tenant: user A cannot see/update user B subscription.
- Record checklist results in PR description.
- Update `openspec/config.yaml` `sdd_packages` status for `sdd-2` to `ready_to_verify` or `complete`.

**Verification commands**:
```bash
npm test
npm run lint
npm run build
# Manual sandbox checklist (see docs/mercadopago-webhook-checklist.md)
```

### PR 4 Checklist
- [ ] Task 4.1 RED: settings card tests committed and failing.
- [ ] Task 4.2 GREEN: `BillingSettingsCard` implemented and tested.
- [ ] Task 4.3 GREEN: settings integration complete.
- [ ] Task 4.4 GREEN: legal/pricing copy aligned with implementation.
- [ ] Task 4.5 TRIANGULATE: loading/error/snapshot tests added.
- [ ] Task 4.6 REFACTOR: full suite passes, manual checklist executed, sdd-2 status updated.

---

## Cross-Cutting Verification Commands

Run these after every PR before requesting review:

```bash
# TypeScript / build
npm run build

# Lint
npm run lint

# Unit tests
npm test

# SQL assertions (PR 1 only)
supabase db reset && supabase migration up

# Secret exposure audit (PR 2+ only)
grep -r "MERCADOPAGO_ACCESS_TOKEN\|SERVICE_ROLE_KEY" dist/ 2>/dev/null || echo "No secrets in bundle"
```

---

## Rollback Summary (All PRs)

| Scenario | Action | Scope |
|----------|--------|-------|
| Billing gate blocks legitimate users | Revert `AppLayout.tsx` to remove `BillingGate` | PR 3 rollback |
| MercadoPago integration fails | Disable Edge Function secrets/routes | PR 2 rollback |
| Schema needs undo pre-production | `supabase migration revert 0022` | PR 1 rollback |
| Schema needs undo post-production | Add corrective migration disabling trigger/gate; preserve rows | PR 1 soft rollback |
| Legal copy misaligned | Revert `TermsPage.tsx` / `PrivacyPage.tsx` | PR 4 rollback |
| Full billing feature cancellation | Revert PRs 4 → 3 → 2 → 1 in order | Full rollback |

---

## Risk Register

| Risk | Mitigation | Owner |
|------|-----------|-------|
| MercadoPago webhook signature algorithm changes or is undocumented | Confirm exact mechanism before PR 2 apply; fallback to payload inspection + provider fetch if verification unavailable | PR 2 assignee |
| Edge Function local testing unavailable | Keep business logic in pure helpers under `tests/`; rely on mandatory sandbox checklist | PR 2 assignee |
| Billing gate fail-open on subscription query error | Explicitly map query errors to `'blocked'` in `getBillingAccess` | PR 3 assignee |
| Legal copy remains ahead of implementation | PR 4 includes legal review task; terms must mention onboarding-completed trial start | PR 4 assignee |
| Review budget exceeded in any PR | Split the offending PR before apply; do not submit >400 changed lines without size exception | All assignees |
| Currency or price changes post-launch | Store price in `subscriptions.plan` metadata; do not hard-code in multiple places | PR 4 assignee |

---

## Next Recommended Phase

`sdd-apply` — begin with PR 1 (schema/RLS/trial trigger) after confirming approval gates are satisfied. Do not start PR 2 until PR 1 is merged and AG-4 is passed.
