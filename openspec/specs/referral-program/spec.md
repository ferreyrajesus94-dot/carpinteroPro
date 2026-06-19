# SDD 11 Specification — Referral Program

> This spec defines the **referral-program** capability added by SDD-11.
> Covers schema/RLS, signup attribution, first-period discount, commission recording, admin APIs, admin UI, tenant UI, and security.

## Domain: Referral Schema & RLS

### Purpose

Persist platform-global YouTuber promoters, short referral codes, per-workshop attribution, and a commission ledger that survives webhook retries — without breaking the project's `workshop_id` multi-tenant convention.

### Requirements

### Requirement: YouTubers Table

The system MUST provide a `public.youtubers` table that stores one row per promoter, identified by `id` (uuid) and addressed by `display_name`. The table MUST NOT include `workshop_id` because YouTubers are platform-global (SDD-9 precedent).

#### Scenario: Schema contract

- GIVEN the migration `20260615000001_referral_program_youtubers.sql` is applied
- WHEN the table definition is inspected
- THEN it MUST include `id uuid PK`, `display_name text NOT NULL`, `channel_url text`, `contact_email text`, `payout_method text`, `is_active boolean NOT NULL DEFAULT true`, `created_at`, `updated_at`
- AND RLS MUST be enabled with no policies (service role bypass only)

#### Scenario: RLS denies authenticated read

- GIVEN RLS enabled with no policies
- WHEN an `authenticated` user (any tenant) issues `SELECT * FROM public.youtubers`
- THEN zero rows MUST be returned (service role bypasses RLS for admin Edge Functions)

### Requirement: Referral Codes Table

The system MUST provide a `public.referral_codes` table linking YouTubers to URL-friendly short codes with configurable discount and commission percentages. `code` MUST be unique; both percentages MUST be 0–100 numeric(5,2).

#### Scenario: Unique code

- GIVEN two existing codes `PROMO10` and `PROMO10` (same value)
- WHEN the second insert is attempted
- THEN the insert MUST fail with unique violation `23505`

#### Scenario: Percentage bounds

- GIVEN an attempted insert with `discount_pct = 150`
- WHEN the row is created
- THEN the insert MUST fail with a check-constraint violation (`discount_pct <= 100`)

### Requirement: Workshop Referrals Attribution Table

The system MUST provide a `public.workshop_referrals` table where `workshop_id` is the PRIMARY KEY (one attribution per workshop, ever) and stores a non-nullable `referral_code_id`, `youtuber_id`, and `attributed_at` timestamp. Self-referral is blocked at the trigger layer (see Security domain).

#### Scenario: One row per workshop

- GIVEN workshop A has an existing row in `workshop_referrals`
- WHEN the trigger attempts to insert a second row for workshop A
- THEN the insert MUST fail with primary-key violation

#### Scenario: Schema contract

- GIVEN the migration is applied
- WHEN inspected
- THEN the table MUST include `workshop_id uuid PRIMARY KEY REFERENCES workshops(id) ON DELETE CASCADE`, `referral_code_id uuid NOT NULL`, `youtuber_id uuid NOT NULL`, `attributed_at timestamptz NOT NULL DEFAULT now()`
- AND RLS MUST be enabled

### Requirement: Referral Commissions Ledger

The system MUST provide a `public.referral_commissions` ledger row per successful referred payment, with `provider_payment_id` UNIQUE to enforce webhook idempotency. Each row MUST capture the snapshot of `payment_amount`, `commission_pct`, and `commission_amount` (not derived at read time).

#### Scenario: Duplicate payment idempotency

- GIVEN a row with `provider_payment_id = 'mp_pay_123'` exists
- WHEN a second insert with the same `provider_payment_id` is attempted
- THEN the insert MUST fail with `23505` and the caller MUST log "already recorded" and return success

#### Scenario: Required fields

- GIVEN a successful insert
- WHEN the row is read back
- THEN it MUST include `workshop_id`, `youtuber_id`, `referral_code_id`, `subscription_id`, `provider_payment_id`, `payment_amount`, `commission_pct`, `commission_amount`, `currency`, `occurred_at`, `created_at`

#### Scenario: Schema contract

- GIVEN the migration is applied
- WHEN inspected
- THEN the table MUST include indexes on `youtuber_id` and `workshop_id`
- AND RLS MUST be enabled with no policies

### Requirement: Subscription Discount Columns

The system MUST add `first_period_discount_pct numeric(5,2) NULL` and `referred_by_referral_code_id uuid NULL REFERENCES public.referral_codes(id)` to the existing `public.subscriptions` table. The `first_period_discount_pct` is preserved for audit after the first period completes.

#### Scenario: Nullable columns

- GIVEN existing `subscriptions` rows
- WHEN the ALTER TABLE migration runs
- THEN all existing rows MUST have `first_period_discount_pct = NULL` and `referred_by_referral_code_id = NULL`

### Requirement: Migration-Level RLS/Schema Tests

