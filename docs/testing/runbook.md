# E2E and Integration Test Runbook

This document is the durable operator guide for the Playwright E2E suite, the pgTAP SQL suite, and the Vitest unit/integration suite. It supersedes the SDD 7 "business-critical billing access" runbook that framed the suite around a now-deprecated trial-blocked product model. The suite today covers the free journey end-to-end.

## Scope

The Playwright suite covers the business-critical paths in the free app:

### Browser specs (`tests/e2e/browser/`)

- `tests/e2e/browser/billing-gate-active-trial.spec.ts` — historical active-trial proof (renamed in W5; the post-W5 spec asserts that an active-trial history row does not block the free dashboard).
- `tests/e2e/browser/billing-gate-blocked.spec.ts` — historical-subscription persistence: a workshop with `past_due` / expired-trial / cancelled history still reaches the free dashboard; no `BillingBlockedScreen` is rendered. (Renamed from "billing-blocked" in W5 — the heading used to be "trial-blocked"; today it is "historical-subscription persistence".)
- `tests/e2e/browser/quote-creation.spec.ts` — quote creation wizard happy path.
- `tests/e2e/browser/contract-pdf.spec.ts` — contract preview + PDF download.
- `tests/e2e/browser/inventory-recipe-quote.spec.ts` — material → recipe → quote end-to-end.
- `tests/e2e/browser/production-cycle.spec.ts` — production board → `StartProductionDialog` → `Planificado` column.
- `tests/e2e/browser/signup-journey.spec.ts` — added in W5. Synthetic `auth.users` row → `/login` → `/dashboard`; asserts the Inicio heading and the absence of any billing CTA. Compiles against `chromium` (Supabase local); skips gracefully when the E2E env block is not set.
- `tests/e2e/browser/free-journey.spec.ts` — added in W5. The end-to-end happy path: login → onboarding (Saltar path) → inventory → quote wizard → contract PDF → production board → `Planificado` column. Compiles against `chromium` (Supabase local); skips gracefully when the E2E env block is not set.

### Integration specs (`tests/e2e/integration/`)

- `tests/e2e/integration/subscription-state.spec.ts` — historical-subscription proof (rewritten in W5 from the old "trial-blocked" model). Drives the `subscriptions` row directly; no React gate remains.
- `tests/e2e/integration/mercadopago-webhook.spec.ts` — rewired in W5 to drive the row through `mapMercadoPagoStatusToAppStatus` (the same mapper the real webhook uses). Documents the audit finding #2 (`approved` → `past_due`) as a follow-up.
- `tests/e2e/integration/tenant-isolation.spec.ts` — historical cross-tenant isolation contract.
- `tests/e2e/integration/inventory-stock-movement.spec.ts` — material CRUD + ledger round-trip.

### Vitest unit / integration suite

`npm test` and `npm run test:coverage` cover the rest. The W5 baseline is **131 files / 999 tests**. Coverage thresholds live in `vite.config.ts` under `test.coverage`.

