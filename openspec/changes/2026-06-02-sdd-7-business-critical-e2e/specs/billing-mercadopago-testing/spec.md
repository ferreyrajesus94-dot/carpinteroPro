# Delta for Billing-MercadoPago Testing

## Base Canonical Spec

`openspec/specs/sdd-2-billing-mercadopago/spec.md`

## ADDED Requirements

### Requirement: Billing Gate Browser E2E Regression

The system MUST include a Playwright E2E test that proves the billing gate evaluates real subscription state in a browser, not only mocked unit-test state.

#### Scenario: Active trial allows full app access in browser

- GIVEN a test user with an active trial subscription (`status = trialing`, `trial_ends_at` in the future)
- WHEN the user logs in through the real auth flow in a browser
- THEN the app shell MUST render the full dashboard layout
- AND the user MUST be able to navigate to a protected route (e.g., `/quotes`) without redirection to billing

#### Scenario: Expired trial blocks access in browser

- GIVEN a test user with an expired trial subscription (`status = trialing`, `trial_ends_at` in the past)
- WHEN the user logs in through the real auth flow in a browser
- THEN the app MUST redirect to the billing screen
- AND the user MUST NOT be able to view quote, client, or inventory data by manually entering URLs

#### Scenario: Past-due status blocks access in browser

- GIVEN a test user with `status = past_due`
- WHEN the user logs in through the real auth flow in a browser
- THEN the app MUST redirect to the billing screen
- AND the billing screen MUST display a payment-required message

### Requirement: Subscription State Persistence Integration Test

The system MUST include an integration test that proves subscription row mutations are reflected in real database queries used by the billing gate.

#### Scenario: Subscription row change affects access decision

- GIVEN a test workshop with an active trial subscription in the database
- WHEN an integration test updates the subscription `status` to `past_due` directly in the database
- AND the billing gate query is re-executed via the typed Supabase client
- THEN the returned subscription state MUST reflect `past_due`
- AND the access decision MUST block full app access

#### Scenario: Trial expiry boundary is exact

- GIVEN a test workshop with `status = trialing` and `trial_ends_at` set to a known timestamp
- WHEN the integration test evaluates the billing gate at exactly `trial_ends_at + 1 millisecond`
- THEN the gate MUST treat the subscription as expired
- AND at exactly `trial_ends_at - 1 millisecond` the gate MUST treat it as active

### Requirement: MercadoPago Webhook-to-Subscription Persistence Integration Test

The system MUST include an integration test that proves the webhook endpoint updates subscription state and that the billing gate reflects the update, without requiring a live MercadoPago sandbox.

#### Scenario: Simulated webhook activates subscription

- GIVEN a test workshop with a subscription row in `trialing` or `unpaid` status
- AND a valid simulated webhook payload for `preapproval.updated` with a successful payment state
- AND a valid signature computed with the test webhook secret
- WHEN the payload is POSTed to the webhook Edge Function endpoint
- THEN the function MUST respond with HTTP 200
- AND the corresponding subscription row MUST update `status` to `active`
- AND `current_period_starts_at` / `current_period_ends_at` MUST be populated

#### Scenario: Simulated webhook sets past_due

- GIVEN a test workshop with an `active` subscription
- AND a simulated webhook payload indicating a failed charge
- WHEN the payload is POSTed to the webhook endpoint with a valid signature
- THEN the subscription row MUST update `status` to `past_due`
- AND a subsequent billing gate query MUST return `past_due`

#### Scenario: Duplicate webhook is idempotent

- GIVEN a webhook event has already been processed for a test subscription
- WHEN the identical event payload and ID are sent again with a valid signature
- THEN the function MUST respond with HTTP 200
- AND the subscription row MUST NOT change its `updated_at` timestamp

#### Scenario: Invalid webhook signature is rejected

- GIVEN a simulated webhook payload with an incorrect or missing signature
- WHEN it is POSTed to the webhook endpoint
- THEN the function MUST respond with HTTP 401 or 403
- AND the subscription row MUST NOT be modified

### Requirement: Billing Settings UI Browser Regression

The system MUST include a Playwright E2E test that proves the settings billing section surfaces real subscription state.

#### Scenario: Settings shows trial end date

- GIVEN a test user with an active trial
- WHEN the user navigates to `/settings` and opens the billing section
- THEN the UI MUST display the trial end date
- AND it MUST display a prompt to start payment before expiration

#### Scenario: Settings shows active period dates

- GIVEN a test user with `status = active`
- WHEN the user opens the billing settings section
- THEN the UI MUST display the current period dates
- AND it MUST display the next charge amount (ARS 4,990)

## MODIFIED Requirements

None. This delta adds only testing coverage requirements; it does not alter existing billing, trial, webhook, or billing-gate behavior.
