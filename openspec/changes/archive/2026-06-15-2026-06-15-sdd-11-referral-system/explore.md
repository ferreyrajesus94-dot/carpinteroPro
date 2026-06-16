# SDD-11 Referral System — Explore

## Outcome

Implement a YouTuber-driven referral program: configurable % discount on the
referred user's first subscription, and a recurring % commission paid to the
YouTuber for every subsequent payment while the referred user remains active.
Must integrate with the existing MercadoPago subscription flow, expose admin
CRUD for YouTubers and codes, and respect the project's multi-tenant
conventions.

## Current codebase map

| Area | Finding | Path evidence |
|---|---|---|
| Routing | Admin area is lazy `/admin/*` with `AdminGuard` reading `isPlatformAdmin`. | `src/app/router.tsx`, `src/features/admin/components/AdminGuard.tsx` |
| Admin nav | `ADMIN_NAV_ITEMS` is a hard-coded array of 4 items (Resumen, Talleres, Billing, Soporte). New section requires one entry. | `src/features/admin/lib/adminNavigation.ts` |
| Admin Edge Function pattern | All cross-tenant reads go through Edge Functions with `requirePlatformAdmin` (uses anon client with JWT + `profiles.is_platform_admin` check, then `serviceClient()` for DB). | `supabase/functions/_shared/admin-auth.ts`, `supabase/functions/admin-*/index.ts` |
| Admin UI pattern | Feature-sliced `src/features/admin/{api,components,hooks,lib,types,index.ts,routes.tsx}`. TanStack Query wrappers in `hooks/`, typed API in `api/`. | `src/features/admin/` |
| Auth & signup | `signUpWithEmail` accepts metadata (currently `workshop_name`, `terms_accepted_at`, `privacy_accepted_at`). The `handle_new_user` trigger creates `workshops` + `profiles` from `raw_user_meta_data`. | `src/features/auth/api/index.ts`, `supabase/migrations/0005_auth_profiles.sql` |
| Trial lifecycle | `start_trial_on_onboarding` trigger inserts a `subscriptions` row with `status='trialing'`, `trial_ends_at = now() + 14 days` on first `onboarded_at` set. | `supabase/migrations/0022_billing_schema.sql` |
| MP subscription | `create-subscription` Edge Function calls `/preapproval` with `transaction_amount: 4990`, `currency_id: "ARS"`, `frequency: 1, frequency_type: "months"`, and `external_reference: sub?.id || workshopId`. The `transaction_amount` is the natural injection point for first-period discount. | `supabase/functions/create-subscription/index.ts:60-72` |
| MP webhook | `mercadopago-webhook` handles `preapproval`, `authorized_payment`, and `payment` events. Updates `subscriptions.status` and on `active` it sets `current_period_starts_at` / `current_period_ends_at` (+30 days). The `authorized_payment` branch is the natural hook to record commissions. | `supabase/functions/mercadopago-webhook/index.ts:99-201` |
| Billing UI | `BillingSettingsCard` shows pricing via `BILLING_PRICE` constant (`4.990 ARS/mes`). No first-period-discount message, no referral copy. | `src/features/billing/components/BillingSettingsCard.tsx`, `src/shared/constants/billingPricing.ts` |
| Platform-wide config | `platform_settings` key-value table is used for `maintenance`. Pattern available for `referral` config (default discount %, default commission %) but cannot replace per-YouTuber settings. | `supabase/migrations/20260613000001_platform_settings.sql` |
| Multi-tenant rule | Convention: every table must include `workshop_id uuid NOT NULL`. Youtubers/commissions are platform-global, so SDD-9 already established the precedent: use `profiles.is_platform_admin` for cross-tenant access; the `platform_settings` precedent allows no-`workshop_id` tables IF all access is via admin Edge Functions (service role). | `openspec/config.yaml:147`, `openspec/changes/2026-06-12-sdd-9-admin-dashboard/explore.md:67-69` |
| Database types | Manually maintained `src/shared/types/database.ts` — every new table must include `Relationships: []` if it has no FK to other public tables. Existing `subscriptions` already uses this pattern. | `src/shared/types/database.ts:131` |
| Test conventions | Vitest + Testing Library; admin pages have `*.test.tsx` colocated. Edge Functions tested via migration-level pgTAP-style assertions and manual curl checklists. | `supabase/migrations/0022_billing_schema.sql:104-243`, `src/features/admin/components/*.test.tsx` |
| Delivery strategy | Project enforces 400-line review budget. SDD-10 used chained PRs (WU1+WU6 → WU2+WU3 → WU4+WU5 → WU7) and forecast High risk. | `openspec/changes/2026-06-13-sdd-10-admin-actions/tasks.md:1-15` |
| Searches | No existing `referral`, `affiliate`, `commission`, `youtuber`, or `discount` code in `src/` or `supabase/functions/` (only `auto_stock_discount` which is unrelated inventory logic). | grep over `*.{ts,tsx,sql}` — no hits |

