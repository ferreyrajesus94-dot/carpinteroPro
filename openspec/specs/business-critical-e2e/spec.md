# Business-Critical E2E Specification

## Purpose

Define deterministic browser E2E and Supabase integration coverage for CarpinteroPro's revenue, tenant-trust, quote, contract/PDF, and inventory workflows.

## Requirements

### Requirement: Playwright Harness

The project MUST provide a Playwright-based E2E harness with documented commands and deterministic local Supabase fixture setup.

#### Scenario: E2E commands exist

- GIVEN project scripts are inspected
- THEN `test:e2e`, `test:e2e:ui`, and `test:e2e:debug` MUST be available
- AND `playwright.config.ts` MUST use `tests/e2e/` with Chromium and `E2E_BASE_URL` support.

### Requirement: Deterministic Fixtures

E2E setup MUST create stable `e2e_sdd7_` test users, workshops, subscriptions, materials, quotes, templates, webhook events, and related rows, and teardown MUST remove all mutated rows.

#### Scenario: Cleanup removes mutated rows

- GIVEN an E2E test finishes or is rerun
- WHEN fixture cleanup runs
- THEN stale `e2e_sdd7_` rows MUST be removed from all mutated tables.

### Requirement: Billing Gate Coverage

Browser tests MUST prove active-trial users can access the app and blocked users are redirected to billing states.

#### Scenario: Active trial reaches quotes

- GIVEN an active-trial user logs in
- WHEN the user navigates to `/quotes`
- THEN the quotes page MUST render without billing-block text.

#### Scenario: Expired or past-due users are blocked

- GIVEN an expired-trial or past-due subscription
- WHEN the user logs in
- THEN the billing block MUST be shown instead of protected app content.

### Requirement: Subscription and MercadoPago Integration Coverage

Integration tests MUST prove persisted subscription status drives billing access and MercadoPago webhook persistence/idempotency behavior is covered.

#### Scenario: Subscription status blocks access

- GIVEN a trialing subscription is mutated to `past_due`
- WHEN the authenticated query path reads the subscription
- THEN billing access MUST be blocked.

#### Scenario: Webhook persistence is deterministic

- GIVEN simulated MercadoPago events are persisted
- THEN activation, failed-charge/past-due, duplicate-event idempotency, and signature validation scenarios MUST be covered.

### Requirement: Tenant Isolation Coverage

Integration tests MUST prove authenticated workshop B users cannot read or mutate workshop A data through anon-key authenticated clients.

#### Scenario: Cross-tenant material read is denied

- GIVEN materials exist for workshops A and B
- WHEN workshop B lists and directly queries workshop A material
- THEN only workshop B material is visible.

### Requirement: Quote Creation Browser Journey

A browser test MUST prove an active user can create a quote from seeded recipe data and that the browser calculation matches persisted data.

#### Scenario: Create quote from recipe

- GIVEN a test user, client, furniture template, material, labor, and waste data
- WHEN the user creates a quote in the browser
- THEN a quote row MUST be persisted with the expected recipe cost
- AND recipe and labor snapshots MUST be persisted.

### Requirement: Contract and PDF Surface

A browser test MUST prove the contract view renders quote variables and that PDF export is reachable.

#### Scenario: Contract renders and PDF starts

- GIVEN a persisted quote and default contract template
- WHEN the user opens the contract page
- THEN customer name, project name, and total cost MUST render
- AND triggering the PDF action MUST initiate a PDF download.

### Requirement: Inventory Stock Movement Integration

Integration tests MUST prove stock movement operations update stock, create movement history, and preserve tenant isolation.

#### Scenario: Stock movement increases quantity

- GIVEN a material with stock 10
- WHEN the stock movement RPC adds 5
- THEN stock MUST be 15
- AND a movement row MUST record `+5`.

#### Scenario: Stock movement decreases quantity

- GIVEN a material with stock 10
- WHEN the stock movement RPC subtracts 3
- THEN stock MUST be 7
- AND a movement row MUST record `-3`.

#### Scenario: Cross-tenant stock movement is denied

- GIVEN workshop A material exists
- AND workshop B is authenticated
- WHEN workshop B attempts to create a movement for workshop A data
- THEN the operation MUST be denied
- AND workshop B MUST NOT be able to read workshop A material.

## Verification

Before this spec is considered satisfied:

- `npm test` MUST pass.
- Type-checking for app and Node configs MUST pass.
- `npm run lint` MUST pass or document only pre-existing warnings.
- `npm run build` MUST pass.
- `npm run test:e2e -- --list` MUST list specs without requiring secrets at import time.
- `npm run test:e2e` MUST pass against documented local Supabase env.
