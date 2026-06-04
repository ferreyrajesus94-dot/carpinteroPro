# SDD8 Apply Progress

## Work Unit 1 — Shared Foundation (PR1)

**Status:** Complete for implementation; not committed per instruction.

### Completed tasks

- Created `src/shared/lib/formatters.ts` and moved the existing `formatCurrency` implementation out of `src/features/quotes/types.ts`.
- Added focused shared formatter unit coverage in `tests/shared/lib/formatters.test.ts`.
- Updated dashboard, inventory, CRM, and quotes imports to use `@/shared/lib/formatters`.
- Removed quote-local `WorkshopSettings` ownership and updated quotes/recipes type imports to the canonical query-free shared read type at `src/shared/types/workshopSettings.ts`.
- Updated `src/shared/api/workshopSettings.ts` and `src/features/settings/api/workshopSettings.ts` to re-export/use the shared `WorkshopSettings` read type while keeping mutation-only insert/update types feature-local.

### Files changed

- `src/shared/lib/formatters.ts`
- `tests/shared/lib/formatters.test.ts`
- `src/features/quotes/types.ts`
- `src/features/quotes/lib/pdf.ts`
- `src/features/quotes/components/ContractPreview.tsx`
- `src/features/quotes/components/QuoteLivePreview.tsx`
- `src/features/quotes/components/QuoteList.tsx`
- `src/features/dashboard/components/Dashboard.tsx`
- `src/features/dashboard/components/StatusPieChart.tsx`
- `src/features/dashboard/components/KPICards.tsx`
- `src/features/dashboard/components/ActiveQuotesPanel.tsx`
- `src/features/inventory/components/MaterialList.tsx`
- `src/features/inventory/components/InventoryStats.tsx`
- `src/features/crm/components/ClientList.tsx`
- `src/features/crm/components/ClientDetail.tsx`
- `src/features/crm/components/KanbanCard.tsx`
- `src/features/recipes/lib/pdf.ts`
- `src/features/settings/api/workshopSettings.ts`
- `src/shared/api/workshopSettings.ts`
- `src/shared/types/workshopSettings.ts`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/tasks.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR | Evidence |
|---|---|---|---|---|---|
| Shared `formatCurrency` | Added `tests/shared/lib/formatters.test.ts` importing the new shared path before it existed. `npm test -- tests/shared/lib/formatters.test.ts` failed with unresolved import (exit 1). | Added `src/shared/lib/formatters.ts` with the moved implementation and updated imports. Focused test passed (exit 0). | Test covers positive integer, zero, decimal rounding, and negative amount patterns. Custom locale/currency was not added because the existing function signature does not support overrides and behavior must be preserved. | Removed obsolete quote-local formatter and WorkshopSettings ownership; import-only structural cleanup. | `npm test -- tests/shared/lib/formatters.test.ts`, `npm test`, `npm run lint`. |

### Verification commands

| Command | Exit | Result |
|---|---:|---|
| `npm test -- tests/shared/lib/formatters.test.ts` (RED) | 1 | Failed before implementation because `@/shared/lib/formatters` did not exist. |
| `npm test -- tests/shared/lib/formatters.test.ts` (GREEN) | 0 | 1 file / 1 test passed. |
| `npm test` | 0 | 35 files / 247 tests passed. |
| `npm run lint` | 0 | No errors. Existing React Compiler warnings for React Hook Form `watch()` remain in unrelated files. |
| `npm run build` | 0 | Production build completed successfully during fresh review. |
| `git diff --check` | 0 | No whitespace errors after fresh-review hygiene fix. |
| `grep -r "from.*features/quotes/types.*formatCurrency" src/` | 0 | No matches. |
| `grep -r "WorkshopSettings" src/features/quotes/types.ts` | 0 | No matches. |

### Deviations from design/tasks

- Preserved the existing `formatCurrency(amount: number): string` signature and zero-decimal ARS output. The task text mentioned optional locale/currency only "if supported"; the existing implementation did not support overrides.
- `src/features/dashboard/hooks/useDashboardStats.ts` had no `formatCurrency` import to update.
- No commit was created because the task explicitly said not to commit.

### Remaining tasks

- WU2/WU3/WU4/WU5 remain untouched and out of scope for this apply run.
- Existing cross-feature imports unrelated to WU1 remain for later SDD8 work units.

### Workload / PR boundary

- Boundary: PR1 / WU1 shared foundation only, stacked-to-main.
- Changed-line estimate for implementation files (`src/` + formatter test): ~90 changed lines after adding the query-free shared `WorkshopSettings` type, still within the ≤140 WU1 target.
- No SDD7 PR3 files were modified.

### Fresh review follow-up

