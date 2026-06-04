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
