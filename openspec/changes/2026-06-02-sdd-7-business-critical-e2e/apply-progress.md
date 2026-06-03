# SDD-7 Apply Progress — PR 1

## Workload / PR Boundary

- Delivery strategy: auto-chain, stacked-to-main.
- Applied scope: PR 1 only — Playwright harness, active-trial browser access spec, subscription-state integration spec, deterministic Node-only fixtures, and runbook docs.
- Explicitly not implemented: PR 2/PR 3 webhook, tenant-isolation, inventory, and quote journey coverage.
- Review budget: Low risk for PR 1; human-reviewed source/doc additions are intended to stay under 400 changed lines excluding lockfile churn.

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

## Remaining Tasks

- PR 1 full E2E is complete: local Supabase env vars were exported from `supabase status --output env`, local Supabase was started, and `npm run test:e2e` passed.
- PR 2 remains pending: blocked billing/browser scenarios, MercadoPago webhook persistence, and tenant-isolation regression.
- PR 3 remains pending: quote and inventory operational workflows.

## Persistence

- Engram memory tools were unavailable in this subagent session; this progress file is the persisted OpenSpec artifact.