Each new migration MUST include a `DO $$ ... RAISE EXCEPTION` block that fails the migration if RLS is not enabled, if policies leak to `authenticated`, or if FK constraints are missing.

#### Scenario: RLS enabled assertion

- GIVEN the migration is executed in a test environment
- WHEN the assertion block runs
- THEN it MUST raise if `pg_class.relrowsecurity` is false for `youtubers`, `referral_codes`, `workshop_referrals`, or `referral_commissions`

---

## Domain: Referral Attribution at Signup

### Purpose

Bind a workshop to a YouTuber exactly once at signup, based on a referral code captured from the landing URL. Codes are validated case-insensitively against `referral_codes`; unknown / inactive codes are silently ignored (no UX error, but logged for admin visibility).

### Requirements

### Requirement: Referral Code Capture in Signup

The system MUST accept a `referral_code` key in `raw_user_meta_data` passed to `supabase.auth.signUp` and persist it into `public.workshop_referrals` (with a join to `referral_codes` and `youtubers`) inside the existing `handle_new_user` trigger.

#### Scenario: Valid code stamps attribution

- GIVEN a `referral_codes` row with `code = 'PROMO20'`, `youtuber_id = Y1`, `is_active = true`
- WHEN a new auth user signs up with `raw_user_meta_data->>'referral_code' = 'promo20'`
- THEN `handle_new_user` MUST create the workshop and profile
- AND MUST insert one row into `workshop_referrals` with `referral_code_id = R1`, `youtuber_id = Y1`, `workshop_id = NEW workshop`

#### Scenario: Case-insensitive match

- GIVEN the code `PROMO20` is stored uppercased
- WHEN a user signs up with `promo20` or `ProMo20`
- THEN the lookup MUST resolve to the same row (via `LOWER(code) = LOWER(input)`)

#### Scenario: Unknown code silently ignored

- GIVEN no row in `referral_codes` matches `INVALIDX`
- WHEN a user signs up with `referral_code = 'INVALIDX'`
- THEN no row is inserted into `workshop_referrals`
- AND the trigger MUST log a warning at `WARN` level with `code_attribution_skipped`
- AND the signup MUST complete normally (no error to the user)

#### Scenario: Inactive code silently ignored

- GIVEN a `referral_codes` row with `is_active = false`
- WHEN a user signs up with that code
- THEN no row is inserted into `workshop_referrals`
- AND the trigger MUST log `code_attribution_skipped` with reason `inactive`

### Requirement: Self-Referral Prevention

The trigger MUST NOT attribute a workshop to a YouTuber whose `contact_email` matches the signing-up user's email (case-insensitive). The check MUST run before the `workshop_referrals` insert and MUST silently skip attribution (no error to the user).

#### Scenario: Same email blocks attribution

- GIVEN a `youtubers` row with `contact_email = 'promo@example.com'` and an active code
- WHEN a new auth user signs up with `email = 'Promo@Example.com'` and the matching code
- THEN the trigger MUST NOT insert into `workshop_referrals`
- AND the trigger MUST log `code_attribution_skipped` with reason `self_referral`

#### Scenario: Different email allowed

- GIVEN the same YouTuber
- WHEN a new user signs up with `email = 'workshop@example.com'` and the YouTuber's code
- THEN attribution MUST proceed normally

### Requirement: LoginPage Captures URL Referral Code

The `LoginPage` MUST read the `?ref=CODE` query param via `useSearchParams` and pass it as `referral_code` in the metadata object passed to `signUpWithEmail`. When no `?ref` is present, the metadata MUST NOT include `referral_code`.

#### Scenario: URL with ref populates metadata

- GIVEN the user visits `/login?ref=PROMO20`
- WHEN the registration form is submitted
- THEN the metadata object passed to `signUpWithEmail` MUST include `referral_code: 'PROMO20'`

#### Scenario: URL without ref leaves metadata clean

- GIVEN the user visits `/login` (no query string)
- WHEN the registration form is submitted
- THEN the metadata object MUST NOT include a `referral_code` key

---

## Domain: First-Period Discount

### Purpose

Apply the code's `discount_pct` to the first MP preapproval only. Subsequent periods revert to full ARS 4,990 because the preapproval `transaction_amount` is set once and never mutated. The discount is computed in the Edge Function (no MercadoPago coupon).

### Requirements

### Requirement: Discount Computation on First Preapproval

The `create-subscription` Edge Function MUST read the active `workshop_referrals` row for the caller, look up the code's `discount_pct` and `is_active`, and compute `discounted_amount = round(4990 * (1 - discount_pct / 100), 2)` only when (a) attribution exists, (b) the code is active, (c) the workshop has no prior preapproval. The discounted amount is sent as `auto_recurring.transaction_amount` to MercadoPago.

#### Scenario: Referred workshop first preapproval is discounted

- GIVEN a workshop with an active `workshop_referrals` row pointing to a code with `discount_pct = 20`
- AND the workshop has no `provider_preapproval_id`
- WHEN the Edge Function calls `createPreapproval`
- THEN the `auto_recurring.transaction_amount` MUST be `3992` (round(4990 * 0.80, 2))

