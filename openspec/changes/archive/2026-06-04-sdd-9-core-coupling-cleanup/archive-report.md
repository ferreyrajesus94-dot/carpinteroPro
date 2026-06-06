# SDD9 Archive Report — Core Coupling Cleanup

**Change:** `2026-06-04-sdd-9-core-coupling-cleanup`  
**Archive phase date:** 2026-06-06  
**Status:** `PASS`  
**Archive readiness:** `READY` (verified clean, sync completed, 0 unchecked tasks, no critical blockers)

---

## 1. Artifacts Read

| Artifact | Path | Status |
|----------|------|--------|
| Proposal | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/proposal.md` | ✅ Read |
| Spec | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/specs/architecture-cleanup/spec.md` | ✅ Read |
| Design | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/design.md` | ✅ Read |
| Tasks | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` | ✅ Read (71/71 checked, 0 unchecked `- [ ]`) |
| Apply Progress | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md` | ✅ Present |
| Verify Report | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/verify-report.md` | ✅ PASS, archive-ready |
| Sync Report | `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/sync-report.md` | ✅ synced, archive-ready |
| Config | `openspec/config.yaml` | Checked |

---

## 2. Domain Sync Summary

| Domain | Status | ADDED | MODIFIED | REMOVED |
|--------|--------|-------|----------|---------|
| architecture-cleanup | ✅ Synced | 13 | 1 | 0 |

### Requirement Names

**ADDED (13):**
1. CRM quote display dependencies are removed
2. Quotes CRM client dependencies are removed
3. Quotes recipe dependencies are removed
4. Quotes settings dependencies are removed
5. Recipes inventory dependencies are removed
6. Recipes settings dependencies are removed
7. Shared contracts are scoped to current UI read models
8. Workflow modules are tightly bounded
9. Feature public API barrels enable app composition
10. Staged removal preserves validation
11. Quote creation is protected first
12. Costing values remain exact and auditable
13. Architecture shortcuts are rejected

**MODIFIED (1):**
- "Core coupling is deferred and explicit" → "Core coupling is resolved through staged replacement"

**REMOVED (0):** None

### Same-Domain Active Change Warnings

None — no other active changes in `openspec/changes/` target the `architecture-cleanup` domain.

---

## 3. Final Task Completion Gate

| Check | Result |
|-------|--------|
| Re-read `tasks.md` for unchecked `- [ ]` markers | ✅ 0 unchecked markers found (71/71 complete) |
| Unchecked implementation tasks blocking archive | ✅ No — all tasks complete |
| Stale-checkbox reconciliation needed | ✅ No — all checkboxes match apply-progress and verify-report |
| Apply progress proof present | ✅ `apply-progress.md` documents all 71 tasks |

---

## 4. Structured Status & Action Context

| Field | Value |
|-------|-------|
| `changeName` | `2026-06-04-sdd-9-core-coupling-cleanup` |
| `artifactStore` | `openspec` |
| `actionContext.mode` | `repo-local` |
| `actionContext.workspaceRoot` | `/home/elias/Proyectos/carpinteroPro` |
| `taskProgress.total` | 71 |
| `taskProgress.complete` | 71 |
| `taskProgress.remaining` | 0 |
| `applyState` | `all_done` |
| `sync.status` | `synced` |
| `archive.status` | `archived` |
| `dependencies.archive` | `done` |

---

## 5. Destructive Merge

Not applicable. The delta contained 0 REMOVED requirements and 1 MODIFIED requirement (semantic update, not destructive).

---

## 6. Verification Status

| Gate | Result | Evidence |
|------|--------|----------|
| Lint | ✅ PASS | `npm run lint`: 0 errors |
| Test suite | ✅ PASS | 306/306 tests, 50 files |
| Build | ✅ PASS | `tsc -b && vite build` |
| Cross-feature imports | ✅ 0 violations | Automated scan |
| ESLint exceptions removed | ✅ All 6 removed | Confirmed in eslint.config.js |
| TDD evidence | ✅ Present | Cycle evidence table cross-referenced |
| Assertion quality | ✅ No critical issues | Audit performed |
| Review budget | ✅ Respected | All WUs under 400-line guard |

---

## 7. Changed Files Summary (SDD9 scope)

