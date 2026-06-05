# SDD-7 Apply Progress — PR 1 + PR 2

## Workload / PR Boundary

- Delivery strategy: auto-chain, stacked-to-main.
- Applied PR 1 scope — Playwright harness, active-trial browser access spec, subscription-state integration spec, deterministic Node-only fixtures, and runbook docs.
- Applied PR 2 scope — blocked billing browser scenarios, MercadoPago webhook persistence integration, tenant-isolation regression, fixture extensions, and runbook updates.
- Explicitly not implemented: PR 3 quote, contract/PDF, inventory stock movement, or operational workflow coverage.
- Review budget: PR 1 was low risk; PR 2 was medium risk and stayed scoped to tests/fixtures/docs/OpenSpec artifacts only.

## Completed Tasks

- [x] Task 1.1 — Added `@playwright/test` dev dependency and `test:e2e`, `test:e2e:ui`, `test:e2e:debug` scripts; `npm test` remains `vitest run`.
- [x] Task 1.2 — Added Chromium-only `playwright.config.ts` with `tests/e2e`, `E2E_BASE_URL` default, Vite web server, traces, and screenshots on failure.
- [x] Task 1.3 — Wrote RED active-trial billing browser spec.
- [x] Task 1.4 — Wrote RED subscription-state integration spec with past-due and trial-boundary checks.
- [x] Task 1.5 — Added Node-only deterministic fixture helper in `scripts/e2e/fixtures.ts`.
- [x] Task 1.6 — Wired specs to fixtures.
- [x] Task 1.7 — Extracted reusable fixture exports for setup, auth client creation, mutation, querying, and cleanup.
- [x] Task 1.8 — Hardened specs with Playwright auto-waiting and no arbitrary waits.
- [x] Task 1.9 — Added E2E runbook.
- [x] Task 1.10 — Added README E2E section/link.

## Files Changed

- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `vite.config.ts`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `scripts/e2e/fixtures.ts`
- `tests/e2e/browser/billing-gate-active-trial.spec.ts`
- `tests/e2e/integration/subscription-state.spec.ts`
- `docs/testing/runbook.md`
- `README.md`
- `openspec/changes/2026-06-02-sdd-7-business-critical-e2e/tasks.md`
- `openspec/changes/2026-06-02-sdd-7-business-critical-e2e/apply-progress.md`

## TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- |
| PR 1 harness/specs | `npm run test:e2e -- tests/e2e/integration/subscription-state.spec.ts` failed with missing `scripts/e2e/fixtures` import after RED specs were added. | Added `scripts/e2e/fixtures.ts` with idempotent admin setup/teardown and authenticated anon client helpers; specs now execute until required local E2E env is missing. | Shared setup/user/workshop/subscription creation, auth client creation, status mutation, trial mutation, query, and cleanup are named fixture exports. | Removed arbitrary waits; kept specs narrow; excluded `tests/e2e/**` from Vitest after `npm test` initially tried to import Playwright specs and failed on missing E2E env. |

## Commands Run

| Command | Exit | Evidence |
| --- | ---: | --- |
| `npm install --save-dev @playwright/test` | 0 | Dependency and lockfile updated. |
| `npm run test:e2e -- tests/e2e/integration/subscription-state.spec.ts` | 1 | Expected RED: missing `scripts/e2e/fixtures`. |
| `npm test` | 1 | Discovered Vitest imported `tests/e2e/**`; fixed by adding Vitest exclude. |
| `npm test` | 0 | 34 files / 246 tests passed; `npm test` remains green. |
| `npm run test:e2e` | 1 | Blocked by missing local E2E env (`E2E_TEST_PASSWORD`). |
| `npx tsc -p tsconfig.app.json --noEmit` | 2 | Discovered Node-only fixture was pulled into app tsconfig without Node types. |
| `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit` | 0 | App and Node config type-check passed after tsconfig split/excludes. |
| `E2E_TEST_PASSWORD=<placeholder> npm run test:e2e -- tests/e2e/integration/subscription-state.spec.ts` | 1 | Specs execute; blocked by missing `E2E_SUPABASE_URL` / local Supabase env. |
| `npx playwright install --dry-run` | 0 | Browser download plan reported successfully. |
| `grep -R "E2E_SUPABASE_SERVICE_ROLE_KEY\|SUPABASE_SERVICE_ROLE_KEY" src tests .env* 2>/dev/null || true` | 0 | No service-role reference in `src/` or `tests/`; existing `.env.example` comment only. |

## Verification Summary

- `npm test`: green after excluding Playwright E2E specs from Vitest discovery.
- `npm run test:e2e`: green against local Supabase after exporting the runbook env vars from `supabase status --output env`.
- Service-role safety: service-role env access exists only in Node-only `scripts/e2e/fixtures.ts`; it is not referenced in `src/`, browser tests, `VITE_*`, or frontend code.

