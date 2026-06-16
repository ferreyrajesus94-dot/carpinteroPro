# SDD 2 Specification — Billing + MercadoPago MVP

## Domains
- Billing Schema & RLS
- Trial Lifecycle
- MercadoPago Subscription Creation
- Webhook Processing
- Billing Gate
- Settings Billing
- Configuration & Legal Alignment

---

# Domain: Billing Schema & RLS

## Purpose
Persist the billing state of every workshop in a normalized, tenant-isolated table that supports trial tracking, provider linkage, and subscription lifecycle queries.

## Requirements

### Requirement: Subscriptions Table Structure
The system MUST provide a `subscriptions` table that stores one active billing record per workshop.

#### Scenario: Schema contract
- GIVEN the migration `0022_billing_schema.sql` is applied
- WHEN the table definition is inspected
- THEN the table MUST include at minimum:
  - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
  - `workshop_id uuid NOT NULL REFERENCES workshops(id)`
  - `status text NOT NULL` with allowed values: `trialing`, `active`, `past_due`, `unpaid`, `cancelled`
  - `plan text NOT NULL` (e.g., `pro_monthly`)
  - `trial_starts_at timestamptz`
  - `trial_ends_at timestamptz`
  - `current_period_starts_at timestamptz`
  - `current_period_ends_at timestamptz`
  - `provider text NOT NULL` (e.g., `mercadopago`)
  - `provider_subscription_id text`
  - `provider_preapproval_id text`
  - `cancel_at_period_end boolean NOT NULL DEFAULT false`
  - `cancelled_at timestamptz`
  - `created_at timestamptz NOT NULL DEFAULT now()`
  - `updated_at timestamptz NOT NULL DEFAULT now()`
- AND RLS MUST be enabled on the table
- AND there MUST be an index on `workshop_id`
- AND there MUST be an index on `provider_preapproval_id`

### Requirement: Tenant Isolation via RLS
The system MUST prevent cross-tenant access to subscription rows.

#### Scenario: Workshop-scoped SELECT
- GIVEN a subscription row exists for workshop A
- WHEN an authenticated user whose profile maps to workshop A queries `subscriptions`
- THEN the user MUST receive that row

#### Scenario: Cross-tenant SELECT denial
- GIVEN subscription rows exist for workshops A and B
- WHEN an authenticated user whose profile maps to workshop A queries `subscriptions`
- THEN the result set MUST NOT contain rows where `workshop_id` is B

#### Scenario: Direct INSERT denial from client
- GIVEN an authenticated user for workshop A
- WHEN the user attempts to INSERT a subscription row for workshop B via the Supabase client
- THEN the INSERT MUST be denied

### Requirement: SQL-Level Isolation Tests
The system MUST include migration-level assertions or pgTAP tests that prove tenant isolation for the `subscriptions` table.

#### Scenario: Automated SQL assertion
- GIVEN the billing migration includes test SQL
- WHEN the migration is executed in a test environment
- THEN assertions MUST fail if a user can SELECT, INSERT, UPDATE, or DELETE a subscription row belonging to a different workshop

---

# Domain: Trial Lifecycle

## Purpose
Provide a deterministic, auditable 14-day trial that begins when a workshop completes onboarding and gates access when the trial expires.

## Requirements

### Requirement: Trial Start Trigger
The system MUST start the 14-day trial when a user profile’s `onboarded_at` transitions from `NULL` to a non-`NULL` timestamp.

#### Scenario: Onboarding completion creates trial
- GIVEN a workshop with no existing subscription row
- WHEN `profiles.onboarded_at` is set for the workshop’s owner
- THEN a `subscriptions` row MUST be created for that workshop
- AND `status` MUST be set to `trialing`
- AND `trial_starts_at` MUST be set to the current timestamp
- AND `trial_ends_at` MUST be exactly 14 days after `trial_starts_at`

#### Scenario: Idempotent trial creation
- GIVEN a workshop already has a subscription row of any status
- WHEN `profiles.onboarded_at` is updated again
- THEN the system MUST NOT create a second subscription row
- AND the existing trial dates MUST NOT be modified

### Requirement: Trial Expiry Enforcement
The system MUST treat a `trialing` subscription as expired when the current time is strictly greater than `trial_ends_at`.

#### Scenario: Expired trial blocks access
- GIVEN a workshop with `status = trialing` and `trial_ends_at` in the past
- WHEN the billing gate evaluates access
- THEN the workshop MUST be treated as unpaid and blocked from full app access