#### Scenario: Unreferred workshop gets full price

- GIVEN a workshop with no `workshop_referrals` row
- WHEN the Edge Function calls `createPreapproval`
- THEN the `auto_recurring.transaction_amount` MUST be `4990`

#### Scenario: Inactive code is ignored

- GIVEN the referral row exists but the linked `referral_codes.is_active = false`
- WHEN the Edge Function computes the discount
- THEN the full price `4990` MUST be used and the function MUST log `discount_skipped` reason `code_inactive`

### Requirement: Persist Discount on Subscriptions Row

The Edge Function MUST write `first_period_discount_pct` and `referred_by_referral_code_id` on the upserted `subscriptions` row so the tenant UI can show the discount and the webhook can later cross-reference the code.

#### Scenario: Discount recorded on first preapproval

- GIVEN a discounted preapproval is created for a referred workshop
- WHEN the `subscriptions` row is upserted
- THEN `first_period_discount_pct` MUST equal the code's `discount_pct` (e.g. `20.00`)
- AND `referred_by_referral_code_id` MUST equal the code's id

#### Scenario: Unreferred preapproval leaves columns null

- GIVEN the workshop has no attribution
- WHEN the subscription is upserted
- THEN `first_period_discount_pct` MUST remain `NULL`
- AND `referred_by_referral_code_id` MUST remain `NULL`

### Requirement: No Discount on Subsequent Periods

The Edge Function MUST NOT modify an existing preapproval's `transaction_amount`. When a workshop already has a `provider_preapproval_id` and `status != 'cancelled'`, the function returns the existing checkout URL with no discount math applied.

#### Scenario: Reuse existing preapproval

- GIVEN a workshop with an existing `provider_preapproval_id` and `status = 'active'`
- WHEN the Edge Function is called again
- THEN it MUST look up the preapproval via `getPreapproval` and return its `init_point`
- AND MUST NOT call `createPreapproval` again

---

## Domain: Commission Recording on Webhook

### Purpose

When MercadoPago reports a successful authorized payment for a referred workshop, record an immutable commission row in our ledger. Idempotency is enforced by a unique index on `provider_payment_id`.

### Requirements

### Requirement: Commission Insert on Authorized Payment

The `mercadopago-webhook` Edge Function MUST, on the `authorized_payment` branch, after the subscription update, lookup the `workshop_referrals` row, and if attribution exists AND the payment status is `approved`, INSERT into `referral_commissions` with `payment_amount`, `commission_pct` (from the current active code), and `commission_amount = round(payment_amount * commission_pct / 100, 2)`.

#### Scenario: Approved payment records commission

- GIVEN a workshop with active attribution to code `PROMO20` (commission_pct = 15)
- AND the authorized_payment status is `approved`
- AND the payment amount is `4990`
- WHEN the webhook processes the event
- THEN a `referral_commissions` row MUST be inserted with `payment_amount = 4990`, `commission_pct = 15.00`, `commission_amount = 748.50` (round(4990 * 0.15, 2))

#### Scenario: Discounted first payment also records commission