## Deviations From Design

- Added `vite.config.ts` Vitest exclude and tsconfig include/exclude updates so Playwright specs and Node-only fixtures remain isolated from the existing Vitest/browser TypeScript environment.
- Integration tests import production `getBillingAccess` and use an equivalent anon-key authenticated Supabase client rather than the browser singleton, because Playwright integration specs run in Node.

## Review Fixes

- Added Playwright-generated artifact directories to `.gitignore`: `test-results/`, `playwright-report/`, and `blob-report/`.
- Removed generated local `test-results/` artifacts from the working tree.
- Updated `scripts/e2e/fixtures.ts` so `E2E_TEST_PASSWORD` is read lazily at test execution time, allowing `npm run test:e2e -- --list` to discover specs without local secrets.
- Hardened fixture cleanup to delete all `e2e_sdd7_%` workshops, including workshops auto-created by the auth trigger before the stable fixture workshop is assigned.
- Fixed the active-trial browser login selector by making the password label lookup exact, avoiding a collision with the "show password" button accessible name.
- Fixed subscription fixture writes to handle the existing one-subscription-per-workshop row created during auth/workshop setup: setup now checks write errors, updates the row by `workshop_id` when present, and status/trial mutations target `workshop_id` instead of a fixed subscription UUID.

## Post-Review Verification

| Command | Exit | Evidence |
| --- | ---: | --- |
| `npm run test:e2e -- --list` | 0 | Listed 3 Playwright tests across browser and integration specs without requiring E2E secrets at import time. |
| `npm test` | 0 | 34 files / 246 tests passed after review fixes. |
| `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit` | 0 | App and Node type-checks passed. |
| `E2E_TEST_PASSWORD=<placeholder> E2E_SUPABASE_URL=http://127.0.0.1:54321 E2E_SUPABASE_ANON_KEY=<placeholder> E2E_SUPABASE_SERVICE_ROLE_KEY=<placeholder> VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<placeholder> npm run test:e2e -- tests/e2e/integration/subscription-state.spec.ts --timeout=10000` | 1 | Earlier specs executed and failed on `ECONNREFUSED 127.0.0.1:54321`, confirming the remaining blocker was missing local Supabase runtime. |
| `npm run test:e2e` with local Supabase env from runbook | 1 | Exposed PR1 test defects: ambiguous password label selector and subscription fixture mutations targeting a fixed subscription UUID that did not exist when the existing per-workshop subscription row was created elsewhere. |
| `npm run test:e2e` with local Supabase env from runbook | 0 | Passed 3/3 Playwright tests after selector and subscription fixture fixes. |
| `npm run lint` | 0 | Passed with 6 existing React Hook Form compiler warnings. |
| `npm run build` | 0 | Production build completed. |

## PR 2 Apply Progress

- Applied scope: PR 2 only — blocked billing browser scenarios, MercadoPago webhook persistence integration, tenant-isolation regression, and runbook updates.
- Explicitly not implemented: PR 3 quote, contract/PDF, inventory stock movement, or operational workflow coverage.
- Webhook strategy: direct database integration simulation for persistence/idempotency plus signature helper validation, avoiding external MercadoPago network mocking in this PR.

### PR 2 Completed Tasks

- [x] Task 2.1 — Added `tests/e2e/browser/billing-gate-blocked.spec.ts` for expired-trial and past-due billing-block screens.
- [x] Task 2.2 — Added `tests/e2e/integration/mercadopago-webhook.spec.ts` for activation, failed-charge/past-due, idempotency, and signature validation.
- [x] Task 2.3 — Added `tests/e2e/integration/tenant-isolation.spec.ts` proving workshop B cannot read workshop A materials through an authenticated anon client.
- [x] Task 2.4 — Updated `docs/testing/runbook.md` with PR 2 specs and expanded cleanup coverage.

### PR 2 TDD / Fix Evidence

| Cycle | RED | GREEN | REFACTOR |
| --- | --- | --- | --- |
| PR 2 specs | Initial focused PR 2 E2E run failed 2 browser assertions because status text appeared in multiple visible components. | Adjusted browser assertions to exact/first text locators; focused PR 2 E2E passed 7/7. | Kept specs scoped to PR 2 and reused PR 1 fixture patterns; no production source changes. |

### PR 2 Verification