#### Scenario: Active trial allows access
- GIVEN a workshop with `status = trialing` and `trial_ends_at` in the future
- WHEN the billing gate evaluates access
- THEN the workshop MUST be allowed full app access

---

# Domain: MercadoPago Subscription Creation

## Purpose
Enable workshops to start recurring monthly payments through MercadoPago without exposing provider secrets to the client.

## Requirements

### Requirement: Server-Side Subscription Creation
The system MUST create MercadoPago subscription or preapproval objects exclusively from a Supabase Edge Function using backend credentials.

The system MUST read the active `workshop_referrals` row for the calling workshop, look up the `referral_codes.discount_pct` and `is_active`, and apply a first-period discount to `auto_recurring.transaction_amount` ONLY when (a) attribution exists, (b) the code is active, and (c) the workshop has no prior `provider_preapproval_id`. The discounted amount MUST be `round(4990 * (1 - discount_pct / 100), 2)`.
(Previously: Always created preapproval with `transaction_amount: 4990`.)

#### Scenario: Authenticated user initiates payment
- GIVEN an authenticated user with a workshop that is in trial or unpaid
- WHEN the user requests to start a subscription
- THEN the frontend MUST call a Supabase Edge Function (e.g., `POST /functions/v1/create-subscription`)
- AND the Edge Function MUST derive the `workshop_id` from the authenticated JWT, not from client payload
- AND the Edge Function MUST call the MercadoPago API with the backend access token
- AND the Edge Function MUST create a provider-side recurring preapproval or subscription for ARS 4,990 monthly

#### Scenario: Referred workshop first preapproval is discounted
- GIVEN a workshop with an active `workshop_referrals` row to a code with `discount_pct = 20`
- AND the workshop has no `provider_preapproval_id`
- WHEN the Edge Function calls `createPreapproval`
- THEN the `auto_recurring.transaction_amount` MUST be `3992` (round(4990 * 0.80, 2))
- AND the `subscriptions` row MUST be upserted with `first_period_discount_pct = 20.00` and `referred_by_referral_code_id` set

#### Scenario: Inactive referral code is ignored at subscription time
- GIVEN the linked `referral_codes.is_active = false`
- WHEN the Edge Function runs
- THEN the full price `4990` MUST be used
- AND a log line `discount_skipped reason=code_inactive` MUST be written

### Requirement: No Secret Exposure
The system MUST NOT embed or expose the MercadoPago access token, webhook secrets, or Supabase service role key in frontend code or environment variables accessible to the browser.

#### Scenario: Client bundle audit
- GIVEN a production build of the application
- WHEN the build output is inspected for strings matching `MERCADOPAGO_ACCESS_TOKEN` or the actual token value
- THEN there MUST be zero matches in client-bundled assets

### Requirement: Subscription Record Linkage
After a successful provider-side creation, the Edge Function MUST persist the provider identifiers in the workshop’s subscription row.

The Edge Function MUST additionally persist `first_period_discount_pct numeric(5,2) NULL` and `referred_by_referral_code_id uuid NULL` on the upserted `subscriptions` row when the preapproval is the first one for the workshop.

#### Scenario: Link provider preapproval
- GIVEN the Edge Function successfully creates a MercadoPago preapproval
- WHEN the function persists state
- THEN the corresponding `subscriptions` row MUST have `provider_preapproval_id` populated
- AND `status` MUST transition to `active` (or remain `trialing` if still within trial and payment method is captured early)
- AND `current_period_starts_at` and `current_period_ends_at` MUST reflect the provider’s billing period

#### Scenario: Discount columns populated on first preapproval
- GIVEN a referred workshop with `discount_pct = 20` and a fresh preapproval
- WHEN the subscription is upserted
- THEN `first_period_discount_pct` MUST equal `20.00`
- AND `referred_by_referral_code_id` MUST equal the code's id

#### Scenario: Discount columns null on subsequent calls
- GIVEN the workshop already has a `provider_preapproval_id` and the function returns the existing checkout URL
- WHEN the response is sent
- THEN `first_period_discount_pct` MUST remain unchanged (not overwritten)

---

# Domain: Webhook Processing

## Purpose
Receive, verify, and idempotently apply MercadoPago event notifications so that subscription state remains accurate despite retries, duplicates, or out-of-order delivery.

