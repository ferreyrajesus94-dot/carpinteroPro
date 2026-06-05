# SDD-7 Verify Report — Business-Critical E2E

## Status

**PASS**

SDD7 is verified after PR1, PR2, and PR3. The suite now covers the Playwright/local Supabase harness, billing access, subscription-state persistence, MercadoPago webhook persistence simulation, tenant isolation, quote creation, contract/PDF surface, inventory stock movements, and runbook documentation.

## Spec Coverage

| Area | Result | Evidence |
| --- | --- | --- |
| Playwright framework/scripts | PASS | `@playwright/test`, `test:e2e`, `test:e2e:ui`, `test:e2e:debug`, and `playwright.config.ts` are present. |
| Deterministic fixture setup/teardown | PASS | `scripts/e2e/fixtures.ts` seeds stable `e2e_sdd7_` users/workshops/subscriptions/materials/quotes and cleans all mutated tables. |
| Active-trial browser access | PASS | `tests/e2e/browser/billing-gate-active-trial.spec.ts`. |
| Blocked billing browser access | PASS | `tests/e2e/browser/billing-gate-blocked.spec.ts`. |
| Subscription-state persistence | PASS | `tests/e2e/integration/subscription-state.spec.ts`. |
| MercadoPago webhook persistence | PASS | `tests/e2e/integration/mercadopago-webhook.spec.ts`. |
| Tenant isolation regression | PASS | `tests/e2e/integration/tenant-isolation.spec.ts`. |
| Quote creation browser workflow | PASS | `tests/e2e/browser/quote-creation.spec.ts` verifies recipe/material/labor/waste calculation and persisted snapshots. |
| Contract/PDF browser surface | PASS | `tests/e2e/browser/contract-pdf.spec.ts` verifies rendered variables and PDF download initiation. |
| Inventory stock movement integration | PASS | `tests/e2e/integration/inventory-stock-movement.spec.ts` verifies stock increase/decrease RPC paths and tenant-isolated movement denial. |
| Stock movement RPC tenant hardening | PASS | `supabase/migrations/20260605000100_harden_stock_movement_rpc.sql`. |
| Runbook/docs | PASS | `docs/testing/runbook.md` documents all eight specs, env vars, local execution, debugging, cleanup, and CI expectations. |

## Task Completion Status

All PR1 tasks 1.1–1.10, PR2 tasks 2.1–2.4, and PR3 tasks 3.1–3.4 are checked in `tasks.md`.

## Strict TDD Compliance

**PASS**

- Strict TDD is active in `openspec/config.yaml`.
- `apply-progress.md` records RED/GREEN/REFACTOR evidence for PR1, PR2, and PR3.
- PR3 RED evidence included missing-env execution, browser selector/format failures, and a stock movement tenant-isolation gap exposed by E2E.
- PR3 GREEN evidence is the focused PR3 Playwright run passing 5/5 and the full suite passing 15/15.

## Assertion Quality Findings

**PASS**

- Browser tests assert visible user outcomes, URLs, contract content, and downloads rather than CSS details.
- Integration tests assert persisted rows, business decisions, stock quantities, movement rows, and tenant denial.
- Service-role access remains in Node-only fixture setup/teardown; browser and authenticated integration paths use anon-key authenticated clients.

## Review Workload / PR Boundary Findings

**PASS_WITH_NOTE**

- PR3 stayed within the approved domain boundary: quote, contract/PDF, inventory stock movement, runbook, and a directly related RPC hardening migration.
- Non-OpenSpec changed-line count is above the 400-line preferred budget when including new files, matching the original PR3 forecast of 350–650 lines. If this becomes a PR, split-friendly boundaries are: quote/contract E2E vs inventory/RPC hardening.
- SDD9 was not modified.

## Commands Run

| Command | Exit | Result |
| --- | ---: | --- |
| `git status --short --branch` | 0 | `main...origin/main [ahead 4]`; working tree initially clean. |
| `npm test` | 0 | 41 files / 271 tests passed. |
| `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.node.json --noEmit` | 0 | App and Node type-checks passed. |
| `npm run lint` | 0 | Passed with 6 existing React Hook Form compiler warnings. |
| `npm run build` | 0 | Production build completed. |
| `npm run test:e2e -- --list` | 0 | Listed 15 Playwright tests across 8 files without requiring E2E secrets at import time. |
| `npm run test:e2e -- tests/e2e/browser/quote-creation.spec.ts tests/e2e/browser/contract-pdf.spec.ts tests/e2e/integration/inventory-stock-movement.spec.ts` | 1 | RED/fix evidence: missing env first, then selector/format issues and a stock movement tenant-isolation gap. |
| `supabase db query --local --file supabase/migrations/20260605000100_harden_stock_movement_rpc.sql` | 0 | Applied local RPC hardening for verification. |
| `npm run test:e2e -- tests/e2e/browser/quote-creation.spec.ts tests/e2e/browser/contract-pdf.spec.ts tests/e2e/integration/inventory-stock-movement.spec.ts` | 0 | Focused PR3 E2E passed 5/5. |
| `npm run test:e2e` with local Supabase env | 0 | Full E2E suite passed 15/15. |
| `git diff --check` | 0 | No whitespace errors. |

## Exact Blockers

No code or environment blockers remain for SDD7.

## Residual Risks / Follow-ups

- PR3 may be worth splitting for human review despite being one SDD apply slice.
- The inventory tenant-isolation browser/UI flow remains a SHOULD in the delta spec and is not required for archive.
- The 6 React Compiler/RHF warnings are pre-existing.