The runbook does not cover the pgTAP SQL suite — see [pgTAP SQL suite](#pgtap-sql-suite-supabase-test-db---local) below.

## Prerequisites

- Node.js 20+ and npm 10+ (the repo pins Node 24 in CI; `.nvmrc` ships with `24`).
- Supabase CLI with a local/test project running.
- Chromium installed for Playwright (`npx playwright install chromium`).
- Never use production Supabase credentials for this suite.

## Environment variables

Browser/Vite receives anon-only values:

```dotenv
VITE_DB_URL=http://127.0.0.1:54321
VITE_DB_ANON_KEY=<local anon key>
```

`VITE_DB_URL` and `VITE_DB_ANON_KEY` are the current runtime contract — `src/shared/lib/supabase.ts` reads them at boot. The legacy `VITE_SUPABASE_*` names are **not** consumed by the app; Vite would silently substitute them with the literal `[SENSITIVE]` and the runtime would fail. The rename is documented in `CHANGELOG.md` under `[0.3.1-beta.2]`.

Node-only fixture setup receives server credentials through the shell or CI secret store:

```dotenv
E2E_BASE_URL=http://localhost:5173
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_ANON_KEY=<local anon key>
E2E_SUPABASE_SERVICE_ROLE_KEY=<local service role key>
E2E_TEST_PASSWORD=<dedicated strong test password>
```

`E2E_SUPABASE_SERVICE_ROLE_KEY` is consumed only by `scripts/e2e/fixtures.ts` in Node. Do not add it to `VITE_*`, frontend code, or browser-readable env files. The W5 synthetic-user helpers (`createSyntheticUser` / `deleteSyntheticUser`) reuse this contract.

## Local run

1. Start or verify local Supabase:
   ```bash
   supabase start
   ```
2. Export the E2E variables above and start Playwright. The config starts Vite automatically:
   ```bash
   npm run test:e2e
   ```
3. Run one spec when debugging (use `--project=<name>` to choose which Vite server is launched by the config):
   ```bash
   npm run test:e2e -- tests/e2e/browser/signup-journey.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/free-journey.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/billing-gate-blocked.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/billing-gate-active-trial.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/quote-creation.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/contract-pdf.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/inventory-recipe-quote.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/browser/production-cycle.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/integration/subscription-state.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/integration/mercadopago-webhook.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/integration/tenant-isolation.spec.ts --project=chromium
   npm run test:e2e -- tests/e2e/integration/inventory-stock-movement.spec.ts --project=chromium
   ```
4. Use Playwright UI or debugger:
   ```bash
   npm run test:e2e:ui
   npm run test:e2e:debug
   ```

## Post-W5 free-journey

The Playwright config (`playwright.config.ts`) declares three projects that target three independent Vite servers. This split is the post-W5 design: specs that do not need a real Supabase stack run against a mocked dev server, specs that exercise Supabase queries run against the local `supabase start` stack, and admin-only snapshot specs run against a server that elevates the mock profile to platform-admin.

| Project | Server port | `VITE_USE_LOCAL_MOCKS` | `VITE_MOCK_ADMIN` | Specs |
| --- | --- | --- | --- | --- |
| `chromium` | 5173 (default) | unset | unset | `signup-journey.spec.ts`, `free-journey.spec.ts`, `quote-creation.spec.ts`, `contract-pdf.spec.ts`, `inventory-recipe-quote.spec.ts`, `production-cycle.spec.ts`, `billing-gate-active-trial.spec.ts`, `billing-gate-blocked.spec.ts`, all `tests/e2e/integration/*`. |
| `chromium-local-mocks` | 5174 | `true` | unset | `visual-polish-a11y.spec.ts`, `visual-polish-contrast.spec.ts`, `visual-polish-snapshots.spec.ts`. |
| `chromium-admin-snapshots` | 5175 | `true` | `true` | `visual-polish-snapshots-admin.spec.ts` only. |

`chromium-local-mocks` and `chromium-admin-snapshots` therefore run **without Supabase**; the spec suite that needs the real database is the `chromium` project. The two W5 additions (`signup-journey.spec.ts`, `free-journey.spec.ts`) compile against `chromium` because they create a real `auth.users` row via `supabase.auth.admin.createUser`. The billing-gate specs are still `chromium` because they need the local Supabase stack to drive the `subscriptions` row directly.

`npx playwright test --list` reports **60 tests across 21 files** at the W5 baseline; the two new specs and the rewired subscription/webhook specs are all present in that list.

## pgTAP SQL suite (`supabase test db --local`)

The pgTAP suite (`supabase/tests/`) covers 19 files (5 historical files plus 14 W1–W5 additions) for **565 assertions** at the W3 baseline. Reproducing that locally requires a disposable database built from the committed migration history:

```bash
supabase start
supabase db reset
supabase test db --local
```

`supabase start` brings the local stack up; `supabase db reset` rebuilds the database from `supabase/migrations/` and applies `supabase/seed.sql`; `supabase test db --local` then executes every `.sql` file in `supabase/tests/` under the `supabase_tests` role. The expected output is **19 files / 565 assertions / 0 failures**. Anything less indicates either a missing grant (the W3 migration adds them) or a migration reconciliation drift — diff the local `supabase_migrations.schema_migrations` table against `supabase/migrations/*.sql` before reporting a defect.

## Fixture cleanup

Fixtures use stable `e2e_sdd7_` identity names and workshop IDs documented in `scripts/e2e/fixtures.ts`. Each suite calls teardown automatically. If a run is interrupted, rerun any E2E spec with valid env; the first setup/teardown cycle is idempotent and removes stale rows for:

- `e2e_sdd7_active_trial@example.invalid`
- `e2e_sdd7_user_b@example.invalid`
- `e2e_sdd7_active_trial_workshop`
- `e2e_sdd7_workshop_b`
- matching `profiles`, `subscriptions`, `clients`, `furniture_templates`, `recipe_items`, `labor_items`, `contract_templates`, `quotes`, `quote_extras`, quote snapshot rows, `materials`, `stock_movements`, and `billing_webhook_events` rows

The W5 additions (`signup-journey.spec.ts`, `free-journey.spec.ts`) create and delete their own synthetic `auth.users` row per run via the new `createSyntheticUser` / `deleteSyntheticUser` helpers in `scripts/e2e/fixtures.ts`; their lifecycle is per-spec, not per-fixture.

## Coverage gate

A Vitest V8 coverage gate enforces global thresholds for the unit/integration test suite. Run it locally:

```bash
npm run test:coverage
```

The gate prints a text summary to stdout and writes `html`, `lcov`, and `json` report files to `coverage/`. Text output is not written to disk — use the HTML report or `lcov.info` for file-based review. Configuration lives in `vite.config.ts` under `test.coverage`.

Coverage is part of the four-command verification contract for every SDD package:
`npm test` → `npm run test:coverage` → `npm run lint` → `npm run build`.

This gate is separate from Playwright E2E tests. E2E coverage is not measured by Vitest.

## `npm audit` thresholds

CI enforces a two-step `npm audit` sweep (split in W4):

- `Audit production dependencies`: `npm audit --audit-level=moderate --omit=dev`. Must pass; **0 high** findings in the production dependency graph is the current state.
- `Audit dev dependencies`: `npm audit --audit-level=high`. Must pass; moderate dev-tooling advisories that do not reach the browser bundle are tolerated and tracked in the audit completion record. The current state is **2 moderate** dev-only findings (`@vitest/mocker` Path-Traversal, transitive of `vitest@4.1.4`) — both are test-time tools that do not reach the browser bundle.

Run either step locally before opening a PR that touches `package.json` or `package-lock.json`.

## CI expectations

Run Playwright in a separate E2E job after `npm test`. The job should start local Supabase, export only test/sandbox credentials, run `npm run test:e2e`, and upload Playwright traces/screenshots on failure. Missing E2E env vars should fail the E2E job fast.

The CI workflow also gates `npm audit` (see [npm audit thresholds](#npm-audit-thresholds)), the coverage gate (see [Coverage gate](#coverage-gate)), and the production build. The release workflow (`.github/workflows/release.yml`) consumes CI's `workflow_run` conclusion; a successful tag-scope CI run is the precondition for a Vercel deploy.

## Historical context (deprecated)

This runbook originally framed the Playwright suite around SDD 7 "business-critical billing access" — the original spec list asserted that trial-blocked, past-due, and cancelled users were denied access at the React gate. After W2 removed the gate, the W5 pass rewired the specs to prove the inverse: a user with a `past_due` / expired-trial / cancelled subscription still reaches the free dashboard. The `billing-gate-blocked.spec.ts` name was preserved for history; today it asserts the *historical-subscription persistence* contract, not a blocked-access contract. The legacy `VITE_SUPABASE_*` env names were replaced by the current `VITE_DB_URL` / `VITE_DB_ANON_KEY` names to escape a Vite 8 redaction; the original SDD 7 docs are preserved under `openspec/changes/archive/2026-06-02-sdd-7-business-critical-e2e/` for the project record.