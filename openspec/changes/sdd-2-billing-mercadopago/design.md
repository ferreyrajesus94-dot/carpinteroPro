# SDD 2 Design — Billing + MercadoPago MVP

## Status

`design_complete`

## Executive Summary

Design an MVP billing system for CarpinteroPro: Supabase/Postgres billing schema, Supabase Edge Functions for MercadoPago preapproval creation and webhooks, and React app billing gates/settings UI. The system remains workshop-scoped, uses the SDD-1 trusted `auth.uid() -> profiles.workshop_id` resolver, starts a 14-day trial when onboarding completes, and blocks full app access immediately when the trial is expired or payment is unpaid/past-due. Implementation is expected to exceed the 400 changed-line review budget, so apply should use stacked PRs/work-unit commits.

## Inputs Read

- `openspec/config.yaml`
- `docs/production-sdd-roadmap.md`
- `openspec/changes/sdd-2-billing-mercadopago/explore.md`
- `openspec/changes/sdd-2-billing-mercadopago/proposal.md`
- `openspec/changes/sdd-2-billing-mercadopago/spec.md`
- Relevant code: `src/app/layouts/AppLayout.tsx`, `src/shared/providers/AuthProvider.tsx`, `src/features/settings/components/WorkshopSettings.tsx`, `src/features/settings/hooks/useWorkshopSettings.ts`, `.env.example`, and SDD-1 migrations `0020`/`0021`.
- Skills: `work-unit-commits`, `chained-pr`.

## Architecture

```text
Authenticated user
  -> AuthProvider loads profile/workshop context
  -> AppLayout checks auth -> onboarding -> billing status
      -> active/trialing: render app routes
      -> expired/unpaid/past_due/cancelled: render billing-only route/screen

Frontend billing feature
  -> src/features/billing/api/* reads subscription through typed Supabase client
  -> src/features/billing/hooks/* wraps TanStack Query/mutations
  -> Supabase functions invoked for start/cancel operations

Supabase database
  -> subscriptions table scoped by workshop_id with RLS
  -> onboarding trigger creates trial row idempotently
  -> optional webhook_events table for idempotency/audit

Supabase Edge Functions
  -> create-subscription derives workshop_id from JWT/profile, calls MercadoPago preapproval API
  -> cancel-subscription derives workshop_id, updates provider when supported
  -> mercadopago-webhook verifies signature, fetches provider state, updates subscription by provider_preapproval_id
```

Feature code should be self-contained under `src/features/billing/` with only generic primitives/contracts in `src/shared/` when needed. Do not introduce cross-feature imports from billing into unrelated features except app shell/settings composition points.

## Data Model Sketch

### `subscriptions`