- GIVEN the first-period discount applied (`transaction_amount = 3992`)
- AND the payment is `approved`
- WHEN the webhook processes the event
- THEN a commission row MUST be inserted with `payment_amount` matching the actual paid amount (`3992`)
- AND the YouTuber MUST earn commission on the discounted amount (per proposal decision #1: commission from first payment)

#### Scenario: Unreferred workshop skips commission

- GIVEN a workshop with no `workshop_referrals` row
- WHEN the authorized_payment branch runs
- THEN no insert into `referral_commissions` MUST occur
- AND the webhook MUST continue normally

#### Scenario: Failed payment does not record commission

- GIVEN a workshop with attribution
- AND the authorized_payment status is NOT `approved` (e.g. `rejected`, `cancelled`)
- WHEN the webhook processes the event
- THEN no `referral_commissions` row MUST be inserted

### Requirement: Webhook Idempotency

The webhook MUST catch unique-violation error `23505` on `referral_commissions.provider_payment_id` and treat it as a successful no-op (return HTTP 200, log "already recorded").

#### Scenario: Duplicate webhook ignored

- GIVEN a commission row already exists for `provider_payment_id = 'mp_pay_123'`
- WHEN the webhook is redelivered (MercadoPago retry)
- THEN the insert MUST fail with `23505`
- AND the webhook MUST return HTTP 200
- AND a log line `commission_already_recorded` MUST be written

### Requirement: Preapproval / Payment Branches Skip Commission

Only the `authorized_payment` branch records commissions. `preapproval` and `payment` branches MUST update subscription state only and MUST NOT touch `referral_commissions`.

#### Scenario: preapproval.updated does not record commission

- GIVEN a `preapproval.updated` event for a referred workshop
- WHEN the webhook processes it
- THEN no insert into `referral_commissions` MUST occur
- AND the subscription `status` MUST still be updated per the existing flow

---

## Domain: Admin Referral APIs (Edge Functions)

### Purpose

Expose platform-admin-only Edge Functions for YouTuber CRUD, code management, and commission reporting. All endpoints MUST use `requirePlatformAdmin` (SDD-9 precedent) and run with the service role.

### Requirements

### Requirement: admin-youtubers Endpoint

The `admin-youtubers` Edge Function MUST accept `POST` with optional `{ search?, youtuberId? }` and return a list of YouTubers (or detail of one) with aggregated `codeCount`, `activeReferredWorkshops`, and `lifetimeCommission`. All reads MUST use the service role client.

#### Scenario: List returns aggregated stats

- GIVEN 3 YouTubers in the database
- WHEN `POST /functions/v1/admin-youtubers { search: "PRO" }` is called by a platform admin
- THEN the response MUST include each matching YouTuber with `codeCount`, `activeReferredWorkshops` (count of distinct `workshop_referrals.workshop_id` for active subscriptions), and `lifetimeCommission` (sum of `referral_commissions.commission_amount` for that youtuber_id)

#### Scenario: Non-admin rejected

- GIVEN a request from a user whose `profiles.is_platform_admin = false`
- WHEN the endpoint is called
- THEN the response MUST be HTTP 403 with error code `admin_auth_failed`

### Requirement: admin-youtube-mutate Endpoint

The `admin-youtube-mutate` Edge Function MUST accept `POST` with `{ action: "create" | "update" | "toggle", ... }` and persist the change. `toggle` flips `is_active`. Field validation MUST run before insert/update (display_name required, contact_email must be a valid email if present).

#### Scenario: Create a YouTuber

- GIVEN a platform admin and valid `{ action: "create", display_name: "Canal Madera", contact_email: "madera@example.com" }`
- WHEN the endpoint is called
- THEN a new row MUST be inserted with `is_active = true`
- AND the response MUST include the new `id`

#### Scenario: Toggle deactivates a YouTuber

- GIVEN an active YouTuber
- WHEN `{ action: "toggle", id, isActive: false }` is sent
- THEN `is_active` MUST be updated to `false`
- AND the response MUST confirm the new state

### Requirement: admin-referral-codes Endpoint

The `admin-referral-codes` Edge Function MUST accept `POST` with `{ action: "list" | "create" | "deactivate", youtuberId?, code?, discountPct?, commissionPct? }`. `list` returns codes grouped by YouTuber; `create` validates `0 <= discount_pct, commission_pct <= 100` and `code` is unique case-insensitively (treated as `LOWER(code)`).

#### Scenario: Create code with valid percentages

- GIVEN a YouTuber and `{ action: "create", youtuberId, code: "PROMO20", discountPct: 20, commissionPct: 15 }`
- WHEN the endpoint is called
- THEN a `referral_codes` row MUST be inserted
- AND the response MUST include the new `id`

#### Scenario: Duplicate code rejected

- GIVEN a code `PROMO20` already exists
- WHEN a second `create` with `code: "PROMO20"` (any case) is sent
- THEN the endpoint MUST return HTTP 409 with error code `referral_code_conflict`

#### Scenario: Out-of-range percentage rejected

- GIVEN `{ discountPct: 150 }`
- WHEN the endpoint runs
- THEN it MUST return HTTP 400 with error code `referral_code_invalid_percentage`

### Requirement: admin-referral-commissions Endpoint

The `admin-referral-commissions` Edge Function MUST accept `POST` with `{ youtuberId?, fromDate?, toDate?, limit? }` and return a filterable list of commission rows with joined YouTuber display_name, code, workshop name, payment amount, commission amount, currency, and `occurred_at`. MUST support CSV export (response shape with `format: "csv"`).

#### Scenario: Filter by YouTuber

- GIVEN 100 commission rows for 5 YouTubers
- WHEN `{ youtuberId: "Y1" }` is sent
- THEN the response MUST include only rows where `youtuber_id = Y1`

#### Scenario: CSV export

- GIVEN at least one commission row
- WHEN `{ format: "csv" }` is sent
- THEN the response MUST be `text/csv` with header row `occurred_at,youtuber,code,workshop,payment_amount,commission_amount,currency`

#### Scenario: Date range filter

- GIVEN commissions in Jan, Feb, Mar 2026
- WHEN `{ fromDate: "2026-02-01", toDate: "2026-02-28" }` is sent
- THEN the response MUST include only Feb rows

---

## Domain: Admin Referrals UI

### Purpose

Surface the admin APIs in `/admin/referidos` with two tabs: Youtubers (CRUD) and Commissions (filter + CSV). Reuse SDD-10 patterns (`useSort`, `ConfirmDialog`, `useAdminActions`).

### Requirements

### Requirement: Referidos Route Registration

The system MUST add `{ to: "/admin/referidos", label: "Referidos", icon: "fi-rr-megaphone" }` to `ADMIN_NAV_ITEMS` and a `ReferidosPage` route to `src/features/admin/routes.tsx`. The route MUST be lazy-loaded like other admin routes and protected by `AdminGuard`.

#### Scenario: Nav item visible to platform admin

- GIVEN a platform admin on `/admin`
- WHEN the sidebar renders
- THEN a "Referidos" link MUST appear between Billing and Soporte

#### Scenario: Nav item hidden from non-admin

- GIVEN a non-admin authenticated user
- WHEN the admin layout renders
- THEN the link MUST NOT be visible and `/admin/referidos` MUST redirect to `/`

### Requirement: Youtubers Tab

The Youtubers tab MUST show a table of YouTubers with columns: Display name, Channel URL, Contact email, Codes, Active referred workshops, Lifetime commission (ARS), Active toggle. MUST include "Crear YouTuber" and per-row edit actions.

#### Scenario: Table renders aggregated stats

- GIVEN 3 YouTubers with associated commissions
- WHEN the Youtubers tab is loaded
- THEN each row MUST show `codeCount`, `activeReferredWorkshops`, and `lifetimeCommission` (formatted ARS with thousands separator)

#### Scenario: Deactivate confirmation

- GIVEN an active YouTuber
- WHEN the admin clicks the active toggle
- THEN a `ConfirmDialog` MUST appear with copy "Desactivar este YouTuber? Los códigos nuevos no podrán usarlo."
- AND on confirm the toggle MUST call `admin-youtube-mutate`

### Requirement: Commissions Tab

The Commissions tab MUST show a filterable table with columns: Date, YouTuber, Code, Workshop, Payment amount, Commission amount, Currency. MUST include date range pickers, a YouTuber filter, and a "Exportar CSV" button.

#### Scenario: Filter narrows results

- GIVEN 100 commissions across 5 YouTubers
- WHEN the admin selects YouTuber "Canal Madera" from the filter
- THEN the table MUST re-query with `{ youtuberId }` and display only matching rows

#### Scenario: CSV download triggers file save

- GIVEN at least one commission
- WHEN the admin clicks "Exportar CSV"
- THEN the browser MUST receive `text/csv` with content-disposition `attachment` filename `referral-commissions-YYYY-MM-DD.csv`

---

## Domain: Tenant Discount Display

### Purpose

Show tenants the first-period discount message in their billing card. The message MUST NOT mention the YouTuber (privacy) — only the percentage and duration.

### Requirements

### Requirement: First-Period Discount Message

The `BillingSettingsCard` MUST, when `subscription.first_period_discount_pct` is non-null and the current period is the first one (i.e. `current_period_starts_at >= subscription.created_at`), render a small note "Descuento aplicado: X% durante el primer período."

#### Scenario: Discount visible during first period

- GIVEN a subscription with `first_period_discount_pct = 20.00` and `current_period_starts_at` equal to `created_at`
- WHEN the billing card renders
- THEN a line MUST appear reading "Descuento aplicado: 20% durante el primer período."
- AND the line MUST appear in all subscription states that render details (trialing, active, past_due)

#### Scenario: Discount hidden from second period onward

- GIVEN a subscription where `current_period_starts_at` is after `created_at + 1 month`
- WHEN the billing card renders
- THEN the discount line MUST NOT appear
- AND the displayed "Próximo cargo" MUST show ARS 4,990 (full price)

#### Scenario: Unreferred subscription has no discount line

- GIVEN `first_period_discount_pct IS NULL`
- WHEN the card renders
- THEN no discount line MUST be shown

---

## Domain: Security & Self-Referral Prevention

### Purpose

Enforce the project multi-tenant rule (every table `workshop_id`) and the SDD-9 platform-global exception for YouTuber/commission tables. All access is via admin Edge Functions; no `authenticated` policy exists on these tables.

### Requirements

### Requirement: No Authenticated Policy on Platform-Global Tables

The system MUST NOT add `FOR SELECT` or `FOR INSERT` policies to `youtubers`, `referral_codes`, `referral_commissions`, or `workshop_referrals` for the `authenticated` role. RLS MUST remain enabled so the service role is required.

#### Scenario: RLS denies client SELECT

- GIVEN an `authenticated` user (any tenant) and RLS enabled with no policies
- WHEN the user issues `SELECT * FROM public.referral_codes` from the browser
- THEN zero rows MUST be returned

#### Scenario: Service role bypasses RLS

- GIVEN an Edge Function using `serviceClient()`
- WHEN it issues `SELECT * FROM public.referral_codes`
- THEN ALL rows MUST be returned (service role bypasses RLS)

### Requirement: Admin Access via Edge Functions Only

All browser-initiated reads/writes of YouTubers, codes, and commissions MUST flow through `admin-youtubers`, `admin-youtube-mutate`, `admin-referral-codes`, or `admin-referral-commissions` — each of which MUST call `requirePlatformAdmin` first.

#### Scenario: Frontend never imports platform-global tables

- GIVEN the `src/features/admin/api/` directory
- WHEN inspected with `grep`
- THEN no `from("youtubers")`, `from("referral_codes")`, `from("referral_commissions")`, or `from("workshop_referrals")` calls MUST appear outside of typed API wrappers that POST to the admin Edge Functions

### Requirement: Self-Referral Backend Validation

The `handle_new_user` trigger MUST compare the new user's `auth.email` (case-insensitive) against the matched YouTuber's `contact_email` (case-insensitive). On match, the trigger MUST skip the `workshop_referrals` insert, log `self_referral_blocked`, and continue creating the workshop and profile normally.

#### Scenario: Self-referral blocked before insert

- GIVEN YouTuber `Y1` with `contact_email = 'a@b.com'` and an active code
- WHEN a new user signs up with `email = 'A@B.COM'` and `referral_code = 'CODE1'`
- THEN `workshop_referrals` MUST NOT contain a row for the new workshop
- AND the user MUST be created normally (workshop + profile)

#### Scenario: Email not exposed to tenant

- GIVEN a tenant inspecting their own subscription
- WHEN the billing API responds
- THEN the response MUST NOT include the YouTuber's email, channel URL, or payout method

---

## Test & Verification Requirements

### Requirements

### Requirement: SQL/RLS Tests

Each new migration MUST include a `DO $$ ... RAISE EXCEPTION` block that fails the migration if RLS is not enabled, if policies leak to `authenticated`, or if FK constraints are missing.

#### Scenario: RLS enabled assertion

- GIVEN the migration is executed in a test environment
- WHEN the assertion block runs
- THEN it MUST raise if `pg_class.relrowsecurity` is false for `youtubers`, `referral_codes`, `workshop_referrals`, or `referral_commissions`

### Requirement: Frontend Component Tests

All new frontend referral behavior MUST be covered by Vitest + Testing Library tests.

#### Scenario: Admin referral UI tests

- GIVEN the new admin ReferidosPage and CommissionsTab components
- WHEN rendered with mocked data
- THEN tests MUST assert correct column rendering, filter behavior, CSV download, and deactivation confirmation

#### Scenario: Discount message tests

- GIVEN mocked subscription states with and without first_period_discount_pct
- WHEN the BillingSettingsCard renders
- THEN tests MUST assert the discount line appears only during the first period

### Requirement: Pure Function Unit Tests

Discount computation, commission computation, and commission record building MUST be extracted as pure functions and tested in isolation.

#### Scenario: computeSubscriptionAmount coverage

- GIVEN the pure function `computeSubscriptionAmount(baseAmount, referralInfo)`
- WHEN tested with referred/discounted, unreferred/full-price, and inactive-code cases
- THEN the returned amount MUST match the expected value and discountApplied flag

#### Scenario: computeCommissionAmount coverage

- GIVEN the pure function `computeCommissionAmount(paymentAmount, commissionPct)`
- WHEN tested with full and discounted amounts
- THEN the returned commission_amount MUST match `round(paymentAmount * commissionPct / 100, 2)`

---

## Domain: Schema Evolution for Commission Payout

### Purpose

Add structured bank details to YouTubers, track payout status on commissions, and create an audit trail via payout runs — without breaking SDD-11 immutability guarantees.

### Requirements

### Requirement: YouTuber Bank Details

The system MUST add structured bank columns to `public.youtubers`: `payout_cbu text`, `payout_cvu text`, `payout_alias text`, `payout_bank_name text`, `payout_holder_name text`, `payout_holder_cuit text`. The existing `payout_method` column MUST be kept (deprecated, not dropped). CBU MUST be 22 digits when present; CVU MUST be 23 digits when present; CUIT MUST match format XX-XXXXXXXX-X when present.

#### Scenario: Add bank details to youtuber

- GIVEN a YouTuber with `id = Y1`
- WHEN `admin-youtube-mutate` is called with bank detail fields
- THEN the row MUST be updated with all bank detail columns
- AND the existing `payout_method` column MUST remain unchanged (legacy compatibility)

#### Scenario: CBU validation fails

- GIVEN an update with `payoutCbu = "123"` (only 3 digits, not 22)
- WHEN the mutation runs
- THEN the endpoint MUST return HTTP 400 with error code `invalid_bank_details`
- AND the row MUST NOT be modified

#### Scenario: Partial bank details allowed

- GIVEN an update with only `payoutAlias = "otro.alias.mp"` and no CBU/CVU
- WHEN the mutation runs
- THEN the alias MUST be saved
- AND other bank columns MUST remain unchanged

### Requirement: Commission Payout Status

The system MUST add `status text NOT NULL DEFAULT 'pending'`, `paid_at timestamptz`, `payout_reference text`, and `payout_run_id uuid REFERENCES payout_runs(id) ON DELETE SET NULL` to `public.referral_commissions`. Status MUST have CHECK constraint `status IN ('pending', 'paid', 'cancelled')`. A partial index on `status = 'pending'` MUST exist for fast queries.

#### Scenario: New commission starts as pending

- GIVEN a new commission row inserted via webhook
- WHEN the row is created
- THEN `status` MUST equal `'pending'`
- AND `paid_at` MUST be `NULL`
- AND `payout_run_id` MUST be `NULL`

#### Scenario: Mark commission as paid

- GIVEN a pending commission with `id = C1`
- WHEN `admin-referral-payouts` marks it paid with `payoutRunId = PR1` and `payoutReference = "TRANSFER-123"`
- THEN `status` MUST become `'paid'`
- AND `paid_at` MUST be set to current timestamp
- AND `payout_reference` MUST equal `"TRANSFER-123"`
- AND `payout_run_id` MUST equal `PR1`

#### Scenario: Invalid status rejected

- GIVEN an attempted update with `status = 'partially_paid'`
- WHEN the update runs
- THEN the database MUST reject with check constraint violation

### Requirement: Payout Runs Audit Trail

The system MUST create a `public.payout_runs` table with columns: `id uuid PRIMARY KEY`, `created_by uuid NOT NULL REFERENCES profiles(id)`, `total_amount numeric(12,2) NOT NULL`, `commission_count int NOT NULL`, `reference text`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`. This table MUST NOT include `workshop_id` (global platform data per SDD-9 precedent).

#### Scenario: Create payout run

- GIVEN commissions C1 ($100), C2 ($200), C3 ($150) marked as paid in batch
- WHEN the payout run is created
- THEN `total_amount` MUST equal `450.00`
- AND `commission_count` MUST equal `3`
- AND `created_by` MUST equal the admin's profile ID

#### Scenario: Query payout history

- GIVEN multiple payout runs exist
- WHEN `admin-referral-payouts` queries payout history
- THEN it MUST return runs ordered by `created_at DESC` with aggregated commission details

### Requirement: Migration-Level Validation

Each payout migration MUST include a `DO $$ ... RAISE EXCEPTION` block that fails if RLS is not enabled on the modified tables or if expected columns are missing.

---

## Domain: Payout API (Edge Function)

### Purpose

Expose platform-admin-only endpoints to list pending commissions, execute payouts (single/bulk), and query payout history. All endpoints MUST use `requirePlatformAdmin` and `serviceClient` patterns from SDD-9/SDD-11.

### Requirements

### Requirement: admin-referral-payouts Endpoint

The `admin-referral-payouts` Edge Function MUST accept `POST` requests with different actions based on the request body or query params.

#### Scenario: List pending commissions grouped by YouTuber

- GIVEN pending commissions exist for multiple YouTubers
- WHEN `POST /?action=pending-by-youtuber` is called by platform admin
- THEN the response MUST include an array of YouTubers, each with:
  - `youtuberId`, `displayName`, `totalPendingAmount`, `commissionCount`
  - Array of pending commissions with `id`, `commissionAmount`, `occurredAt`, `workshopName`
- AND the response MUST be ordered by `totalPendingAmount DESC`

#### Scenario: Filter pending by date range

- GIVEN pending commissions from Jan, Feb, Mar 2026
- WHEN `POST /?action=pending-by-youtuber&fromDate=2026-02-01&toDate=2026-02-28` is called
- THEN only Feb commissions MUST be included in totals and lists

#### Scenario: Execute payout (bulk)

- GIVEN pending commissions with IDs `[C1, C2, C3]` totaling $450
- WHEN `POST /` with body `{ action: "mark-paid", commissionIds: ["C1", "C2", "C3"], payoutReference: "TRANSFER-123", notes: "Pago mensual Feb 2026" }` is called
- THEN a new `payout_runs` row MUST be created with `total_amount = 450.00`, `commission_count = 3`, `reference = "TRANSFER-123"`, `notes = "Pago mensual Feb 2026"`
- AND all three commissions MUST be updated: `status = 'paid'`, `paid_at = now()`, `payout_run_id = newRunId`, `payout_reference = "TRANSFER-123"`
- AND the response MUST include the payout run details

#### Scenario: Execute payout (single)

- GIVEN one pending commission C1 with amount $100
- WHEN `POST /` with body `{ action: "mark-paid", commissionIds: ["C1"], payoutReference: "SINGLE-001" }` is called
- THEN a payout run MUST be created with `commission_count = 1`, `total_amount = 100.00`

#### Scenario: Idempotent payout execution

- GIVEN commissions C1, C2 were already marked as paid in a previous run
- WHEN attempting to mark them as paid again with a new reference
- THEN the endpoint MUST return HTTP 409 with error code `commissions_already_paid`
- AND no new payout run MUST be created

#### Scenario: Query payout history

- GIVEN multiple payout runs exist
- WHEN `POST /?action=payout-history&limit=10` is called
- THEN the response MUST include an array of payout runs with:
  - `id`, `createdAt`, `totalAmount`, `commissionCount`, `reference`, `notes`, `createdBy` (admin email)
  - Nested array of commissions with `id`, `commissionAmount`, `youtuberName`, `workshopName`

#### Scenario: Get YouTuber bank details

- GIVEN a YouTuber Y1 with bank details populated
- WHEN `POST /?action=youtuber-bank-details&youtuberId=Y1` is called
- THEN the response MUST include all bank columns: `payoutCbu`, `payoutCvu`, `payoutAlias`, `payoutBankName`, `payoutHolderName`, `payoutHolderCuit`

#### Scenario: Non-admin rejected

- GIVEN a request from a non-platform-admin user
- WHEN any endpoint is called
- THEN the response MUST be HTTP 403 with error code `admin_auth_failed`

### Requirement: Extend admin-youtube-mutate for Bank Details

The existing `admin-youtube-mutate` endpoint MUST accept new fields for bank details in `create` and `update` actions, with validation.

#### Scenario: Create YouTuber with bank details

- GIVEN `POST /` with body `{ action: "create", displayName: "Canal Madera", payoutAlias: "canal.madera", payoutBankName: "Mercado Pago" }`
- WHEN the endpoint runs
- THEN the YouTuber MUST be created with all provided bank details
- AND validation MUST pass (alias format is reasonable)

#### Scenario: Update YouTuber bank details

- GIVEN an existing YouTuber
- WHEN `POST /` with body `{ action: "update", id: "Y1", payoutCbu: "1234567890123456789012" }` is called
- THEN only the CBU MUST be updated, other fields unchanged

#### Scenario: Bank detail validation on write

- GIVEN an update with invalid CBU (21 digits instead of 22)
- WHEN the endpoint runs
- THEN it MUST return HTTP 400 with error code `invalid_bank_details` and details about which field failed

---

## Domain: Admin Referrals UI — Commission Payout

### Purpose

Surface the payout workflow in `/admin/referidos` with visible Commissions tab, stale badge, payout actions, and payout history view.

### Requirements

### Requirement: Mount CommissionsTab in ReferidosPage

The `ReferidosPage` MUST add "Comisiones" to its `TABS` array and render `CommissionsTab` when that tab is active.

#### Scenario: Commissions tab visible

- GIVEN the user navigates to `/admin/referidos`
- WHEN the page loads
- THEN a "Comisiones" tab MUST be visible alongside "YouTubers"

#### Scenario: Switch to Commissions tab

- GIVEN the user is on the YouTubers tab
- WHEN they click "Comisiones"
- THEN the `CommissionsTab` component MUST render
- AND it MUST show the commissions table with filters and CSV export button

### Requirement: Stale Commission Badge

The `CommissionsTab` MUST display a red badge when any pending commission is older than 30 days.

#### Scenario: Stale commissions exist

- GIVEN a pending commission from 45 days ago
- WHEN the Commissions tab renders
- THEN a red badge MUST appear reading "N comisión(s) >30 días pendiente" (or similar)
- AND the badge MUST link to filtered view showing only stale commissions

#### Scenario: No stale commissions

- GIVEN all pending commissions are <30 days old
- WHEN the Commissions tab renders
- THEN no stale badge MUST be shown

### Requirement: PayoutsTab Component

The system MUST create a new `PayoutsTab` component with:

- Table of payout runs: date, total, count, reference, admin
- Expandable rows showing individual commissions
- "Nuevo pago" button opening a modal to select pending commissions

#### Scenario: Payout history visible

- GIVEN existing payout runs
- WHEN the user navigates to the "Pagos" tab (new tab)
- THEN a table MUST show all payout runs ordered by date descending

#### Scenario: Expand payout run details

- GIVEN a payout run with 3 commissions
- WHEN the user clicks the expand arrow on that row
- THEN the 3 commissions MUST be listed with their amounts, YouTubers, and workshops

#### Scenario: Create new payout (modal flow)

- GIVEN pending commissions exist
- WHEN the user clicks "Nuevo pago"
- THEN a modal MUST open showing pending commissions grouped by YouTuber
- AND the user MUST be able to select commissions via checkboxes
- AND a "Confirmar pago" button MUST be disabled until at least one commission is selected
- AND when clicked, it MUST prompt for `payoutReference` and optional `notes`

#### Scenario: Successful payout updates UI

- GIVEN the user just executed a payout for commissions C1, C2
- WHEN the modal closes
- THEN the Payouts tab MUST refresh to show the new payout run
- AND the selected commissions MUST no longer appear in "pending" lists

### Requirement: YouTuberForm Bank Details

The `YoutuberForm` component (used in create/edit) MUST include structured inputs for all bank detail fields with validation.

#### Scenario: Bank fields in create form

- GIVEN the user clicks "Crear YouTuber"
- WHEN the form opens
- THEN inputs MUST be visible for: CBU (22 digits), CVU (23 digits), Alias, Banco, Titular, CUIT
- AND each input MUST show validation errors on blur

#### Scenario: CBU validation message

- GIVEN the user enters "123" in CBU field
- WHEN they blur the field
- THEN an error message MUST appear indicating the CBU must have 22 digits

#### Scenario: Partial save allowed

- GIVEN the user fills only Alias and Bank
- WHEN they submit the form
- THEN the YouTuber MUST be created with those fields
- AND empty CBU/CVU fields MUST be saved as NULL
