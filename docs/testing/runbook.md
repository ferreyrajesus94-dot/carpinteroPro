# E2E and Integration Test Runbook

## Scope

SDD 7 adds a Playwright suite for business-critical billing access, tenant regressions, and operational workflows:

- `tests/e2e/browser/billing-gate-active-trial.spec.ts`
- `tests/e2e/browser/billing-gate-blocked.spec.ts`
- `tests/e2e/browser/quote-creation.spec.ts`
- `tests/e2e/browser/contract-pdf.spec.ts`
- `tests/e2e/integration/subscription-state.spec.ts`
- `tests/e2e/integration/mercadopago-webhook.spec.ts`
- `tests/e2e/integration/tenant-isolation.spec.ts`
- `tests/e2e/integration/inventory-stock-movement.spec.ts`

The existing fast suite remains `npm test` and is not coupled to Playwright.

## Prerequisites

- Node.js 20+ and npm.
- Supabase CLI with a local/test project running.
- Chromium installed for Playwright (`npx playwright install chromium`).
- Never use production Supabase credentials for this suite.

## Environment variables

Browser/Vite receives anon-only values:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key>
```

Node-only fixture setup receives server credentials through the shell or CI secret store:

```dotenv
E2E_BASE_URL=http://localhost:5173
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_ANON_KEY=<local anon key>
E2E_SUPABASE_SERVICE_ROLE_KEY=<local service role key>
E2E_TEST_PASSWORD=<dedicated strong test password>
```

`E2E_SUPABASE_SERVICE_ROLE_KEY` is consumed only by `scripts/e2e/fixtures.ts` in Node. Do not add it to `VITE_*`, frontend code, or browser-readable env files.

## Local run

1. Start or verify local Supabase:
   ```bash
   supabase start
   ```
2. Export the E2E variables above and start Playwright. The config starts Vite automatically:
   ```bash
   npm run test:e2e
   ```
3. Run one spec when debugging:
   ```bash
   npm run test:e2e -- tests/e2e/browser/billing-gate-active-trial.spec.ts
   npm run test:e2e -- tests/e2e/browser/billing-gate-blocked.spec.ts
   npm run test:e2e -- tests/e2e/browser/quote-creation.spec.ts
   npm run test:e2e -- tests/e2e/browser/contract-pdf.spec.ts
   npm run test:e2e -- tests/e2e/integration/subscription-state.spec.ts
   npm run test:e2e -- tests/e2e/integration/mercadopago-webhook.spec.ts
   npm run test:e2e -- tests/e2e/integration/tenant-isolation.spec.ts
   npm run test:e2e -- tests/e2e/integration/inventory-stock-movement.spec.ts
   ```
4. Use Playwright UI or debugger:
   ```bash
   npm run test:e2e:ui
   npm run test:e2e:debug
   ```

## Fixture cleanup

Fixtures use stable `e2e_sdd7_` identity names and workshop IDs documented in `scripts/e2e/fixtures.ts`. Each suite calls teardown automatically. If a run is interrupted, rerun any E2E spec with valid env; the first setup/teardown cycle is idempotent and removes stale rows for:

- `e2e_sdd7_active_trial@example.invalid`
- `e2e_sdd7_user_b@example.invalid`
- `e2e_sdd7_active_trial_workshop`
- `e2e_sdd7_workshop_b`
- matching `profiles`, `subscriptions`, `clients`, `furniture_templates`, `recipe_items`, `labor_items`, `contract_templates`, `quotes`, `quote_extras`, quote snapshot rows, `materials`, `stock_movements`, and `billing_webhook_events` rows

## CI expectations

Run Playwright in a separate E2E job after `npm test`. The job should start local Supabase, export only test/sandbox credentials, run `npm run test:e2e`, and upload Playwright traces/screenshots on failure. Missing E2E env vars should fail the E2E job fast.