New migration: `supabase/migrations/0022_billing_schema.sql`.

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `workshop_id uuid not null references public.workshops(id) on delete cascade`
- `status text not null check (status in ('trialing', 'active', 'past_due', 'unpaid', 'cancelled'))`
- `plan text not null default 'pro_monthly'`
- `provider text not null default 'mercadopago'`
- `trial_starts_at timestamptz null`
- `trial_ends_at timestamptz null`
- `current_period_starts_at timestamptz null`
- `current_period_ends_at timestamptz null`
- `provider_subscription_id text null`
- `provider_preapproval_id text null`
- `provider_status text null`
- `cancel_at_period_end boolean not null default false`
- `cancelled_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes/invariants:

- `create unique index subscriptions_one_per_workshop on public.subscriptions(workshop_id)` for MVP one active billing row per workshop.
- `create index subscriptions_workshop_id_idx on public.subscriptions(workshop_id)`.
- `create unique index subscriptions_provider_preapproval_id_idx on public.subscriptions(provider_preapproval_id) where provider_preapproval_id is not null`.
- `updated_at` trigger using existing project pattern or a local function if none exists.

### `billing_webhook_events` (recommended)

Add in same or second DB work unit if line budget permits:

- `id uuid primary key default gen_random_uuid()`
- `provider text not null default 'mercadopago'`
- `provider_event_id text not null`
- `event_type text not null`
- `provider_resource_id text null`
- `processed_at timestamptz not null default now()`
- `payload jsonb not null default '{}'::jsonb`
- unique `(provider, provider_event_id)`

This table is server-maintained only. It does not need client read access. It may omit `workshop_id` only if treated as provider-level audit infrastructure; however project convention says every table must include `workshop_id uuid NOT NULL`. To satisfy that convention, prefer adding `workshop_id uuid not null references workshops(id)` after resolving the subscription, and only insert processed events once a matching subscription exists. Unknown provider IDs should be logged and returned 200 without insert.

### TypeScript types

Update `src/shared/types/database.ts` manually or regenerate. Ensure every manually maintained table includes `Relationships: []` or explicit relationships according to repo convention.

## RLS and Security Model

- `subscriptions` RLS enabled.
- Authenticated client may `SELECT` only rows where `workshop_id = public.get_current_workshop_id()`.
- Authenticated client should not directly `INSERT`, `UPDATE`, or `DELETE` subscriptions. All mutations go through Edge Functions using service role.
- Edge Functions must derive workshop identity from the verified Supabase JWT/session, never from request body.
- MercadoPago access token, webhook secret/signature material, and Supabase service role key must be Supabase Function secrets only; never `VITE_*`.
- Frontend only receives public redirect/init URLs and non-secret subscription state.
- Webhook function must verify signature before reading/updating state and must fetch current provider state server-side rather than trusting all payload fields.
- Log anomalies without sensitive tokens or full PII payloads.

## Trial Lifecycle Design

- Add a DB trigger on `profiles` for `onboarded_at` transition from `NULL` to non-`NULL`.
- Trigger inserts one `subscriptions` row if none exists for the profile's workshop.
- Trial fields: `trial_starts_at = now()`, `trial_ends_at = now() + interval '14 days'`, `status = 'trialing'`, `plan = 'pro_monthly'`, `provider = 'mercadopago'`.
- Use `insert ... on conflict (workshop_id) do nothing` for idempotency.
- Gate logic treats `trialing` as allowed only when `now <= trial_ends_at`; `now > trial_ends_at` blocks immediately.

## Edge Function Design

### Shared function utilities

Under `supabase/functions/_shared/`:

- `auth.ts`: parse `Authorization` header, create Supabase service client, get user, load profile/workshop.
- `mercadopago.ts`: provider request helper using `MERCADOPAGO_ACCESS_TOKEN`.
- `billing.ts`: map provider status to app statuses, date parsing, response helpers.

### `create-subscription`

Request:

```http
POST /functions/v1/create-subscription
Authorization: Bearer <supabase access token>
Content-Type: application/json
```

Body should be minimal, e.g. optional return URLs only if validated against configured app origin.

Flow:

1. Verify JWT and derive `workshop_id` from `profiles`.
2. Load/create existing subscription row; do not create duplicate provider preapproval if one is already pending/active.
3. Call MercadoPago preapproval/subscriptions API for ARS 4,990 monthly, plan `pro_monthly`, with external reference including subscription/workshop identifier.
4. Persist `provider_preapproval_id`, `provider_status`, and provider period fields if available.
5. Return redirect/init URL to frontend.

### `mercadopago-webhook`

Request from MercadoPago.

Flow:

1. Read raw body before JSON parsing for signature verification.
2. Verify MercadoPago signature/secret according to current MercadoPago docs and configured `MERCADOPAGO_WEBHOOK_SECRET`/signature material.
3. Extract provider event/resource ID.
4. Fetch current preapproval/payment state from MercadoPago API.
5. Find `subscriptions` row by `provider_preapproval_id` or stable external reference.
6. If no row is found, log anomaly and return 200 to prevent retry storms.
7. Insert into `billing_webhook_events` with unique provider event ID; if duplicate, return 200 without mutating.
8. Map provider state to app status:
   - authorized/active charge: `active`
   - pending/retry failure: `past_due` or `unpaid` according to provider status
   - cancelled: `cancelled`
9. Update period dates and cancellation fields.
10. Return 200.

### `cancel-subscription`

Flow:

1. Verify JWT, derive `workshop_id`.
2. Load own subscription with provider ID.
3. Attempt period-end cancellation if MercadoPago supports it cleanly.
4. If not supported, use approved fallback: immediate cancellation, update `status = 'cancelled'`, `cancelled_at = now()`.
5. Return updated app subscription state.

## Frontend State and Gate Design

### New billing feature

Suggested files:

- `src/features/billing/api/subscriptions.ts`
- `src/features/billing/hooks/useSubscription.ts`
- `src/features/billing/hooks/useBillingActions.ts`
- `src/features/billing/components/BillingGate.tsx`
- `src/features/billing/components/BillingBlockedScreen.tsx`
- `src/features/billing/components/BillingSettingsCard.tsx`
- `src/features/billing/lib/access.ts`
- `src/features/billing/types.ts`

`access.ts` should contain pure functions for easy TDD:

- `getBillingAccess(subscription, now): 'allowed' | 'blocked' | 'loading'`
- `isTrialActive(subscription, now)`
- `formatBillingStatus(subscription)`

### App shell integration

Modify `AppLayout` only after billing feature tests exist:

1. Keep current auth loading check.
2. Keep login redirect when no session.
3. Keep onboarding redirect when `onboardedAt` is missing.
4. Fetch subscription state after auth + onboarding + workshopId are present.
5. Show loading skeleton while billing query loads.
6. If blocked, render/redirect to billing-only screen and prevent normal `Outlet`/nav data routes from rendering.
7. Allow billing route/settings billing section, logout, support links.

Prefer rendering a gate component around the normal shell rather than scattering checks in each route.

### Settings integration

Add `BillingSettingsCard` to `WorkshopSettings` near the top. In blocked mode, avoid rendering full workshop settings if the user is routed to billing-only access; the dedicated blocked screen can reuse the card with only safe data.

### Query behavior

- Query key: `['subscription', workshopId]`.
- `enabled: Boolean(workshopId && onboardedAt)`.
- Refetch on successful Edge Function actions and optionally on window focus.
- Frontend must not compute final authority for provider status; it only gates based on server state and current time.

## Test Strategy — Strict TDD Evidence Required Later

Implementation must record RED/GREEN/TRIANGULATE/REFACTOR evidence per work unit.

### SQL/RLS tests

Before migration implementation, add failing SQL assertions/test fixtures proving:

- `subscriptions` has `workshop_id uuid not null`.
- RLS is enabled.
- Own-workshop SELECT succeeds.
- Cross-workshop SELECT returns no rows.
- Authenticated direct cross-workshop INSERT/UPDATE/DELETE is denied.
- Onboarding transition creates exactly one trial row.
- Re-updating `onboarded_at` does not reset trial dates.

Then implement migration to turn tests green. Use the same SDD-1 tenant resolver (`public.get_current_workshop_id()`).

### Frontend tests

Use Vitest + Testing Library.

- Pure unit tests for `getBillingAccess`:
  - active -> allowed
  - trialing future -> allowed
  - trialing past + `now > trial_ends_at` -> blocked
  - past_due/unpaid/cancelled -> blocked
  - null/loading -> loading/blocked fail-safe according to UX decision
- Component tests for `BillingBlockedScreen` ensuring no business data/nav is rendered and start-payment/logout/support actions are present.
- App shell tests mocking `useAuth`/billing query for active vs blocked states.
- Settings card tests for trial, active, past_due/unpaid, cancellation pending.

### Edge Function tests/checks

If local Deno test setup is not present, keep provider functions small and test pure mapping/signature helpers where possible. Add a mandatory manual sandbox checklist for:

- Valid webhook accepted.
- Invalid signature rejected with 401/403 and no DB update.
- Duplicate event returns 200 and does not mutate twice.
- Successful payment activates subscription.
- Failed payment blocks access.

### Required apply evidence format

For each PR/work unit in apply:

- RED: failing test name/output before code.
- GREEN: passing output after minimal code.
- TRIANGULATE: second/edge scenario added where behavior could be hard-coded.
- REFACTOR: refactor performed or explicit “not needed”; tests still green.

Final verification: `npm test`; also run lint/build if implementation touches TS/React broadly.

## Work Units and Stacked PR Forecast

The complete MVP likely exceeds 400 changed lines. Use work-unit commits and stacked PRs. Recommended chain strategy: **stacked PRs to main** because each slice can be reviewed independently while later slices depend on earlier contracts.

```text
main
 └─ PR 1 📍 DB billing schema + RLS + trial trigger + SQL tests
     └─ PR 2 Edge Function create/cancel/webhook contracts + config docs
         └─ PR 3 Frontend billing state/gate + tests
             └─ PR 4 Settings/legal/pricing alignment + webhook checklist