## Recommended product scope

### In scope for MVP

1. **YouTuber entity** (platform-global)
   - `youtubers(id, display_name, channel_url, contact_email, payout_method?, is_active, created_at, updated_at)` — managed by platform admin only.
   - No `workshop_id` (platform-global table); access only via admin Edge Functions with `requirePlatformAdmin`.

2. **Referral codes**
   - Each YouTuber can have multiple codes (e.g. one per video).
   - `referral_codes(id, youtuber_id, code, discount_pct, commission_pct, is_active, created_at)` — `code` is unique short string (URL-friendly).
   - Validation: codes only match when `is_active = true`. Soft-disable preserves historical attribution.

3. **Attribution at signup**
   - Landing URL accepts `?ref=CODE`; the registration form (`LoginPage`) reads the code from `searchParams` and passes it as `referral_code` in `signUpWithEmail` metadata.
   - `handle_new_user` trigger reads `raw_user_meta_data->>'referral_code'`, validates against `referral_codes`, and stamps `workshops.referred_by_code_id` and `workshops.referred_by_youtuber_id` (or stores attribution in a separate `workshop_referrals` row).
   - Codes are case-insensitive; unknown / inactive codes are silently ignored (no error to user) but logged.

4. **First-period discount**
   - On the first MP preapproval creation, the Edge Function applies `discount_pct` to `transaction_amount` (e.g. 20% off → 3992 ARS) for the first billing period only.
   - The `subscriptions` row records `first_period_discount_pct` (nullable after first period completes) for traceability.
   - Subsequent periods revert to full price (MercadoPago preapproval reuses the same preapproval id; we do NOT mutate it — discount is "introductory").

5. **Recurring commission**
   - In the `mercadopago-webhook` `authorized_payment` branch, if the workshop has an active attribution, INSERT a `referral_commissions(workshop_id, youtuber_id, referral_code_id, payment_id, amount, commission_pct, commission_amount, currency, occurred_at)` row.
   - `commission_amount = round(payment_amount * commission_pct / 100, 2)`.
   - Commission is recorded ONLY when the payment is for an `active` subscription (recurring, not the discounted first payment if business decides first-period is excluded — flag in design).
   - Idempotency: the unique `payment_id` from MercadoPago must be deduplicated via unique index on `referral_commissions(payment_id)`.

6. **Admin UI**
   - New `/admin/referidos` route with two tabs/sections:
     - **Youtubers**: list, create, edit, deactivate. Show code count, active referred workshops, lifetime commissions.
     - **Commissions**: filterable table by YouTuber / date range / status. CSV export.
   - Add `Referidos` to `ADMIN_NAV_ITEMS` (between Billing and Soporte).
   - Reuse `useSort`, `downloadCsv`, `ConfirmDialog`, `useAdminActions` patterns from SDD-10.

7. **Self-service signals (tenant side, read-only)**
   - `BillingSettingsCard` shows "Descuento de primera aplicación: X% aplicado" if `first_period_discount_pct` is set.
   - No tenant-facing commission disclosure (admin-only).

### Explicitly out of scope for MVP