- Fresh review found no blockers.
- Applied the review hygiene fix for a blank line at EOF in `src/features/quotes/types.ts`.
- Applied the review architecture note by moving canonical `WorkshopSettings` ownership to query-free `src/shared/types/workshopSettings.ts`, leaving DB query functions out of the type owner module.

---

## Work Unit 2 — CI-Safe Boundary Guardrails (PR2)

**Status:** Complete for implementation; not committed per instruction.

### Completed tasks

- Installed `eslint-plugin-import` and `eslint-import-resolver-typescript` so ESLint flat config can resolve the `@/*` TypeScript path alias in CI.
- Added staged `import/no-restricted-paths` enforcement for feature-sliced boundaries:
  - `src/shared/**` cannot import from `src/features/**`.
  - each `src/features/<feature>/**` can import itself plus documented temporary dirty-scope exceptions only.
  - app-level composition remains unrestricted by this rule.
- Documented the target import model and SDD8 temporary exception policy in `AGENTS.md`.
- Verified a practical negative case by temporarily adding a forbidden `auth → crm` import, confirming ESLint failed, then restoring the file.

### Files changed

- `AGENTS.md`
- `eslint.config.js`
- `package.json`
- `package-lock.json`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/tasks.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR | Evidence |
|---|---|---|---|---|---|
| Boundary lint config | Strict-TDD structural/config exception: WU2 changes CI lint configuration only and does not change runtime behavior. RED was represented by a practical negative lint check after config was installed: a temporary forbidden `auth → crm` import failed lint with `import/no-restricted-paths` (exit 1), then the file was restored. | `npm run lint` passed on the real tree (exit 0) with only pre-existing React Compiler warnings. | `npx eslint --print-config src/app/App.tsx | grep -n 'import/no-restricted-paths\|import/resolver'` showed the import rule and resolver are active. `npm test` stayed green. | Reduced ESLint zone configuration to a helper-based staged model while preserving explicit SDD8 comments for dirty exceptions. | `npm run lint`, `npm test`, `npm run build`, negative lint check. |

### Verification commands

| Command | Exit | Result |
|---|---:|---|
| `npm install -D eslint-plugin-import` | 0 | Added the ESLint import plugin. |
| `npm install -D eslint-import-resolver-typescript` | 0 | Added TypeScript path alias resolution for `@/*` imports. |
| `npx eslint --print-config src/app/App.tsx \| grep -n 'import/no-restricted-paths\\|import/resolver' \| head -20` | 0 | Printed active `import/resolver` and `import/no-restricted-paths` config entries. |
| Temporary forbidden import in `src/features/auth/routes.tsx`, then `npx eslint src/features/auth/routes.tsx` | 1 | Expected failure: `Unexpected path "@/features/crm/types" imported in restricted zone`; file restored afterward. |
| `npm test` | 0 | 35 files / 247 tests passed. |
| `npm run lint` | 0 | No errors. Existing React Compiler warnings for React Hook Form `watch()` remain unrelated. |
| `npm run build` | 0 | Production build completed successfully after package/config changes. |

### Deviations from design/tasks

- Added `eslint-import-resolver-typescript` in addition to `eslint-plugin-import`; without a resolver, the import rule would not reliably enforce aliased `@/features/...` imports used throughout this codebase.
- Added a temporary `quotes → settings` exception because an existing legacy import in `src/features/quotes/components/ContractPreview.tsx` would otherwise make CI/lint red. It is grouped with WU5 dirty-domain exceptions and should be removed in a later approved cleanup.
- Changed-line target was exceeded only because `package-lock.json` records transitive dependency installation. The hand-written config/docs/task diff remains review-sized; no product code was changed.
- No commit was created because the task explicitly said not to commit.

### Remaining tasks

- WU3/WU4/WU5 remain untouched and out of scope for this apply run.
- Temporary lint exceptions remain only for known dirty scopes and must be removed in the corresponding future SDD8 work units/follow-up cleanup.
- Fresh review found unused `inventory → quotes` and `recipes → quotes` exceptions; both were removed so those future imports now fail lint.

### Workload / PR boundary

- Boundary: PR2 / WU2 CI-safe import boundary guardrails only, stacked-to-main after WU1 commit `3dc0900`.
- Changed-line count: `git diff --numstat` reported 973 additions / 28 deletions before this progress entry, driven by `package-lock.json` dependency metadata. Excluding lockfile, the WU2 hand-written diff is approximately 73 additions / 11 deletions, within the intended 60–120 line target.
- No SDD7 PR3 files were modified.

---

## Work Unit 3 — Dashboard Composition (PR3)

**Status:** Complete for implementation; not committed per instruction.

### Completed tasks