## Requirements

### Requirement: Webhook Endpoint
The system MUST expose a Supabase Edge Function endpoint (e.g., `POST /functions/v1/mercadopago-webhook`) that accepts MercadoPago event payloads.

#### Scenario: Event delivery
- GIVEN a MercadoPago event of type `preapproval.updated` or `payment`
- WHEN MercadoPago POSTs the event payload to the endpoint
- THEN the Edge Function MUST respond with HTTP 200 for successfully processed events
- AND with a non-2xx status only for genuine processing failures that warrant a retry

### Requirement: Webhook Verification
The system MUST verify the authenticity of incoming webhook payloads using MercadoPago’s supported signature or secret mechanism.

#### Scenario: Valid signature
- GIVEN a payload with a valid MercadoPago signature header
- WHEN the Edge Function verifies it
- THEN the payload MUST be accepted and processed

#### Scenario: Invalid signature
- GIVEN a payload with a missing or invalid signature
- WHEN the Edge Function verifies it
- THEN the function MUST reject the payload with HTTP 401 or 403 and MUST NOT update any subscription state

### Requirement: Idempotency and Duplicate Handling
The system MUST handle duplicate webhook events without corrupting subscription state.

#### Scenario: Duplicate event ignored
- GIVEN a MercadoPago event with an ID that has already been processed
- WHEN the webhook endpoint receives it again
- THEN the system MUST recognize the duplicate
- AND MUST return HTTP 200 without modifying the subscription row

#### Scenario: Stale event ignored
- GIVEN a webhook event carrying an older provider state than what is already recorded
- WHEN the endpoint processes it
- THEN the system MUST ignore the stale data or reconcile using a fetched current provider state rather than blindly overwriting

### Requirement: State Reconciliation
The system MUST map incoming events to the correct workshop and update the subscription record accurately.

The system MUST, in addition to existing subscription updates, INSERT into `referral_commissions` whenever the `authorized_payment` branch processes an `approved` payment for a referred workshop. The insert MUST be idempotent (unique `provider_payment_id`).

#### Scenario: Payment success activates subscription
- GIVEN a `preapproval.updated` or `payment` event indicating a successful recurring charge
- WHEN the event is processed
- THEN the matching subscription (by `provider_preapproval_id`) MUST have `status` set to `active`
- AND `current_period_starts_at` / `current_period_ends_at` MUST be updated to match the provider period

#### Scenario: Authorized payment records commission
- GIVEN an `authorized_payment` event with `status = approved` for a referred workshop
- AND the code’s `commission_pct = 15`
- WHEN the webhook runs
- THEN a `referral_commissions` row MUST be inserted with `payment_amount`, `commission_pct = 15.00`, and `commission_amount = round(payment_amount * 0.15, 2)`
- AND the response MUST be HTTP 200

#### Scenario: Duplicate authorized payment is ignored
- GIVEN a commission row already exists for the same `provider_payment_id`
- WHEN the webhook is redelivered
- THEN the insert MUST fail with `23505`
- AND the webhook MUST return HTTP 200 with log `commission_already_recorded`

#### Scenario: Preapproval branch does not record commission
- GIVEN a `preapproval.updated` event for a referred workshop
- WHEN the webhook runs
- THEN no insert into `referral_commissions` MUST occur
- AND subscription `status` MUST still be updated per the existing flow

#### Scenario: Payment failure sets past_due
- GIVEN a provider event indicating a failed charge or expired card
- WHEN the event is processed
- THEN the matching subscription MUST have `status` set to `past_due`
- AND the billing gate MUST block full app access

### Requirement: Cross-Tenant Event Safety
The system MUST ensure that a webhook event for one workshop cannot affect another workshop’s subscription.

#### Scenario: Mismatched preapproval ID
- GIVEN a webhook payload referencing a `provider_preapproval_id` not present in the database
- WHEN the event is processed
- THEN the function MUST log the anomaly and return HTTP 200 (to avoid MercadoPago retries) without touching any subscription row

---

# Domain: Billing Gate

## Purpose
Enforce the approved product decision that unpaid or expired workshops receive billing-only access plus logout/support, with no full app or read-only app access.

## Requirements

### Requirement: App Shell Billing Check
The system MUST evaluate billing status after authentication and onboarding checks in the application shell.