### Modified files (36)
- `eslint.config.js`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `src/app/router.tsx`
- `src/features/crm/components/ClientDetail.tsx`
- `src/features/crm/components/ClientList.tsx`
- `src/features/crm/components/KanbanCard.tsx`
- `src/features/crm/routes.tsx`
- `src/features/crm/types.ts`
- `src/features/inventory/api/priceHistory.ts`
- `src/features/inventory/components/MaterialList.tsx`
- `src/features/inventory/components/PriceSparkline.tsx`
- `src/features/quotes/components/ClientDialog.tsx`
- `src/features/quotes/components/ClientSection.tsx`
- `src/features/quotes/components/ContractPreview.tsx`
- `src/features/quotes/components/FurnitureSection.tsx`
- `src/features/quotes/components/QuoteForm.tsx`
- `src/features/quotes/lib/calculator.ts`
- `src/features/quotes/routes.tsx`
- `src/features/quotes/types.ts`
- `src/features/recipes/components/ExtraItemsSection.tsx`
- `src/features/recipes/components/FurnitureCostSparkline.tsx`
- `src/features/recipes/components/MuebleForm.tsx`
- `src/features/recipes/components/MuebleList.tsx`
- `src/features/recipes/hooks/useStockCheck.ts`
- `src/features/recipes/lib/computeCostHistory.ts`
- `src/features/recipes/lib/computeRecipeCost.test.ts`
- `src/features/recipes/lib/computeWoodUsage.ts`
- `src/features/recipes/lib/evalFormula.ts`
- `src/features/recipes/lib/stockCheck.ts`
- `src/features/recipes/routes.tsx`
- `src/features/recipes/types.ts`
- `openspec/specs/architecture-cleanup/spec.md`

### Deleted files (1)
- `src/features/quotes/hooks/useClients.ts`

### New files (27)
- `src/app/pages/CrmClientDetailPage.tsx`
- `src/app/pages/CrmClientsPage.tsx`
- `src/app/pages/QuoteContractPage.tsx`
- `src/app/pages/QuoteCreatorPage.tsx`
- `src/app/pages/RecipesPage.tsx`
- `src/features/crm/components/ClientDetail.test.tsx`
- `src/features/crm/components/ClientList.test.tsx`
- `src/features/crm/components/KanbanCard.test.tsx`
- `src/features/crm/index.ts`
- `src/features/inventory/index.ts`
- `src/features/quotes/components/ContractPreview.test.tsx`
- `src/features/quotes/components/QuoteForm.test.tsx`
- `src/features/quotes/index.ts`
- `src/features/recipes/hooks/useStockCheck.test.ts`
- `src/features/recipes/index.ts`
- `src/features/settings/index.ts`
- `src/shared/lib/computeWoodUsage.test.ts`
- `src/shared/lib/computeWoodUsage.ts`
- `src/shared/lib/evalFormula.ts`
- `src/shared/lib/quotesCalculator.test.ts`
- `src/shared/lib/quotesCalculator.ts`
- `src/shared/lib/recipeCosting.test.ts`
- `src/shared/lib/recipeCosting.ts`
- `src/shared/types/client.ts`
- `src/shared/types/priceHistory.ts`
- `src/shared/types/recipes.ts`
- `src/shared/ui/PriceSparkline.tsx`

---

## 8. Residual Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Playwright smoke tests used temporary specs deleted after run | Low | Low | Smoke evidence recorded in `apply-progress.md`; E2E infra verified during each WU |
| `PriceSparkline` in shared UI may need future ownership clarification | Low | Low | Currently pure presentational; any future inventory-specific behavior stays in feature |
| Recipe costing edge cases not fully covered by characterization tests | Low | Low | Main scenarios covered; additional edge cases can be added via future SDDs |
| Manual smoke against local Supabase may differ from staging/production | Low | Medium | Smoke used same E2E fixtures as test suite; CI/CD catches environment issues |

**No CRITICAL or HIGH residual risks identified.** All six SDD8 temporary coupling exceptions have been resolved through shared contracts, app-level orchestration seams, and feature public API barrels.

---

## 9. Active Changes

| Change | Status |
|--------|--------|
| `2026-06-04-sdd-9-core-coupling-cleanup` | ✅ **Archived** (this report) |

No other active SDD changes remain under `openspec/changes/`.

---

## 10. Archived Path

**Source:** `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/`  
**Destination:** `openspec/changes/archive/2026-06-04-sdd-9-core-coupling-cleanup/`

---

*Report generated by SDD9 archive executor (Gentle AI).*