- Added dashboard prop contracts in `src/features/dashboard/types.ts` and `DashboardProps` in `Dashboard.tsx`.
- Added RED component contract coverage for injected dashboard quotes/materials/loading state.
- Moved dashboard data orchestration to app-level `src/app/pages/DashboardPage.tsx`, which gathers `workshopId`, quotes, and materials and injects plain data into `Dashboard`.
- Removed dashboard feature imports from quotes/inventory by using dashboard-local data contracts and shared quote status contracts/constants.
- Moved quote status labels/colors/enums to `src/shared/types/quotes.ts` and re-exported them from `src/features/quotes/types.ts` for existing quote callers.
- Removed the dashboard → quotes/inventory temporary exception from `eslint.config.js`.

### Files changed

- `eslint.config.js`
- `src/app/pages/DashboardPage.tsx`
- `src/app/router.tsx`
- `src/features/dashboard/components/ActiveQuotesPanel.tsx`
- `src/features/dashboard/components/Dashboard.test.tsx`
- `src/features/dashboard/components/Dashboard.tsx`
- `src/features/dashboard/components/StatusPieChart.tsx`
- `src/features/dashboard/hooks/useDashboardStats.test.ts`
- `src/features/dashboard/hooks/useDashboardStats.ts`
- `src/features/dashboard/routes.tsx`
- `src/features/dashboard/types.ts`
- `src/features/quotes/types.ts`
- `src/shared/types/quotes.ts`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/tasks.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR | Evidence |
|---|---|---|---|---|---|
| Dashboard props injection | Added `src/features/dashboard/components/Dashboard.test.tsx` to render `Dashboard` with injected `quotes`, `materials`, and `isLoading`. `npm test -- src/features/dashboard/components/Dashboard.test.tsx` failed (exit 1) before implementation because existing `Dashboard` still imported auth/query hooks and required Supabase env through `useWorkshopId`. | Refactored `Dashboard` to accept props, added `DashboardPage` app composition wrapper, added dashboard-local contracts, and moved shared quote status constants. Focused dashboard tests passed (exit 0). | Ran focused dashboard component + stats tests together; existing stats coverage confirms revenue, conversion, active quotes, monthly data, and extras behavior still match expectations with the new dashboard-local quote contract. Full `npm test` passed. | Removed dashboard ESLint exceptions, verified no dashboard feature imports from quotes/inventory remain, kept existing quote exports as re-exports for compatibility, and ran lint/build. | `npm test -- src/features/dashboard/components/Dashboard.test.tsx`, `npm test -- src/features/dashboard/components/Dashboard.test.tsx src/features/dashboard/hooks/useDashboardStats.test.ts`, `npm test`, `npm run lint`, `npm run build`, boundary greps. |

### Verification commands

| Command | Exit | Result |
|---|---:|---|
| `npm test -- src/features/dashboard/components/Dashboard.test.tsx` (RED) | 1 | Failed before implementation because old `Dashboard` still loaded Supabase-backed hooks instead of using injected props. |
| `npm test -- src/features/dashboard/components/Dashboard.test.tsx src/features/dashboard/hooks/useDashboardStats.test.ts` | 0 | 2 files / 10 tests passed. |
| `npm test` | 0 | 36 files / 249 tests passed. |
| `npm run lint` | 0 | No errors. Existing React Compiler warnings for React Hook Form `watch()` remain unrelated. |
| `npm run build` | 0 | TypeScript project build and Vite production build completed successfully. |
| `git diff --check` | 0 | No whitespace errors. |
| `grep -R "from.*@/features/quotes\\|from.*@/features/inventory" -n src/features/dashboard` | 0 | No matches. |
| `grep -R "features/quotes\\|features/inventory" -n src/features/dashboard` | 0 | No matches. |
| `grep -n "dashboard.*quotes\\|dashboard.*inventory\\|WU3" eslint.config.js` | 0 | No matches; dashboard temporary boundary exception removed. |

### Deviations from design/tasks

- The composition seam was implemented in `src/app/pages/DashboardPage.tsx` and `src/app/router.tsx` rather than inside `src/features/dashboard/routes.tsx` so the dashboard feature can remain free of cross-feature imports after removing the lint exception.
- `useDashboardStats.ts` stayed local to the dashboard feature, as planned. Its input was narrowed to a dashboard-local `DashboardQuote` contract and its sale-price helper now uses the same arithmetic locally instead of importing the quote feature calculator.
- Manual browser smoke was not run in this implementation pass; build and component tests are green.
- No commit was created because this apply pass explicitly said not to commit.

### Remaining tasks

- Fresh review before commit/PR.
- Manual smoke test of the real dashboard page if a browser/app server is available.
- WU4 settings/onboarding composition remains untouched for a later apply pass.
- WU5 core coupling decision remains deferred.

### Workload / PR boundary