#### Scenario: Active trial or paid access
- GIVEN a user is authenticated and onboarded
- AND the workshop subscription status is `trialing` with `trial_ends_at` in the future, OR `active`
- WHEN the app shell renders
- THEN the user MUST be routed to the full application layout and all permitted features

#### Scenario: Expired trial or unpaid access blocked
- GIVEN a user is authenticated and onboarded
- AND the workshop subscription status is `past_due`, `unpaid`, or `trialing` with `trial_ends_at` in the past
- WHEN the app shell renders or the user navigates to any app route
- THEN the user MUST be redirected to a dedicated billing screen
- AND MUST NOT be able to view or interact with quotes, clients, projects, or dashboard data

### Requirement: Blocked-State UX Boundaries
The billing-only screen MUST provide subscription status, a primary action to start or fix payment, and links to logout and support. It MUST NOT expose workshop business data.

#### Scenario: Blocked user attempts data access
- GIVEN a blocked workshop user on the billing screen
- WHEN the user manually enters a URL for a quote or client route
- THEN the app MUST redirect back to the billing screen
- AND MUST NOT load or render any business data from those routes

#### Scenario: Settings accessibility for blocked users
- GIVEN a blocked workshop user
- WHEN the user navigates to `/settings` or a billing sub-route
- THEN the settings page MAY be accessible only for the purpose of managing billing and account
- AND MUST NOT expose other workshop configuration that could leak business data

### Requirement: Immediate Gate at Trial End
The system MUST apply the gate immediately when the trial period ends; there MUST be no automatic grace period.

#### Scenario: Clock passes trial end
- GIVEN a workshop in `trialing` status with `trial_ends_at` set to `2026-05-25T00:00:00Z`
- WHEN the current time is `2026-05-25T00:00:01Z`
- THEN the workshop MUST be blocked from full app access

---

# Domain: Settings Billing

## Purpose
Allow workshop owners to view subscription status, initiate payment, and request cancellation from within the application settings.

## Requirements

### Requirement: Billing Status Display
The settings page MUST include a billing section that surfaces the current subscription state.

#### Scenario: Display trial status
- GIVEN a workshop with `status = trialing`
- WHEN the user opens the billing settings section
- THEN the UI MUST display the trial end date and a prompt to start payment before expiration

#### Scenario: Display active status
- GIVEN a workshop with `status = active`
- WHEN the user opens the billing settings section
- THEN the UI MUST display the current period dates and the next charge amount (ARS 4,990)

#### Scenario: Display blocked status
- GIVEN a workshop with `status = past_due` or `unpaid`
- WHEN the user opens the billing settings section
- THEN the UI MUST clearly indicate that payment is required to restore access

### Requirement: Start Payment Action
The billing section MUST provide a way to initiate a MercadoPago recurring subscription.

#### Scenario: User starts subscription
- GIVEN a workshop in trial or unpaid
- WHEN the user clicks the start-subscription action
- THEN the frontend MUST invoke the server-side creation Edge Function
- AND upon success MUST redirect the user to the MercadoPago checkout or preapproval flow

### Requirement: Cancellation Action
The system MUST support cancellation. When MercadoPago supports period-end cancellation cleanly, the system SHOULD cancel at period end.

#### Scenario: Period-end cancellation
- GIVEN a workshop with `status = active` and `cancel_at_period_end = false`
- WHEN the user requests cancellation and the provider supports period-end cancellation
- THEN the system MUST set `cancel_at_period_end = true`
- AND MUST notify the provider to cancel at period end
- AND the UI MUST indicate the final access date

#### Scenario: Immediate cancellation fallback
- GIVEN the provider does not support period-end cancellation cleanly
- WHEN the user requests cancellation
- THEN the system MUST cancel immediately
- AND MUST set `status = cancelled` and `cancelled_at = now()`
- AND MUST block full app access immediately

---

# Domain: Configuration & Legal Alignment

## Purpose
Ensure environment secrets, pricing constants, and legal copy accurately reflect the implemented billing behavior.

## Requirements

### Requirement: Environment Variables
The system MUST document and require all billing-related secrets and configuration values.

#### Scenario: Env example completeness
- GIVEN `.env.example`
- WHEN it is inspected
- THEN it MUST include:
  - `VITE_MERCADOPAGO_PUBLIC_KEY` (if frontend SDK initialization needs it)
  - `MERCADOPAGO_ACCESS_TOKEN`
  - `MERCADOPAGO_WEBHOOK_SECRET` (or equivalent signature verification material)
  - `SUPABASE_SERVICE_ROLE_KEY` (for Edge Function admin operations)
  - Any Supabase Function-specific secrets required for deployment

