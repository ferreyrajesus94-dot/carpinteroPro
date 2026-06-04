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