- Boundary: PR3 / WU3 dashboard composition only, stacked-to-main after WU2 commit `a202db1`.
- Changed-line estimate including untracked files: 191 additions / 77 deletions = 268 changed lines, within the ≤300 WU3 target and below the 400-line review budget.
- No SDD7 PR3 files were modified.

### Fresh review cleanup before commit

- Restored project-local formatting style in modified dashboard/quote source files where practical to remove formatting-only churn (single quotes, no semicolons, two-space indentation).
- Corrected `tasks.md` wording so WU3 does not overclaim tests for every dashboard subcomponent; the implemented RED coverage is focused on the approved `Dashboard` prop contract, with existing stats tests preserved.
- Matched the local dashboard status badge spacing to the previous quote badge style by using `inline-flex items-center ... py-0.5`.
- Recomputed changed-line counts after cleanup: implementation files including untracked files are 191 additions / 77 deletions = 268 changed lines; including OpenSpec task/progress evidence the full working-tree diff is 288 additions / 94 deletions = 382 changed lines. The implementation slice remains within the WU3 ≤300 target and the full review diff remains below the 400-line session budget.

---

## Work Unit 4 — Settings/Onboarding Composition (PR4)

**Status:** Complete for implementation; not committed per instruction.

### Completed tasks / files

Implemented settings `billingSlot`/reset props, app-level `SettingsPage`, onboarding save/material callback props, app-level `OnboardingPage`, onboarding-local material contracts, WU4 boundary exception removal, focused tests, and OpenSpec updates. Files: `eslint.config.js`, `src/app/router.tsx`, `src/app/pages/{SettingsPage,OnboardingPage}.tsx`, `src/features/settings/components/WorkshopSettings.{tsx,test.tsx}`, `src/features/onboarding/{types.ts,data/seedMaterials.ts,components/OnboardingWizard.tsx,components/OnboardingWizard.test.tsx}`, `tasks.md`, `apply-progress.md`.

### TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR | Evidence |
|---|---|---|---|---|---|
| Settings/onboarding slots/actions | Focused WU4 tests failed before implementation (exit 1) because components did not support injected contracts. | Focused WU4 tests passed after prop/callback seams (exit 0). | Full `npm test` passed: 38 files / 252 tests. | Removed WU4 ESLint exceptions, minimized formatting churn, ran lint/build/diff check. | Focused WU4 tests, `npm test`, `npm run lint`, `npm run build`, `git diff --check`, boundary greps. |

### Verification commands

| Command | Exit | Result |
|---|---:|---|
| Focused WU4 tests (RED) | 1 | Expected pre-implementation contract failure. |
| `npm test -- src/features/settings/components/WorkshopSettings.test.tsx src/features/onboarding/components/OnboardingWizard.test.tsx` | 0 | 2 files / 3 tests passed. |
| `npm test` | 0 | 38 files / 252 tests passed. |
| `npm run lint` | 0 | No errors; existing React Compiler `watch()` warnings remain unrelated/pre-existing. |
| `npm run build` | 0 | TypeScript + Vite production build passed. |
| `git diff --check` | 0 | No whitespace errors. |
| Boundary greps | 0 | No settings→billing/onboarding, onboarding→settings/inventory, or WU4 ESLint exception matches. |

### Deviations / remaining / workload

- Composition seams live in `src/app/pages/*Page.tsx`; `src/features/settings/routes.tsx` remains but app router now uses `SettingsPage`.
- Manual browser smoke was not run; build/component tests are green. Fresh review remains before commit. WU5/SDD7 were not touched.
- After review cleanup, code/test/eslint diff is 251 additions / 42 deletions = 293 changed lines. Full diff including OpenSpec is 306 additions / 63 deletions = 369 changed lines. WU4 is within the ≤320 implementation target and below the 400-line review budget.

---

## Work Unit 5 — Core Coupling Architecture Decision

**Status:** Complete for documentation-only SDD8 scope; not committed yet.

### Completed tasks

- Created `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/decisions/core-coupling.md`.
- Recorded the decision to defer quotes/CRM/recipes/inventory decoupling to a separate SDD change.
- Documented rationale, rejected approaches, recommended follow-up options, and remaining ESLint exceptions.
- Confirmed WU5 made no production, test, lint, package, or app code changes.

### Validation

| Command | Exit | Result |
|---|---:|---|
| `git status --short --branch` | 0 | Clean start from `main...origin/main` before WU5; after WU5 only OpenSpec docs changed. |
| Decision document read/review | 0 | Document exists with rationale and follow-up plan. |

### Workload / PR boundary

- Boundary: WU5 documentation-only OpenSpec update.
- No runtime rollback required; update or supersede the decision if follow-up scope changes.
- SDD7 PR3 was not touched.