### Requirement: Price Authority
The system MUST keep ARS 4,990/month as the visible MVP price in application copy, while treating the MercadoPago plan or preapproval configuration as the operational source for actual charges.

#### Scenario: Pricing copy consistency
- GIVEN the landing page, ROI calculator, and settings billing section
- WHEN any monthly price is displayed
- THEN it MUST read ARS 4,990
- AND MUST match the price configured in the MercadoPago recurring plan or preapproval request

### Requirement: Legal Copy Alignment
The terms and privacy pages MUST accurately describe the implemented trial, billing, cancellation, and processor behavior.

#### Scenario: Terms accuracy
- GIVEN `src/features/legal/pages/TermsPage.tsx`
- WHEN its text is reviewed against the implemented behavior
- THEN it MUST state that the 14-day trial begins upon onboarding completion
- AND it MUST describe monthly automatic billing via MercadoPago
- AND it MUST describe cancellation via the settings billing section (or provider dashboard if fallback)

#### Scenario: Privacy accuracy
- GIVEN `src/features/legal/pages/PrivacyPage.tsx`
- WHEN its text is reviewed
- THEN it MUST list MercadoPago as the payment processor
- AND it MUST describe subscription contract data as a legal basis for processing if applicable

---

# Test & Verification Requirements

## Requirements

### Requirement: Frontend Unit Tests
All new frontend billing behavior MUST be covered by Vitest + Testing Library tests.

#### Scenario: Billing gate tests
- GIVEN mocked subscription states (trialing future, trialing expired, active, past_due, unpaid)
- WHEN the AppLayout or billing gate component renders under each state
- THEN tests MUST assert correct routing/access decisions and screen content

#### Scenario: Settings billing UI tests
- GIVEN mocked subscription states and handlers for start/cancel actions
- WHEN the settings billing section renders
- THEN tests MUST assert that status text, dates, and action buttons appear correctly for each state

### Requirement: SQL/RLS Tests
The billing migration MUST include assertions proving schema correctness and tenant isolation.

#### Scenario: Migration-level assertions
- GIVEN the numeric migration `0022_billing_schema.sql`
- WHEN it is executed in a test/CI database
- THEN it MUST include assertions (e.g., `DO $$ BEGIN ... END $$`) that:
  - Fail if `subscriptions` lacks `workshop_id`
  - Fail if RLS is disabled
  - Fail if a test role can SELECT across workshops
  - Fail if a non-service-role client can INSERT directly into subscriptions for another workshop

### Requirement: Webhook Verification Checklist
Because automated end-to-end webhook testing against MercadoPago may be impractical in local/unit environments, the system MUST include a manual verification checklist.

#### Scenario: Webhook smoke test
- GIVEN a staging deployment with MercadoPago sandbox
- WHEN the checklist is executed
- THEN it MUST verify:
  - Event delivery reaches the Edge Function
  - Valid signatures are accepted and invalid signatures are rejected
  - Duplicate event IDs do not double-update state
  - Subscription status changes match the expected provider transitions

---

# Phase Result Envelope (Spec)

| Field | Value |
|---|---|
| **status** | `spec_complete` |
| **executive_summary** | Defined OpenSpec-style requirements and scenarios for Billing + MercadoPago MVP across seven domains: schema/RLS, trial lifecycle, MercadoPago server-side creation, webhook processing, billing gate, settings billing, and config/legal alignment. All requirements use RFC 2119 keywords and include testable Given/When/Then scenarios covering cross-tenant isolation, duplicate/stale webhooks, trial expiry, period-end cancellation, and blocked UX boundaries. |
| **artifacts** | `openspec/changes/sdd-2-billing-mercadopago/spec.md` |
| **next_recommended** | `design` — identify work units, commit boundaries, and rollback plan; then `tasks` to break into reviewable PRs under the 400-line budget. |
| **risks** | Webhook verification may require manual checklist due to external provider dependency. Full implementation likely exceeds 400 changed lines; stacked PRs required. Legal copy must stay aligned during implementation. MercadoPago API specifics (signature method, period-end cancellation) need confirmation before apply. |
| **skill_resolution** | `none` |