```

### PR 1 — Schema, RLS, trial lifecycle

Boundary:

- `supabase/migrations/0022_billing_schema.sql`
- SQL/RLS test artifacts according to repo test pattern
- `src/shared/types/database.ts`

Verification:

- SQL/RLS assertions pass in local/test Supabase.
- `npm test` if TS types are changed.

Rollback:

- Pre-production: revert migration/type changes.
- Post-production: disable trigger/gate first; preserve rows unless data purge is approved.

Estimated review load: medium/high but focused. Could exceed 400 if SQL tests are verbose; split webhook-events table into PR 2 if needed.

### PR 2 — Edge Functions and env contracts

Boundary:

- `supabase/functions/create-subscription/*`
- `supabase/functions/cancel-subscription/*`
- `supabase/functions/mercadopago-webhook/*`
- `supabase/functions/_shared/*`
- `.env.example` and deployment notes/checklist skeleton

Verification:

- Unit tests or small pure helper tests where available.
- Manual local invocation with mocked MercadoPago responses if implemented.
- No secret exposure in frontend.

Rollback:

- Disable function routes/secrets; leave DB state intact.

Estimated review load: high. If over budget, split into PR 2a create/cancel and PR 2b webhook/idempotency.

### PR 3 — Frontend billing gate

Boundary:

- `src/features/billing/api/*`
- `src/features/billing/hooks/*`
- `src/features/billing/lib/access.ts`
- `src/features/billing/components/BillingGate.tsx`
- `src/features/billing/components/BillingBlockedScreen.tsx`
- `src/app/layouts/AppLayout.tsx`
- Tests for access logic/gate/screen

Verification:

- Vitest/Testing Library tests.
- Manual route attempts for blocked users.

Rollback:

- Revert AppLayout gate composition to restore full access while keeping backend billing data.

Estimated review load: medium/high; split pure access + components from AppLayout integration if approaching 400 lines.

### PR 4 — Settings, legal/pricing alignment, final checklist

Boundary:

- `src/features/billing/components/BillingSettingsCard.tsx`
- `src/features/settings/components/WorkshopSettings.tsx`
- `src/features/landing/data/pricing.ts` only if semantics change
- `src/features/legal/pages/TermsPage.tsx`
- `src/features/legal/pages/PrivacyPage.tsx`
- `docs` or OpenSpec manual webhook checklist
- Tests for settings card

Verification:

- Vitest/Testing Library tests.
- Legal/pricing review against implemented behavior.
- Sandbox webhook checklist executed before archive.

Rollback:

- Revert settings/legal UI changes independently; backend and gate remain intact.

Estimated review load: medium.

## Rollout Plan

1. Apply DB schema in staging first.
2. Configure Supabase Function secrets in sandbox/staging:
   - `MERCADOPAGO_ACCESS_TOKEN`
   - `MERCADOPAGO_WEBHOOK_SECRET` or signature material
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - app return URLs/origin if functions need them
3. Deploy Edge Functions to staging.
4. Configure MercadoPago sandbox webhook URL.
5. Run manual webhook checklist.
6. Enable frontend gate only after subscription reads and trial trigger are verified.
7. Smoke-test: new onboarding creates trial, start payment redirects, webhook updates active, expired/unpaid blocks.
8. Promote to production with production MercadoPago credentials and webhook URL.

## Rollback Plan

- Fast user-access rollback: revert/disable frontend gate in `AppLayout` so users regain app access.
- Provider rollback: disable MercadoPago webhook and create/cancel functions or remove secrets; keep rows for audit.
- DB rollback pre-production: revert `0022` migration and regenerated types.
- DB rollback post-production: avoid destructive rollback; instead add a corrective migration disabling triggers/policies as needed and preserve subscription records.
- Legal rollback: if billing launch is delayed, update legal/pricing copy so it does not promise unavailable behavior.

## Open Risks / Decisions to Confirm Before Apply

- Exact MercadoPago webhook signature verification algorithm and headers must be confirmed from current docs/account settings.
- Exact preapproval period-end cancellation capability must be verified; fallback is immediate cancellation as approved.
- Local Edge Function test harness may be limited; compensate with pure helper tests and required sandbox checklist.
- The auth provider currently ignores profile-load errors; SDD 3 will harden that later, but billing gate should fail closed enough to avoid granting unpaid access on subscription query failure.
- Full implementation likely requires stacked PRs; if any single slice forecasts above 400 changed lines, parent should auto-chain or split further before apply.

## Phase Result Envelope

| Field | Value |
|---|---|
| **status** | `design_complete` |
| **executive_summary** | MVP design uses a workshop-scoped `subscriptions` table with RLS, onboarding-triggered 14-day trials, Supabase Edge Functions for MercadoPago preapproval creation/cancellation/webhooks, and a React billing gate that blocks expired/unpaid workshops to billing-only access. Implementation should be split into stacked PRs: DB/RLS, Edge Functions, frontend gate, settings/legal/checklist. |
| **artifacts** | `openspec/changes/sdd-2-billing-mercadopago/design.md` |
| **next_recommended** | `tasks` — convert the work units above into explicit task checklist and PR chain plan before any implementation. |
| **risks** | MercadoPago signature/cancellation API specifics, webhook idempotency, local Edge Function test coverage, billing gate fail-closed behavior, and likely 400-line review-budget pressure. |
| **skill_resolution** | `paths-injected` |

## Memory Persistence Note

Engram tools were not available in this subagent toolset, so this design decision was persisted to the OpenSpec artifact only. Parent should save significant SDD 2 design decisions to Engram topic `sdd/sdd-2-billing-mercadopago/design` with project `carpinteropro` if memory tools are available.