- Automated payout integration (MercadoPago payouts, PayPal, bank transfer). MVP only records the ledger; the owner pays manually.
- Tiered / milestone commission structures (e.g. bonus at 10 active referrals). Single `commission_pct` per code only.
- Self-service YouTuber dashboard (admin creates codes on the YouTuber's behalf).
- Refund/reversal of commissions (no adjustment workflow yet; if business needs it, a later SDD).
- Multi-currency support.
- Anti-fraud heuristics (e.g. self-referral, chargeback detection). The unique payment id plus manual review is enough for MVP.
- A/B testing the discount % per code.
- Anonymized public "how it works" landing page section.

## Security model

Follow the SDD-9 precedent exactly:

1. Youtubers, codes, and commissions are platform-global. They DO NOT have `workshop_id` because no tenant owns them.
2. All browser access goes through admin Edge Functions. Frontend only uses the typed Supabase client for normal user signup (where the only write is `raw_user_meta_data` via the public `signUp` API — a documented, intended public surface).
3. The `handle_new_user` trigger runs `SECURITY DEFINER` and reads `referral_codes` with the function owner's privileges; it must validate the code is `is_active = true` before stamping the workshop.
4. RLS:
   - `referral_codes`, `youtubers`, `referral_commissions`: enable RLS, no policies for `authenticated` (service role bypasses RLS in Edge Functions). This is the same posture as `platform_settings`.
5. Workshop attribution read for the tenant: `subscriptions.first_period_discount_pct` is the only thing the tenant sees; the tenant does NOT get to see the YouTuber's identity or commission (avoids privacy drama).
6. The bootstrap "first YouTuber" is created via the admin UI; no manual SQL required after migrations.

## Architecture options

| Approach | Pros | Cons | Effort | Recommended? |
|---|---|---|---|---|
| **A. Application-level discount + ledger (recommended)**<br>Edge Function `create-subscription` adjusts `transaction_amount` for first period only. `mercadopago-webhook` records commissions in our own table on `authorized_payment`. | Full control over discount math. No MP coupon setup. Single source of truth in our DB. Matches SDD-10 patterns. Can compute "lifetime commission per YouTuber" with a simple SELECT. | More code in our Edge Functions. Need to be careful that MP doesn't override the amount on subsequent periods (it won't, because we don't change the preapproval). | Medium | **Yes** |
| **B. MercadoPago native coupons**<br>Create a MP coupon per YouTuber code, pass it on first preapproval. | Officially supported by MP. Less code in webhook. | MP coupon system is clunky for "first period only" — usually applies forever. Two-system reconciliation if commission logic lives elsewhere. Pricing currency quirks. | Medium | No |
| **C. Hybrid: MP coupon for discount + our ledger for commission** | Reuses MP coupon lifecycle. | Two code paths. Discount is sticky in MP unless we explicitly cancel coupon. Commission logic is still all ours. More failure modes. | High | No |

## Recommended approach (detail)

### New tables (3 migrations, follow SDD-9 platform-global pattern)

```sql
-- Migration 1: youtubers
CREATE TABLE public.youtubers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text NOT NULL,
  channel_url   text,
  contact_email text,
  payout_method text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.youtubers ENABLE ROW LEVEL SECURITY;
-- No policies: access only via admin Edge Functions with service role

-- Migration 2: referral_codes
CREATE TABLE public.referral_codes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtuber_id     uuid NOT NULL REFERENCES public.youtubers(id) ON DELETE CASCADE,
  code            text NOT NULL,
  discount_pct    numeric(5,2) NOT NULL CHECK (discount_pct >= 0 AND discount_pct <= 100),
  commission_pct  numeric(5,2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 100),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_code_unique UNIQUE (code)
);
CREATE INDEX referral_codes_youtuber_id_idx ON public.referral_codes(youtuber_id);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

-- Migration 3: referral_commissions
CREATE TABLE public.referral_commissions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id        uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  youtuber_id        uuid NOT NULL REFERENCES public.youtubers(id) ON DELETE RESTRICT,
  referral_code_id   uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  provider_payment_id text NOT NULL,  -- MP payment id, unique for idempotency
  subscription_id    uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  payment_amount     numeric(12,2) NOT NULL,
  commission_pct     numeric(5,2) NOT NULL,
  commission_amount  numeric(12,2) NOT NULL,
  currency           text NOT NULL DEFAULT 'ARS',
  occurred_at        timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_commissions_payment_unique UNIQUE (provider_payment_id)
);
CREATE INDEX referral_commissions_youtuber_id_idx ON public.referral_commissions(youtuber_id);
CREATE INDEX referral_commissions_workshop_id_idx ON public.referral_commissions(workshop_id);
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
```

### Attribution table (alternative to columns on `workshops`)

```sql
-- Migration 4: workshop_referrals (nullable workshop_id is allowed because
-- platform-global reads happen via admin Edge Functions only)
CREATE TABLE public.workshop_referrals (
  workshop_id          uuid PRIMARY KEY REFERENCES public.workshops(id) ON DELETE CASCADE,
  referral_code_id     uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  youtuber_id          uuid NOT NULL REFERENCES public.youtubers(id) ON DELETE RESTRICT,
  attributed_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workshop_referrals ENABLE ROW LEVEL SECURITY;
```

### Subscription table additions

```sql
-- Migration 5: subscriptions columns
ALTER TABLE public.subscriptions
  ADD COLUMN first_period_discount_pct numeric(5,2),
  ADD COLUMN referred_by_referral_code_id uuid REFERENCES public.referral_codes(id);
```

### `handle_new_user` trigger extension

```sql
-- Read referral_code from metadata, validate, insert attribution
CREATE OR REPLACE FUNCTION public.handle_new_user() ...
-- If metadata->>'referral_code' resolves to an active code,
-- INSERT into public.workshop_referrals.
```

### `create-subscription` Edge Function

Accept the existing flow plus:
- Read `workshop.referred_by_referral_code_id` (via `workshop_referrals` join).
- If present and `is_active = true`, compute `discounted_amount = round(4990 * (1 - discount_pct/100), 2)`.
- Use `discounted_amount` for the `auto_recurring.transaction_amount` ONLY on first preapproval.
- Persist `first_period_discount_pct` on the `subscriptions` row.
- The `external_reference` stays the same so MP doesn't treat first vs. recurring differently.

### `mercadopago-webhook` Edge Function

- In the `authorized_payment` branch, after the subscription update, SELECT the workshop's attribution from `workshop_referrals`.
- If attribution exists and the payment status is `approved`:
  - INSERT into `referral_commissions` with the payment id, amount, and commission.
  - Use unique constraint on `provider_payment_id` for idempotency (catch `23505` and log "already recorded").
- The preapproval / payment branches do NOT record commissions (they update subscription state only).

### New admin Edge Functions

- `admin-youtubers` (POST): list with aggregated commission totals.
- `admin-youtube-create` / `admin-youtube-update` / `admin-youtube-toggle` (POST): CRUD.
- `admin-referral-codes` (POST): list/create/deactivate per YouTuber.
- `admin-referral-commissions` (POST): filterable list with date/youtuber filters and CSV-ready shape.

All use `requirePlatformAdmin`.

### Frontend changes

- `src/features/admin/lib/adminNavigation.ts`: add `{ to: "/admin/referidos", label: "Referidos", icon: "fi-rr-megaphone" }`.
- `src/features/admin/routes.tsx`: add `ReferidosPage` (and child routes if needed).
- `src/features/admin/types.ts`: extend with YouTuber / code / commission DTOs.
- `src/features/admin/api/referrals.ts`: typed API client.
- `src/features/admin/hooks/useReferrals.ts`: TanStack Query hooks.
- `src/features/admin/components/ReferidosPage.tsx`: tabbed UI (Youtubers / Commissions).
- `src/features/billing/components/BillingSettingsCard.tsx`: show "Descuento aplicado: X% durante el primer período" when `first_period_discount_pct` is set.
- `src/features/auth/components/LoginPage.tsx`: read `?ref=CODE` from `useSearchParams`, pass to `signUpWithEmail({ ..., referral_code })`.
- `src/shared/types/database.ts`: add the new tables; preserve `Relationships: []` for `youtubers` (no FKs out of public schema besides timestamps) and proper `Relationships` arrays for `referral_codes` and `referral_commissions`.

## Affected areas

| Area | Expected impact |
|---|---|
| `supabase/migrations/` | 4–5 new migrations (youtubers, referral_codes, referral_commissions, workshop_referrals, subscriptions columns). Each must include RLS enable + an in-migration RLS test assertion. |
| `supabase/functions/_shared/mercadopago.ts` | New helper to compute discounted first-period amount. |
| `supabase/functions/create-subscription/index.ts` | Read attribution, apply discount on first preapproval, persist `first_period_discount_pct`. |
| `supabase/functions/mercadopago-webhook/index.ts` | Record commission on `authorized_payment`. |
| `supabase/functions/admin-youtubers/*` (new) | Admin CRUD for YouTubers. |
| `supabase/functions/admin-referral-codes/*` (new) | Admin CRUD for codes. |
| `supabase/functions/admin-referral-commissions/*` (new) | Admin list/aggregate. |
| `src/features/admin/lib/adminNavigation.ts` | Add Referidos entry. |
| `src/features/admin/routes.tsx` | Add `/referidos` route. |
| `src/features/admin/types.ts` | New DTOs. |
| `src/features/admin/api/referrals.ts` (new) | Typed API client. |
| `src/features/admin/hooks/useReferrals.ts` (new) | TanStack Query hooks. |
| `src/features/admin/components/ReferidosPage.tsx` (new) | Tabbed admin UI. |
| `src/features/admin/components/ReferidosPage.test.tsx` (new) | Component tests. |
| `src/features/billing/components/BillingSettingsCard.tsx` | Show first-period discount message. |
| `src/features/billing/components/BillingSettingsCard.test.tsx` | Test for discount message. |
| `src/features/auth/components/LoginPage.tsx` | Capture `?ref=CODE`, pass to signup. |
| `src/features/auth/components/LoginPage.test.tsx` | Test ref capture. |
| `src/shared/types/database.ts` | Add new table types; preserve `Relationships: []` where applicable. |
| Tests | RLS/integration tests in migrations; component tests for new pages; ref-capture test. |

## Chained PR forecast (assumes Approach A)

| Field | Value |
|---|---|
| Estimated changed lines (full scope) | 900–1,500 |
| 400-line review budget risk | **High** |
| Decision needed before apply | Yes — confirm commission rules (include first period? only recurring?) |
| Chained PRs recommended | Yes |
| Suggested split | PR1 WU1 (schema + RLS) → PR2 WU2 (signup attribution + create-subscription discount) → PR3 WU3 (webhook commission recording) → PR4 WU4 (admin Youtubers/Codes UI) → PR5 WU5 (admin Commissions UI + tenant discount message + tests) |

Each PR is independently shippable, has its own tests, and is reversible (schema migrations are additive; new Edge Functions can be left un-deployed; UI work sits behind `/admin/*`).

## Open questions for proposal phase

1. **Does commission apply to the first (discounted) payment, or only to subsequent full-price payments?** Most referral programs exclude the first payment. Decision shapes the webhook logic.
2. **Is the discount "first billing period" or "first N months"?** MVP = first period (one month). Decision shapes the `first_period_discount_pct` lifecycle.
3. **Self-referral policy**: can a YouTuber use their own code? Suggest no — easy to enforce by checking that the signing-up user's email is not the YouTuber's `contact_email`. Or skip for MVP and accept manual review.
4. **Currency**: project is ARS-only today. Safe to assume ARS in all new code; no multi-currency columns beyond `currency text`.
5. **Payout responsibility**: confirm the platform owner will pay YouTubers manually based on the admin "Commissions" report. No automated payout in MVP.

## Key risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Review budget > 400 lines | Dashboard + Edge Functions + tests are multi-area. | Chained PRs (4–5 WUs); each is additive and reversible. |
| New platform-global tables violate `workshop_id` rule | Project convention is strict; we don't want lint and review to bounce. | Youtubers, codes, commissions are platform-global; SDD-9 established the precedent (admin-only Edge Functions, no public RLS, no `workshop_id`). Document explicitly in proposal. |
| Webhook idempotency for commissions | MP can redeliver; recording twice inflates the ledger. | Unique index on `referral_commissions(provider_payment_id)`; catch `23505` and log "already recorded". |
| Discount leaks to subsequent periods | If we mutate the preapproval, MP would charge the discounted amount forever. | We apply the discount to the first `createPreapproval` call only. Subsequent periods are governed by the preapproval's `transaction_amount`, which we leave at full price from month 2. Verify with explicit test. |
| `handle_new_user` changes affect existing signups | Editing a core trigger can regress onboarding. | Trigger extension is purely additive (read metadata, insert only if code resolves). Existing tests in `0022_billing_schema.sql` still pass. Add new in-migration RLS test. |
| Tenant privacy: tenant sees YouTuber identity? | Could create awkward dynamics (tenant demands discount "from" the YouTuber). | Tenant sees only the discount % and the message "first-period discount applied". Youtuber name and commission are admin-only. |
| Frontend `LoginPage` change might break existing signup tests | Adding `useSearchParams` and a new metadata field risks regressions. | Component test for the ref capture path; keep the existing flow identical when no `?ref=` is present. |
| Argentinian tax / legal exposure on commissions | If commissions are "income" for the YouTuber, the platform may have reporting obligations. | Out of scope: legal counsel is the owner's responsibility. The MVP is just a ledger. |

## Next phase input

The proposal should:

- Recommend Approach A (application-level discount + ledger).
- Lock the commission rule (recommend: commission applies to ALL successful payments including the first, with the YouTuber earning commission on the discounted amount — owner-friendly default; allow flip in design).
- Lock the discount rule (recommend: first billing period only, on full first payment).
- Define the 5 chained PRs.
- List the exact 5 migrations with the SQL above.
- List the 4 new admin Edge Functions with request/response shapes.
- Cover the OpenSpec delta specs (`admin/referrals`, `billing/referral-discount`, `auth/referral-attribution`).
- Add a strict TDD plan: failing test → implementation → green → refactor.

## Ready for Proposal

**Yes** — the data model, the integration points, the security model, the UI surface, the delivery strategy, and the open questions are all clear enough to drive a one-page proposal.