| Command | Exit | Evidence |
| --- | ---: | --- |
| `npx tsc -p tsconfig.node.json --noEmit` | 0 | Node/E2E fixture typing passed after fixture extensions. |
| `npm run test:e2e -- tests/e2e/browser/billing-gate-blocked.spec.ts tests/e2e/integration/mercadopago-webhook.spec.ts tests/e2e/integration/tenant-isolation.spec.ts` | 1 | RED/fix evidence: browser status selectors were ambiguous. |
| `npm run test:e2e -- tests/e2e/browser/billing-gate-blocked.spec.ts tests/e2e/integration/mercadopago-webhook.spec.ts tests/e2e/integration/tenant-isolation.spec.ts` | 0 | PR 2 focused E2E passed 7/7. |
| `npm run test:e2e` | 0 | Full PR 1 + PR 2 Playwright suite passed 10/10 against local Supabase. |
| `npm test` | 0 | 34 files / 246 tests passed. |
| `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit` | 0 | App and Node type-checks passed. |
| `npm run lint` | 0 | Passed with 6 existing React Hook Form compiler warnings. |
| `npm run build` | 0 | Production build completed. |

## Remaining Tasks

- PR 1 full E2E is complete: local Supabase env vars were exported from `supabase status --output env`, local Supabase was started, and `npm run test:e2e` passed.
- PR 2 full E2E is complete: focused PR 2 E2E passed 7/7 and full Playwright suite passed 10/10.
- PR 3 remains pending: quote and inventory operational workflows.

## Persistence

- Engram memory tools were unavailable in this subagent session; this progress file is the persisted OpenSpec artifact.

## PR 3 Apply Progress

- Applied scope: PR 3 only — quote creation browser workflow, contract/PDF browser surface, inventory stock movement integration, and runbook updates.
- Added a database hardening migration for `apply_stock_movement` after the RED inventory isolation check exposed that cross-workshop material IDs could be accepted by the RPC path in local E2E.
- Explicitly not implemented: SDD9 core coupling cleanup or non-SDD7 workflows.

### PR 3 Completed Tasks

- [x] Task 3.1 — Added `tests/e2e/browser/quote-creation.spec.ts` covering login, client/template selection, calculated quote total, persisted quote, recipe snapshots, and labor snapshots.
- [x] Task 3.2 — Added `tests/e2e/browser/contract-pdf.spec.ts` covering contract rendering with customer/project/total data and PDF download initiation.
- [x] Task 3.3 — Added `tests/e2e/integration/inventory-stock-movement.spec.ts` covering stock increase/decrease RPC writes and tenant-isolated stock movement RLS denial; added `supabase/migrations/20260605000100_harden_stock_movement_rpc.sql` for explicit RPC tenant hardening.
- [x] Task 3.4 — Updated `docs/testing/runbook.md` with PR 3 specs and expanded fixture cleanup coverage.

### PR 3 TDD / Fix Evidence

| Cycle | RED | GREEN | REFACTOR |
| --- | --- | --- | --- |
| PR 3 operational specs | Focused PR 3 E2E initially failed without E2E env, then with env exposed browser selector/format assumptions and an inventory isolation gap: the stock movement RPC did not reject a cross-workshop material ID. | Added deterministic quote/contract/stock fixture helpers, hardened `apply_stock_movement`, and fixed browser assertions to target visible cells/contract content; focused PR 3 E2E passed 5/5. | Kept helper exports Node-only in `scripts/e2e/fixtures.ts`, reused existing authenticated anon clients, and documented new specs/cleanup in the runbook. |

### PR 3 Verification

| Command | Exit | Evidence |
| --- | ---: | --- |
| `npx tsc -p tsconfig.node.json --noEmit` | 0 | Node/E2E fixture typing passed after PR 3 helper additions. |
| `npm test` | 0 | 41 files / 271 tests passed. |
| `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit` | 0 | App and Node type-checks passed. |
| `npm run test:e2e -- --list` | 0 | Listed 15 Playwright tests across 8 files without requiring E2E secrets at import time. |
| `npm run test:e2e -- tests/e2e/browser/quote-creation.spec.ts tests/e2e/browser/contract-pdf.spec.ts tests/e2e/integration/inventory-stock-movement.spec.ts` | 1 | RED/fix evidence: missing env first, then visible selector issues and cross-tenant stock movement gap. |
| `supabase db query --local --file supabase/migrations/20260605000100_harden_stock_movement_rpc.sql` | 0 | Applied local RPC hardening for focused verification after creating the migration. |
| `npm run test:e2e -- tests/e2e/browser/quote-creation.spec.ts tests/e2e/browser/contract-pdf.spec.ts tests/e2e/integration/inventory-stock-movement.spec.ts` | 0 | Focused PR 3 E2E passed 5/5 against local Supabase. |

## Remaining Tasks

- Run full SDD7 verification including full Playwright suite, lint/build, fresh review, then sync/archive SDD7 if clean.
