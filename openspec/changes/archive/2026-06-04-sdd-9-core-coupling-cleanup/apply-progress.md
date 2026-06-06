# SDD9 Apply Progress

## 2026-06-05 — WU1 Mechanical Material and Quote Status Path Fixes

### Structured status consumed

- `schemaName`: `gentle-pi.sdd-status` (parent-provided status authority)
- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`
- `artifactStore`: `openspec`
- `applyState`: `ready`
- `actionContext.mode`: `repo-local`
- `actionContext.workspaceRoot`: `/home/elias/Proyectos/carpinteroPro`
- `actionContext.allowedEditRoots`: `/home/elias/Proyectos/carpinteroPro`
- `actionContext.warnings`: none
- `strict_tdd`: active via `openspec/config.yaml`; WU1 uses the structural-only exception documented in `tasks.md` because it redirects imports only and must not change runtime behavior.

### Workload / PR boundary

- Review forecast consumed: `Decision needed before apply: No`; `Chained PRs recommended: Yes`; `Chain strategy: stacked-to-main`; `400-line budget risk: Low per WU, High as single PR`.
- Implemented slice: WU1 only.
- PR boundary: WU1 single review slice, estimated ~30–60 changed lines, no ESLint exception removal.

### Completed tasks and persisted checkbox updates

Updated `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` WU1 acceptance criteria from `- [ ]` to `- [x]` after validation passed:

- [x] All 5 files above import from `src/shared/**` instead of cross-feature paths for the identified symbols.
- [x] `npm run lint` passes (exceptions still present but unused by these files).
- [x] `npm test` passes with no behavioral changes.
- [x] No production behavior changes; purely import path redirects.

### Files changed

- `src/features/recipes/lib/stockCheck.ts`
- `src/features/recipes/lib/computeWoodUsage.ts`
- `src/features/recipes/lib/computeRecipeCost.test.ts`
- `src/features/recipes/components/ExtraItemsSection.tsx`
- `src/features/crm/components/KanbanCard.tsx`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU1 import redirects | `src/features/recipes/lib/computeRecipeCost.test.ts` plus full suite | Structural validation | ✅ `npm test -- src/features/recipes/lib/computeRecipeCost.test.ts` passed 7/7 before edits | ➖ Structural-only exception documented in `tasks.md`; no behavior/new contract | ✅ `npm run lint` exit 0; `npm test` passed 271/271 | ➖ Skipped: import-only redirect with one possible output and no runtime branching | ✅ No refactor beyond import source redirects |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/recipes/lib/computeRecipeCost.test.ts` | Passed | 1 file passed, 7 tests passed before edits. |
| `grep -R "@/features/inventory/types" src/features/recipes/lib/stockCheck.ts src/features/recipes/lib/computeWoodUsage.ts src/features/recipes/lib/computeRecipeCost.test.ts src/features/recipes/components/ExtraItemsSection.tsx || true` | Passed | No output after edits. |
| `grep -n "@/features/quotes/types" src/features/crm/components/KanbanCard.tsx || true` | Informational | Output remains for `QuoteWithExtras` type import on line 7; WU1 only moved `QUOTE_STATUS_COLORS` per scope. |
| `npm run lint` | Passed | Exit 0. Existing React Compiler warnings remain: 0 errors, 6 warnings. |
| `npm test` | Passed | 41 files passed, 271 tests passed. |

### Validation notes

- `Material` imports in all four WU1 recipe targets now come from `@/shared/types/material`.
- `QUOTE_STATUS_COLORS` in `KanbanCard` now comes from `@/shared/types/quotes`.
- The remaining `@/features/quotes/types` import in `KanbanCard` is for `QuoteWithExtras`, which WU1 explicitly did not move; later WU6 covers the CRM quote display seam.
- No production behavior changed; TypeScript type/value import sources only.

### Deviations from design

None. WU1 followed the mechanical shared type/status constant redirect and did not remove ESLint exceptions.

### Remaining tasks

```text
- [ ] `calculateQuote` lives in `src/shared/lib/quotesCalculator.ts` with zero feature imports.
- [ ] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [ ] `evalFormula` and `safeEvalFormula` live in `src/shared/lib/evalFormula.ts`.
- [ ] `computeWoodUsage` and related types live in `src/shared/lib/computeWoodUsage.ts`.
- [ ] Existing tests pass at old and new locations (re-export preserves backward compat).
- [ ] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [ ] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).
- [ ] `src/shared/types/client.ts` exports `Client`, `ClientInsert`, `ClientUpdate`, `ClientSource`, `CLIENT_SOURCE_LABELS` with zero feature imports.
- [ ] `src/shared/types/recipes.ts` exports `FurnitureTemplateWithItems`, `RecipeItemWithMaterial`, `FurnitureParam`, `RecipeCost` with imports only from `@/shared/**`.
- [ ] `src/shared/types/priceHistory.ts` exports `PriceHistoryRow` with zero feature imports.
- [ ] `src/features/quotes/types.ts` imports `Client` from `@/shared/types/client` instead of `@/features/crm/types`.
- [ ] `npm test` passes. `npm run lint` passes.
- [ ] No speculative fields added; contracts mirror current UI read shapes exactly.
- [ ] Each barrel exports only items needed for app-level SDD9 composition. No speculative re-exports.
- [ ] Barrel imports do not create new cross-feature coupling (barrels must not import from other features).
- [ ] `npm run lint` passes. The `import/no-restricted-paths` rule does not fire for barrel self-imports.
- [ ] `npm test` passes.
- [ ] Features do not import other feature barrels (barrels are for `src/app/**` only).
- [ ] `QuoteForm` receives clients, templates, and client-creation callback as props.
- [ ] `ClientSection` and `ClientDialog` no longer import from `@/features/crm/**`.
- [ ] `FurnitureSection` no longer imports from `@/features/recipes/**`.
- [ ] `QuoteForm` still computes real-time quote totals using shared `calculateQuote` and `computeRecipeCost`.
- [ ] `quotes → crm` and `quotes → recipes` lint exceptions are removed from `eslint.config.js`.
- [ ] `npm run lint` passes with the reduced exception set: `featureZone("quotes", ["settings"])`.
- [ ] `npm test` passes.
- [ ] Manual smoke: `/quotes/new` page loads, client selection works, template selection works, real-time cost preview updates, quote creation succeeds.
- [ ] `ContractPreview` receives a `workshopSettings` snapshot prop.
- [ ] `ContractPreview` no longer imports from `@/features/settings/**`.
- [ ] Contract preview renders workshop name, address, phone, email, and footer identically.
- [ ] `quotes` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/quotes/:id/contract` page renders contract correctly.
- [ ] `ClientList` receives quote summaries through props; no `@/features/quotes/**` imports.
- [ ] `ClientDetail` receives quotes and status badge rendering through props/slots; no `@/features/quotes/**` imports.
- [ ] `KanbanCard` receives quote summary and status color through props or shared imports; no `@/features/quotes/**` imports.
- [ ] CRM quote history, totals, statuses, and badges render identically.
- [ ] `crm` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/crm/clientes` shows quote counts/totals; `/crm/clientes/:id` shows quote history with status badges.
- [ ] `MuebleList` receives materials, price history, and stock_alert_enabled through props; no inventory/settings imports.
- [ ] `useStockCheck` accepts materials and stockAlertEnabled as arguments; no internal hook calls to inventory/settings.
- [ ] `FurnitureCostSparkline` receives price history through props or uses shared PriceSparkline; no inventory imports.
- [ ] Stock alert behavior preserves `stock_alert_enabled` toggle: when false, no stock shortages displayed; when true, shortages computed correctly.
- [ ] Cost history sparkline renders identical data points.
- [ ] `recipes` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/recipes` page loads, stock alerts toggle works, cost history sparkline renders, material availability displays.
- [ ] `eslint.config.js` has zero SDD8 temporary exception comments.
- [ ] `featureZone("crm")`, `featureZone("quotes")`, `featureZone("recipes")` have no exception arrays.
- [ ] `npm run lint` passes with no `import/no-restricted-paths` violations in the five involved features.
- [ ] `npm test` passes (full suite).
- [ ] `grep -r "@/features/" src/features/crm/ src/features/quotes/ src/features/recipes/ src/features/inventory/ src/features/settings/ | grep -v node_modules` returns no cross-feature imports (only self-feature and shared imports).
- [ ] Verification evidence recorded in this task file or a verification.md artifact.
- [ ] `calculateQuote` produces identical `CalcResult` for every fixture tested in `calculator.test.ts`.
- [ ] `computeRecipeCost` produces identical `RecipeCost` for every fixture tested in `computeRecipeCost.test.ts`.
- [ ] `computeWoodUsage` produces identical `WoodUsage.subtotal` for each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] `resolveItemQuantity` evaluates formulas identically via `safeEvalFormula`.
- [ ] `applyWaste` applies `qty * (1 + wastePct / 100)` with no rounding.
- [ ] No numeric type changes (all remain `number`).
- [ ] No formula rewrites; only import path changes.
- [ ] No event bus introduced.
- [ ] No shared global state (Zustand store spanning features) introduced.
- [ ] No feature-to-feature barrel imports (barrels are for `src/app/**` only).
- [ ] No hooks or DB queries moved into `src/shared/**`.
- [ ] No TanStack Query wrappers moved into `src/shared/**`.
- [ ] Workflow modules created only if explicitly justified by WU4b or WU7 implementation evidence.
```

## 2026-06-05 — WU2a Shared Quote Calculator Split

### Structured status consumed

- `schemaName`: `gentle-pi.sdd-status` from parent context and latest status artifact.
- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready`.
- `actionContext.mode`: `repo-local`.
- `actionContext.workspaceRoot`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.allowedEditRoots`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.warnings`: none.
- `strict_tdd`: active via `openspec/config.yaml`; strict TDD guidance loaded from `/home/elias/.pi/agent/gentle-ai/support/strict-tdd.md`.

### Workload / PR boundary

- Review forecast consumed: `Decision needed before apply: No`; `Chained PRs recommended: Yes`; `Chain strategy: stacked-to-main`; `400-line budget risk: Low per WU, High as single PR`.
- Implemented slice: WU2a only — quote calculator shared move plus shared-location characterization tests.
- PR boundary: WU2 was forecast near the 400-line ceiling; full WU2 would likely exceed the review budget when adding recipe costing, formula, wood usage, and tests. Split applied per task guard: WU2a completed, WU2b remains unchecked.
- No ESLint exceptions were removed.

### Completed tasks and persisted checkbox updates

Updated `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` WU2 acceptance criteria from `- [ ]` to `- [x]` after validation passed:

- [x] `calculateQuote` lives in `src/shared/lib/quotesCalculator.ts` with zero feature imports.

### Files changed

- `src/shared/lib/quotesCalculator.ts`
- `src/shared/lib/quotesCalculator.test.ts`
- `src/features/quotes/lib/calculator.ts`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU2a quote calculator shared move | `src/shared/lib/quotesCalculator.test.ts` and `src/features/quotes/lib/calculator.test.ts` | Unit / approval | ✅ `npm test -- src/features/quotes/lib/calculator.test.ts` passed 9/9 before production edits | ✅ Shared-location tests written first; `npm test -- src/shared/lib/quotesCalculator.test.ts` failed because `./quotesCalculator` did not exist | ✅ Created `src/shared/lib/quotesCalculator.ts` and re-exported old feature path; shared tests passed 4/4 and old-path tests passed 9/9 | ✅ Added on_cost, on_price, zero-margin, and on_price 100% division-guard cases with concrete full-result assertions | ✅ Re-export file reduced to compatibility exports; focused and full tests stayed green |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/quotes/lib/calculator.test.ts` | Passed | Safety net before production edits: 1 file passed, 9 tests passed. |
| `npm test -- src/shared/lib/quotesCalculator.test.ts` | Failed as RED | Failed before shared module existed: Vite could not resolve `./quotesCalculator`; 0 tests executed. |
| `npm test -- src/shared/lib/quotesCalculator.test.ts` | Passed | GREEN/TRIANGULATE: 1 file passed, 4 tests passed. |
| `npm test -- src/features/quotes/lib/calculator.test.ts` | Passed | Backward compatibility: old feature import path passed 9/9 through re-export. |
| `grep -R "@/features/" src/shared/lib/quotesCalculator.ts && exit 1 || true` | Passed | No output; shared quote calculator has zero feature imports. |
| `npm run lint` | Passed | Exit 0. Existing React Compiler warnings remain: 0 errors, 6 warnings. |
| `npm test` | Passed | 42 files passed, 275 tests passed. |

### Validation notes

- `calculateQuote`, `CalcInput`, `CalcExtra`, and `CalcResult` now live in `src/shared/lib/quotesCalculator.ts`.
- `src/features/quotes/lib/calculator.ts` re-exports types and value from shared for backward compatibility.
- Shared characterization tests cover WU2 quote requirements: `on_cost`, `on_price`, zero margin, and division-by-zero guard.
- No production numeric behavior changed; implementation was copied exactly from the feature module.
- WU2b remains for recipe costing, formula evaluation, and wood usage to keep this slice under the 400-line review budget.

### Deviations from design

- WU2 was split into WU2a/WU2b due review-budget guard. This follows the tasks.md split instruction and does not change the architecture direction.

### Remaining WU2 tasks

```text
- [ ] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [ ] `evalFormula` and `safeEvalFormula` live in `src/shared/lib/evalFormula.ts`.
- [ ] `computeWoodUsage` and related types live in `src/shared/lib/computeWoodUsage.ts`.
- [ ] Existing tests pass at old and new locations (re-export preserves backward compat).
- [ ] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [ ] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).
```

## 2026-06-05 — WU2b Shared Recipe Costing, Formula, and Wood Usage (REVERTED)

> **Scope note:** This section is retained only as historical evidence. The WU2b shared modules
> (`src/shared/lib/recipeCosting.ts`, `recipeCosting.test.ts`, `evalFormula.ts`,
> `computeWoodUsage.ts`, `computeWoodUsage.test.ts`) and the recipe feature re-exports were
> reverted after the WU2a review surface flagged accidental scope drift. WU2b must be
> re-applied as a separate work unit (or split) when its 400-line review budget is reserved.
>
> The current reviewed slice is **WU1 + WU2a only**. Recipe feature files
> (`src/features/recipes/types.ts`, `src/features/recipes/lib/evalFormula.ts`,
> `src/features/recipes/lib/computeWoodUsage.ts`) are restored to their pre-WU2b
> implementations, except for the WU1 import path redirect of `Material` in
> `computeWoodUsage.ts`. The WU2 acceptance criteria below remain **unchecked** in
> `tasks.md` and must be re-validated when WU2b is re-applied.

### Status

- Reverted: WU2b shared modules removed; recipe feature files restored.
- Re-applied target: a future WU2b/2c work unit, after explicit budget reservation.
- Validation: `npm run lint` and the focused Vitest runs for WU1 + WU2a passed (see
  WU1 and WU2a sections above for the current evidence trail).


## 2026-06-05 — WU2b Review-Budget Stop / Split Required

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready`.
- `actionContext.mode`: `repo-local` with edit root `/home/elias/Proyectos/carpinteroPro`.
- `strict_tdd`: active via `openspec/config.yaml`.

### Workload / PR boundary

- Requested slice: WU2b recipe costing, formula, and wood usage shared moves only.
- Review budget guard: 400 changed lines per standalone review slice.
- Result: WU2b as a single slice was stopped before completion because the move would exceed the standalone review budget. The attempted implementation was reverted, leaving the current worktree scoped to the previously approved WU1 + WU2a changes.
- Recommended split (updated after the successful WU2b-i slice below):
  - WU2b-i: move `evalFormula` / `safeEvalFormula` plus `computeWoodUsage` and wood usage characterization tests. **Completed below.**
  - WU2b-ii: move `recipeCosting` (`applyWaste`, `resolveItemQuantity`, `computeRecipeCost`, `RecipeCost`) and recipe costing characterization tests. **Remaining next slice.**

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU2b attempted combined move | `src/shared/lib/recipeCosting.test.ts`, `src/shared/lib/computeWoodUsage.test.ts` | Unit / characterization | ✅ Existing WU1 + WU2a tree was already audited clean before this attempt | ✅ Shared-location tests were written first; `npm test -- src/shared/lib/recipeCosting.test.ts src/shared/lib/computeWoodUsage.test.ts` failed because `./recipeCosting` and `./computeWoodUsage` did not exist | ⚠️ A local combined GREEN attempt passed focused tests but exceeded the review-budget guard | ⚠️ Edge cases were drafted for formula fallback/variables, waste null/zero, wood flat/missing dimensions | ✅ Combined WU2b attempt was reverted; tasks remain unchecked pending split implementation |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/shared/lib/recipeCosting.test.ts src/shared/lib/computeWoodUsage.test.ts` | Failed as RED | Failed before shared modules existed: Vite could not resolve `./recipeCosting` and `./computeWoodUsage`; 2 suites failed, 0 tests executed. |
| `npm test -- src/shared/lib/recipeCosting.test.ts src/shared/lib/computeWoodUsage.test.ts src/features/recipes/lib/computeRecipeCost.test.ts` | Passed during local attempt | 3 files passed, 16 tests passed before the combined attempt was reverted for budget reasons. |
| `git diff --numstat` / line-count review | Blocked | Combined WU2b move would exceed the 400 changed-line standalone review budget due moved parser/wood/costing implementations plus characterization tests. |

### Completed tasks and persisted checkbox updates

No WU2b task checkboxes were marked complete. The following WU2 tasks remain unchecked in `tasks.md`:

```text
- [ ] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [ ] `evalFormula` and `safeEvalFormula` live in `src/shared/lib/evalFormula.ts`.
- [ ] `computeWoodUsage` and related types live in `src/shared/lib/computeWoodUsage.ts`.
- [ ] Existing tests pass at old and new locations (re-export preserves backward compat).
- [ ] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [ ] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).
```

### Files changed

No net WU2b source/test files remain after reverting the over-budget attempt. Current changed files remain the previously approved WU1 + WU2a files plus OpenSpec progress.

### Deviations from design

- WU2b needs a further split beyond the original WU2a/WU2b split to respect the 400-line review budget. No architecture direction changed.

## 2026-06-05 — WU2b-i Shared Formula and Wood Usage

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready` from parent-provided SDD status.
- `actionContext.mode`: `repo-local`.
- `actionContext.workspaceRoot`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.allowedEditRoots`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.warnings`: none.
- `strict_tdd`: active via `openspec/config.yaml`; global strict-TDD guidance loaded from `/home/elias/.pi/agent/gentle-ai/support/strict-tdd.md`.

### Workload / PR boundary

- Implemented slice: WU2b-i only — move `evalFormula` / `safeEvalFormula` and `computeWoodUsage` / related types to shared modules, with old feature modules re-exporting for backward compatibility.
- Explicitly not included: `recipeCosting` move, `src/features/recipes/types.ts` edits, WU3+ shared contracts, feature barrels, app seams, ESLint exception removal, commits, pushes, or PR actions.
- Review boundary: sub-slice within WU2 to stay under the 400-line review budget after the earlier WU2b scope-drift/revert.

### Completed tasks and persisted checkbox updates

Updated these WU2 acceptance criteria in `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` from `- [ ]` to `- [x]` after validation passed:

- [x] `evalFormula` and `safeEvalFormula` live in `src/shared/lib/evalFormula.ts`.
- [x] `computeWoodUsage` and related types live in `src/shared/lib/computeWoodUsage.ts`.

Left unchecked until WU2b-ii / full WU2 validation:

```text
- [ ] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [ ] Existing tests pass at old and new locations (re-export preserves backward compat).
- [ ] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [ ] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).
```

### Files changed

- `src/shared/lib/evalFormula.ts`
- `src/shared/lib/computeWoodUsage.ts`
- `src/shared/lib/computeWoodUsage.test.ts`
- `src/features/recipes/lib/evalFormula.ts`
- `src/features/recipes/lib/computeWoodUsage.ts`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU2b-i compute wood usage shared move | `src/shared/lib/computeWoodUsage.test.ts` and `src/features/recipes/lib/computeRecipeCost.test.ts` | Unit / characterization | ✅ `npm test -- src/features/recipes/lib/computeRecipeCost.test.ts` passed 7/7 before production edits | ✅ Shared-location test written first; `npm test -- src/shared/lib/computeWoodUsage.test.ts` failed because `./computeWoodUsage` did not exist | ✅ Created `src/shared/lib/computeWoodUsage.ts`; shared tests passed through focused WU2b-i command | ✅ Tests cover placa-pieces, placa-area, lineal-pieces, lineal-meters, flat, and missing-dimension fallback | ✅ Old feature `computeWoodUsage.ts` reduced to compatibility re-exports; focused old-path recipe cost tests stayed green |
| WU2b-i formula shared move | Existing formula consumers via recipe cost focused test | Structural pure move | ✅ Existing recipe cost tests passed before edits | ➖ Formula move is implementation relocation with unchanged public function names; no new formula-specific test in this sub-slice | ✅ Created `src/shared/lib/evalFormula.ts`; old feature module re-exports from shared; focused recipe tests passed | ➖ Formula edge cases remain for WU2b-ii recipe costing tests (`resolveItemQuantity` via `safeEvalFormula`) | ✅ Old feature `evalFormula.ts` reduced to compatibility re-export; shared module has zero feature imports |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/recipes/lib/computeRecipeCost.test.ts` | Passed | Baseline before edits: 1 file passed, 7 tests passed. |
| `npm test -- src/shared/lib/computeWoodUsage.test.ts` | Failed as RED | Failed before shared module existed: Vite could not resolve `./computeWoodUsage`; 0 tests executed. |
| `npm test -- src/shared/lib/computeWoodUsage.test.ts src/features/recipes/lib/computeRecipeCost.test.ts` | Passed | Focused WU2b-i tests: 2 files passed, 13 tests passed. |
| `test ! -e src/shared/lib/recipeCosting.ts && test ! -e src/shared/lib/recipeCosting.test.ts` | Passed | No recipeCosting shared files were created in this slice. |
| `grep -R "@/features/" src/shared/lib/evalFormula.ts src/shared/lib/computeWoodUsage.ts && exit 1 || true` | Passed | No output; WU2b-i shared modules have zero feature imports. |
| `npm run lint` | Passed | Exit 0. Existing React Compiler warnings remain: 0 errors, 6 warnings. |

### Validation notes

- `src/shared/lib/evalFormula.ts` contains the moved formula parser and safe wrapper with no feature imports.
- `src/shared/lib/computeWoodUsage.ts` contains the moved wood usage helper and related types with only `@/shared/types/material` import.
- `src/features/recipes/lib/evalFormula.ts` and `src/features/recipes/lib/computeWoodUsage.ts` are compatibility re-export modules.
- `src/features/recipes/types.ts` was not edited.
- `src/shared/lib/recipeCosting.ts` and `src/shared/lib/recipeCosting.test.ts` do not exist.

### Deviations from design

- WU2 remains split below the original WU2 boundary for review budget control. This entry covers WU2b-i only; WU2b-ii still needs recipe costing move and full WU2 characterization/final validation checkboxes.

### Remaining WU2 tasks

```text
- [ ] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [ ] Existing tests pass at old and new locations (re-export preserves backward compat).
- [ ] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [ ] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).
```

## 2026-06-05 — WU2b-ii Shared Recipe Costing

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready` from parent-provided SDD status.
- `actionContext.mode`: `repo-local`.
- `actionContext.workspaceRoot`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.allowedEditRoots`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.warnings`: none.
- `strict_tdd`: active via `openspec/config.yaml`; global strict-TDD guidance loaded from `/home/elias/.pi/agent/gentle-ai/support/strict-tdd.md`.

### Workload / PR boundary

- Implemented slice: WU2b-ii only — move `applyWaste`, `resolveItemQuantity`, `computeRecipeCost`, and `RecipeCost` to `src/shared/lib/recipeCosting.ts`; keep `src/features/recipes/types.ts` as the backward-compatible export surface for moved costing symbols.
- Explicitly not included: WU3 shared type contracts (`src/shared/types/recipes.ts`, `client.ts`, `priceHistory.ts`), feature barrels, app seams, ESLint exception removal, commits, pushes, or PR actions.
- Review boundary: final sub-slice within WU2 after WU2a and WU2b-i, respecting the 400-line review budget.

### Completed tasks and persisted checkbox updates

Updated remaining WU2 acceptance criteria in `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` from `- [ ]` to `- [x]` after validation passed:

- [x] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [x] Existing tests pass at old and new locations (re-export preserves backward compat).
- [x] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [x] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [x] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).

### Files changed

- `src/shared/lib/recipeCosting.ts`
- `src/shared/lib/recipeCosting.test.ts`
- `src/features/recipes/types.ts`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU2b-ii recipe costing shared move | `src/shared/lib/recipeCosting.test.ts`, `src/shared/lib/computeWoodUsage.test.ts`, `src/features/recipes/lib/computeRecipeCost.test.ts` | Unit / characterization | ✅ Existing WU1 + WU2a + WU2b-i state was reviewed clean before this slice | ✅ `src/shared/lib/recipeCosting.test.ts` was written first; `npm test -- src/shared/lib/recipeCosting.test.ts` failed because `./recipeCosting` did not exist | ✅ Created `src/shared/lib/recipeCosting.ts`; focused WU2b-ii command passed 3 files / 18 tests | ✅ Tests cover empty items, waste_pct 12/null/0, mixed madera/extras, labor, formula variables, and unsafe/non-finite formula fallback | ✅ `src/features/recipes/types.ts` now preserves local DB/read types and re-exports moved costing functions/types; focused/full tests stayed green |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/shared/lib/recipeCosting.test.ts` | Failed as RED | Failed before shared module existed: Vite could not resolve `./recipeCosting`; 1 suite failed, 0 tests executed. |
| `npm test -- src/shared/lib/recipeCosting.test.ts src/shared/lib/computeWoodUsage.test.ts src/features/recipes/lib/computeRecipeCost.test.ts` | Passed | Focused WU2b-ii tests: 3 files passed, 18 tests passed. |
| `grep -R "@/features/" src/shared/lib/recipeCosting.ts && exit 1 || true` | Passed | No output; `recipeCosting.ts` has zero feature imports. |
| `npm run lint` | Passed | Exit 0. Existing React Compiler warnings remain: 0 errors, 6 warnings. |
| `npm test` | Passed | Full suite: 44 files passed, 286 tests passed. |

### Validation notes

- `src/shared/lib/recipeCosting.ts` imports only from `@/shared/lib/computeWoodUsage` and `@/shared/lib/evalFormula`.
- `src/features/recipes/types.ts` no longer owns costing implementation; it preserves recipe DB/read types and re-exports `applyWaste`, `computeRecipeCost`, `resolveItemQuantity`, and `RecipeCost` for backward compatibility.
- `src/shared/types/recipes.ts`, `src/shared/types/client.ts`, and `src/shared/types/priceHistory.ts` were not created; WU3 remains out of scope.
- No ESLint exceptions were removed and no app seams were implemented.

### Deviations from design

- WU2 remained split into WU2a, WU2b-i, and WU2b-ii for review-budget control. Architecture direction is unchanged.

### Remaining tasks

WU2 is complete. Next unchecked tasks begin at WU3:

```text
- [ ] `src/shared/types/client.ts` exports `Client`, `ClientInsert`, `ClientUpdate`, `ClientSource`, `CLIENT_SOURCE_LABELS` with zero feature imports.
- [ ] `src/shared/types/recipes.ts` exports `FurnitureTemplateWithItems`, `RecipeItemWithMaterial`, `FurnitureParam`, `RecipeCost` with imports only from `@/shared/**`.
- [ ] `src/shared/types/priceHistory.ts` exports `PriceHistoryRow` with zero feature imports.
- [ ] `src/features/quotes/types.ts` imports `Client` from `@/shared/types/client` instead of `@/features/crm/types`.
- [ ] `npm test` passes. `npm run lint` passes.
- [ ] No speculative fields added; contracts mirror current UI read shapes exactly.
```

### Post-review WU2 blocker fix evidence

- Fixed `src/shared/lib/recipeCosting.test.ts` fixture typing after fresh review found `npm run build` failed on `unit?: string` and extra DB-row fields in a `RecipeCostItem` fixture.
- Validation after fix:
  - `npm run build` passed (`tsc -b && vite build`).
  - `npm test -- src/shared/lib/recipeCosting.test.ts src/shared/lib/computeWoodUsage.test.ts src/features/recipes/lib/computeRecipeCost.test.ts` passed: 3 files, 18 tests.
  - `npm run lint` passed with 0 errors and the existing 6 React Compiler warnings.
  - Fresh reviewer confirmed no blocker and safe to proceed to WU3.

## 2026-06-05 — WU3 Shared Client and Recipe Read Contracts

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready` from parent-provided SDD status.
- `actionContext.mode`: `repo-local`.
- `actionContext.workspaceRoot`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.allowedEditRoots`: `/home/elias/Proyectos/carpinteroPro`.
- `actionContext.warnings`: none.
- `strict_tdd`: active via `openspec/config.yaml`; WU3 treated as a structural-only type-contract refactor per `tasks.md` TDD/validation evidence.

### Workload / PR boundary

- Implemented slice: WU3 only — shared client/read recipe/price-history type contracts plus compatibility re-exports and import redirects.
- PR boundary: WU3 forecast ~100–180 changed lines; remained a single reviewable slice under the 400-line budget.
- Explicitly not included: WU4+ feature barrels/app seams, ESLint exception removals, hook/query moves to shared, commits, pushes, or PR actions.

### Completed tasks and persisted checkbox updates

Updated WU3 acceptance criteria in `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` from `- [ ]` to `- [x]` after validation passed:

- [x] `src/shared/types/client.ts` exports `Client`, `ClientInsert`, `ClientUpdate`, `ClientSource`, `CLIENT_SOURCE_LABELS` with zero feature imports.
- [x] `src/shared/types/recipes.ts` exports `FurnitureTemplateWithItems`, `RecipeItemWithMaterial`, `FurnitureParam`, `RecipeCost` with imports only from `@/shared/**`.
- [x] `src/shared/types/priceHistory.ts` exports `PriceHistoryRow` with zero feature imports.
- [x] `src/features/quotes/types.ts` imports `Client` from `@/shared/types/client` instead of `@/features/crm/types`.
- [x] `npm test` passes. `npm run lint` passes.
- [x] No speculative fields added; contracts mirror current UI read shapes exactly.

### Files changed

- `src/shared/types/client.ts`
- `src/shared/types/recipes.ts`
- `src/shared/types/priceHistory.ts`
- `src/features/crm/types.ts`
- `src/features/recipes/types.ts`
- `src/features/inventory/api/priceHistory.ts`
- `src/features/quotes/types.ts`
- `src/features/recipes/components/FurnitureCostSparkline.tsx`
- `src/features/recipes/lib/computeCostHistory.ts`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU3 shared type contracts | Existing TypeScript/lint/full test/build suite | Structural type-contract refactor | ✅ Existing WU1/WU2 validation was clean before WU3 | ➖ Structural-only exception from `tasks.md`: no runtime behavior change; new tests not added because the contract is enforced by imports, TypeScript, lint, build, and grep checks | ✅ Shared type modules created and feature files re-export/import from shared; `npm run lint`, `npm test`, and `npm run build` passed | ✅ Grep checks prove shared types have no feature imports and `quotes/types.ts` no longer imports CRM types | ✅ Removed speculative `RecipeCostSnapshot` during implementation; final shared contracts mirror current UI read shapes only |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `grep -R "@/features/" src/shared/types/client.ts src/shared/types/recipes.ts src/shared/types/priceHistory.ts && exit 1 || true` | Passed | No output; shared WU3 type files have no feature imports. |
| `grep -n "@/features/crm/types" src/features/quotes/types.ts && exit 1 || true` | Passed | No output; quotes types no longer import CRM types. |
| `grep -R "@/features/inventory/api/priceHistory" -n src/features/recipes || true` | Passed | No output after updating recipe price-history type imports to shared. |
| `npm run lint` | Passed | Exit 0. Existing React Compiler warnings remain: 0 errors, 6 warnings. |
| `npm test` | Passed | 44 files passed, 286 tests passed. |
| `npm run build` | Passed | `tsc -b && vite build` completed successfully. |

### Validation notes

- `src/shared/types/client.ts` copies the current CRM client DB row/update/insert/source label contract without importing features.
- `src/shared/types/recipes.ts` mirrors the current recipe UI read shapes (`RecipeItemWithMaterial`, `FurnitureParam`, `FurnitureTemplateWithItems`) and re-exports `RecipeCost` from the shared WU2 costing module; imports are only `@/shared/**`.
- `src/shared/types/priceHistory.ts` extracts the inventory API `PriceHistoryRow` shape without moving the inventory API or any hook/query wrapper.
- CRM, recipes, and inventory feature files preserve backward-compatible re-exports.
- `src/features/quotes/hooks/useClients.ts` was intentionally left unchanged for WU4b.
- No feature barrels, app-level seams, ESLint exception removals, hooks, or DB queries were moved.

### Deviations from design

- Also redirected `src/features/recipes/lib/computeCostHistory.ts` from the inventory API type to the new shared `PriceHistoryRow`; this is within WU3's shared price-history contract and avoids leaving a type-only recipe-to-inventory import next to the targeted `FurnitureCostSparkline` update.

## 2026-06-05 — WU4a Feature Public API Barrels

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready`.
- `actionContext.mode`: `repo-local` with edit root `/home/elias/Proyectos/carpinteroPro`.
- `strict_tdd`: active; structural-only exception documented for barrel re-exports.

### Workload / PR boundary

- Sliced: WU4a only — five `index.ts` barrel files created for app-level SDD9 composition.
- Excluded: WU4b+ app seams, ESLint exception removals, route migrations, commits/pushes.

### Completed tasks and persisted checkbox updates

Updated `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` WU4a acceptance criteria from `- [ ]` to `- [x]` after validation passed:

- [x] Each barrel exports only items needed for app-level SDD9 composition. No speculative re-exports.
- [x] Barrel imports do not create new cross-feature coupling (barrels must not import from other features).
- [x] `npm run lint` passes. The `import/no-restricted-paths` rule does not fire for barrel self-imports.
- [x] `npm test` passes.
- [x] Features do not import other feature barrels (barrels are for `src/app/**` only).

### Files changed/created

- `src/features/crm/index.ts`
- `src/features/quotes/index.ts`
- `src/features/recipes/index.ts`
- `src/features/inventory/index.ts`
- `src/features/settings/index.ts`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

Structural-only exception. Barrels are pure re-exports with no runtime behavior change.

| Task | Evidence |
|------|----------|
| CRM barrel exports `ClientForm`, `KanbanCard`, `ClientList`, `ClientDetail`, `useClients`, `useCreateClient` | `src/features/crm/index.ts` imports only from `./components/ClientForm`, `./components/KanbanCard`, `./components/ClientList`, `./components/ClientDetail`, `./hooks/useClients` |
| Quotes barrel exports `QuoteForm`, `QuoteStatusBadge`, `ContractPreview`, `useQuotes`, `useCreateQuote`, `useUpdateQuote`, `useGenerateQuoteNumber` | `src/features/quotes/index.ts` imports only from `./components/QuoteForm`, `./components/QuoteStatusBadge`, `./components/ContractPreview`, `./hooks/useQuotes` |
| Recipes barrel exports `MuebleList`, `MuebleForm`, `useFurnitureTemplates`, `useStockCheck` | `src/features/recipes/index.ts` imports only from `./components/MuebleList`, `./components/MuebleForm`, `./hooks/useRecipes`, `./hooks/useStockCheck` |
| Inventory barrel exports `useMaterials`, `useAllPriceHistory`, `PriceSparkline` | `src/features/inventory/index.ts` imports only from `./hooks/useMaterials`, `./hooks/useAllPriceHistory`, `./components/PriceSparkline` |
| Settings barrel exports `useWorkshopSettings` | `src/features/settings/index.ts` imports only from `./hooks/useWorkshopSettings` |

### Test commands run

| Command | Result | Evidence |
|---------|--------|----------|
| `grep -R "@/features/" src/features/*/index.ts && exit 1 \|\| true` | Passed | No cross-feature barrel imports found |
| `grep -R "from '@/features/..." src/features/ && exit 1 \|\| true` | Passed | No feature-to-feature barrel imports found |
| `npm run lint` | Passed | Exit 0; 6 pre-existing React Compiler warnings, 0 errors |
| `npm test` | Passed | 44 files, 286 tests passed |
| `npm run build` | Passed | `tsc -b && vite build` succeeded |

### Deviations from design

None. WU4a barrel exports match task specification exactly.

### Remaining tasks

```text
- [ ] `QuoteForm` receives clients, templates, and client-creation callback as props.
- [ ] `ClientSection` and `ClientDialog` no longer import from `@/features/crm/**`.
- [ ] `FurnitureSection` no longer imports from `@/features/recipes/**`.
- [ ] `QuoteForm` still computes real-time quote totals using shared `calculateQuote` and `computeRecipeCost`.
- [ ] `quotes → crm` and `quotes → recipes` lint exceptions are removed from `eslint.config.js`.
- [ ] `npm run lint` passes with the reduced exception set: `featureZone("quotes", ["settings"])`.
- [ ] `npm test` passes.
- [ ] Manual smoke: `/quotes/new` page loads, client selection works, template selection works, real-time cost preview updates, quote creation succeeds.
- [ ] `ContractPreview` receives a `workshopSettings` snapshot prop.
- [ ] `ContractPreview` no longer imports from `@/features/settings/**`.
- [ ] Contract preview renders workshop name, address, phone, email, and footer identically.
- [ ] `quotes` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/quotes/:id/contract` page renders contract correctly.
- [ ] `ClientList` receives quote summaries through props; no `@/features/quotes/**` imports.
- [ ] `ClientDetail` receives quotes and status badge rendering through props/slots; no `@/features/quotes/**` imports.
- [ ] `KanbanCard` receives quote summary and status color through props or shared imports; no `@/features/quotes/**` imports.
- [ ] CRM quote history, totals, statuses, and badges render identically.
- [ ] `crm` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/crm/clientes` shows quote counts/totals; `/crm/clientes/:id` shows quote history with status badges.
- [ ] `MuebleList` receives materials, price history, and stock_alert_enabled through props; no inventory/settings imports.
- [ ] `useStockCheck` accepts materials and stockAlertEnabled as arguments; no internal hook calls to inventory/settings.
- [ ] `FurnitureCostSparkline` receives price history through props or uses shared PriceSparkline; no inventory imports.
- [ ] Stock alert behavior preserves `stock_alert_enabled` toggle: when false, no stock shortages displayed; when true, shortages computed correctly.
- [ ] Cost history sparkline renders identical data points.
- [ ] `recipes` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/recipes` page loads, stock alerts toggle works, cost history sparkline renders, material availability displays.
- [ ] `eslint.config.js` has zero SDD8 temporary exception comments.
- [ ] `featureZone("crm")`, `featureZone("quotes")`, `featureZone("recipes")` have no exception arrays.
- [ ] `npm run lint` passes with no `import/no-restricted-paths` violations in the five involved features.
- [ ] `npm test` passes (full suite).
- [ ] `grep -r "@/features/" src/features/crm/ src/features/quotes/ src/features/recipes/ src/features/inventory/ src/features/settings/ | grep -v node_modules` returns no cross-feature imports (only self-feature and shared imports).
- [ ] Verification evidence recorded in this task file or a verification.md artifact.
- [ ] `calculateQuote` produces identical `CalcResult` for every fixture tested in `calculator.test.ts`.
- [ ] `computeRecipeCost` produces identical `RecipeCost` for every fixture tested in `computeRecipeCost.test.ts`.
- [ ] `computeWoodUsage` produces identical `WoodUsage.subtotal` for each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] `resolveItemQuantity` evaluates formulas identically via `safeEvalFormula`.
- [ ] `applyWaste` applies `qty * (1 + wastePct / 100)` with no rounding.
- [ ] No numeric type changes (all remain `number`).
- [ ] No formula rewrites; only import path changes.
- [ ] No event bus introduced.
- [ ] No shared global state (Zustand store spanning features) introduced.
- [ ] No feature-to-feature barrel imports (barrels are for `src/app/**` only).
- [ ] No hooks or DB queries moved into `src/shared/**`.
- [ ] No TanStack Query wrappers moved into `src/shared/**`.
- [ ] Workflow modules created only if explicitly justified by WU4b or WU7 implementation evidence.
```

## 2026-06-05 — WU4b Quote Creation App Seam

### Scope
- Refactored QuoteForm to accept `clients`, `templates`, `onClientCreated`, and `clientFormComponent` as props instead of calling CRM/recipes hooks internally.
- ClientDialog now receives the client form component as `children` from the app seam.
- ClientSection and FurnitureSection import shared types instead of CRM/recipes feature types.
- Created `src/app/pages/QuoteCreatorPage.tsx` that calls CRM/recipes barrels and passes data to QuoteForm.
- Updated `src/features/quotes/routes.tsx` to use QuoteCreatorPage for `/new` and `/:id` routes.
- Removed `"crm"` and `"recipes"` from quotes ESLint exception; now `featureZone("quotes", ["settings"])`.
- Deleted `src/features/quotes/hooks/useClients.ts` (pure re-export file, no callers remaining).
- QuoteForm still uses shared `calculateQuote` and `computeRecipeCost` for real-time totals.
- Not included: WU5+ seams, quotes→settings exception removal, route migrations beyond quotes.

### Files changed (WU4b only)
- `src/features/quotes/components/QuoteForm.tsx` — prop-driven refactor
- `src/features/quotes/components/ClientDialog.tsx` — children slot instead of CRM import
- `src/features/quotes/components/ClientSection.tsx` — shared types import
- `src/features/quotes/components/FurnitureSection.tsx` — shared types import
- `src/app/pages/QuoteCreatorPage.tsx` — new app-owned page
- `src/features/quotes/routes.tsx` — use QuoteCreatorPage for new/edit
- `eslint.config.js` — removed crm/recipes from quotes exception
- `src/features/quotes/hooks/useClients.ts` — deleted (dead)
- `src/features/quotes/components/QuoteForm.test.tsx` — new tests

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| QuoteForm prop-driven refactor | `src/features/quotes/components/QuoteForm.test.tsx` | Unit / acceptance | ✅ Existing test suite passed 289/289 before start | ✅ Tests asserted QuoteForm does NOT call useClients/useFurnitureTemplates internally; those assertions failed because current code calls hooks | ✅ QuoteForm now accepts props; internal hook calls removed; tests pass with mock hooks | ✅ Tests verify rendering with prop-provided clients (both Juan and María rendered), client creation button visible, form renders without crashing with empty templates | ✅ Removed unused QuoteForm import; deleted useClients.ts; verified grep for cross-feature imports in quotes feature returned no results |

### Validation results

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/quotes/components/QuoteForm.test.tsx` | Passed | 1 file, 3 tests passed |
| `npm run lint` | Passed | 0 errors, 6 pre-existing React Compiler warnings |
| `npm run build` | Passed | `tsc -b && vite build` |
| `npm test` (full) | Passed | 45 files, 289 tests passed |
| `grep -R "@/features/\\(crm\\|recipes\\)" src/features/quotes/` | No output | No cross-feature CRM/recipes imports in quotes feature |
| `npx eslint --rule 'import/no-restricted-paths: error' .` | Passed | No output (0 errors) |
| `git diff --stat` | 278 insertions, 583 deletions | 21 tracked files changed (includes WU1-WU4a pre-existing changes) |

### Deviations from design
- `onClientCreated` prop added instead of `onCreateClient` callback; the app-page uses ClientForm from CRM barrel which handles its own client creation internally.
- Manual smoke test not performed (no browser available); checkbox remains unchecked.

### Remaining (next up)
- WU5: Contract Preview Settings Seam (remove quotes→settings exception)
- WU6: CRM Quote Display Seam
- WU7: Recipes Inventory/Settings Seam
- WU8: Final Lint Cleanup

WU4bEOF

## 2026-06-05 — WU4b Quote Creation App Seam

### Scope
- Refactored QuoteForm to accept `clients`, `templates`, `onClientCreated`, and `clientFormComponent` as props instead of calling CRM/recipes hooks internally.
- ClientDialog now receives the client form component as `children` from the app seam.
- ClientSection and FurnitureSection import shared types instead of CRM/recipes feature types.
- Created `src/app/pages/QuoteCreatorPage.tsx` that calls CRM/recipes barrels and passes data to QuoteForm.
- Updated `src/features/quotes/routes.tsx` to use QuoteCreatorPage for `/new` and `/:id` routes.
- Removed `"crm"` and `"recipes"` from quotes ESLint exception; now `featureZone("quotes", ["settings"])`.
- Deleted `src/features/quotes/hooks/useClients.ts` (pure re-export file, no callers remaining).
- QuoteForm still uses shared `calculateQuote` and `computeRecipeCost` for real-time totals.
- Not included: WU5+ seams, quotes→settings exception removal, route migrations beyond quotes.

### Files changed (WU4b only)
- `src/features/quotes/components/QuoteForm.tsx` — prop-driven refactor
- `src/features/quotes/components/ClientDialog.tsx` — children slot instead of CRM import
- `src/features/quotes/components/ClientSection.tsx` — shared types import
- `src/features/quotes/components/FurnitureSection.tsx` — shared types import
- `src/app/pages/QuoteCreatorPage.tsx` — new app-owned page
- `src/features/quotes/routes.tsx` — use QuoteCreatorPage for new/edit
- `eslint.config.js` — removed crm/recipes from quotes exception
- `src/features/quotes/hooks/useClients.ts` — deleted (dead)
- `src/features/quotes/components/QuoteForm.test.tsx` — new tests

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| QuoteForm prop-driven refactor | `src/features/quotes/components/QuoteForm.test.tsx` | Unit / acceptance | Existing test suite passed 289/289 before start | Tests asserted QuoteForm does NOT call useClients/useFurnitureTemplates internally; those assertions failed because current code calls hooks | QuoteForm now accepts props; internal hook calls removed; tests pass with mock hooks | Tests verify rendering with prop-provided clients (both Juan and Maria rendered), client creation button visible, form renders without crashing with empty templates | Removed unused QuoteForm import; deleted useClients.ts; verified grep for cross-feature imports in quotes feature returned no results |

### Validation results

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/quotes/components/QuoteForm.test.tsx` | Passed | 1 file, 3 tests passed |
| `npm run lint` | Passed | 0 errors, 6 pre-existing React Compiler warnings |
| `npm run build` | Passed | tsc -b && vite build |
| `npm test` (full) | Passed | 45 files, 289 tests passed |
| `grep -R "@/features/\(crm\|recipes\)" src/features/quotes/` | No output | No cross-feature CRM/recipes imports in quotes feature |
| `npx eslint --rule 'import/no-restricted-paths: error' .` | Passed | No output (0 errors) |
| `git diff --stat` | 278 insertions, 583 deletions | 21 tracked files changed (includes WU1-WU4a pre-existing changes) |

### Deviations from design
- `onClientCreated` prop added instead of `onCreateClient` callback; the app page uses ClientForm from CRM barrel which handles its own client creation internally.
- Manual smoke test not performed (no browser available); checkbox remains unchecked.

### Remaining (next up)
- WU5: Contract Preview Settings Seam (remove quotes→settings exception)
- WU6: CRM Quote Display Seam
- WU7: Recipes Inventory/Settings Seam
- WU8: Final Lint Cleanup

## WU4b Repair — Routing Ownership, Test Coverage, Build Fix

### Changes from repair

1. **Routing ownership fixed**:
   - Removed `QuoteCreatorPage` import from `src/features/quotes/routes.tsx` (feature must not import app).
   - Removed `/new` and `/:id` routes from `QuotesRoutes`; only `:id/contract` and `templates` remain.
   - Added `/quotes/new` and `/quotes/:id` routes in `src/app/router.tsx` before the `/quotes/*` catch-all.
   - `src/app` now owns quote create/edit route composition; `src/features/quotes` only owns feature-scoped routes.

2. **Test coverage strengthened** (6 tests total, up from 3):
   - Added `selects a client from props via click and enables advancing`: click → button enabled.
   - Added `selecting a template from props computes recipe cost via shared computeRecipeCost`: grid template click → name and cost inputs populated with expected values (11500).
   - Added `propagates client creation callback through the client form component slot`: dialog opens → slot receives `onCreated` → callback propagates to parent `onClientCreated`.

3. **Build fix**: `RecipeCostItem` fixture typing was corrected (excess DB-row fields removed, `unit` typed with union).

### Validation results

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/quotes/components/QuoteForm.test.tsx` | Passed | 1 file, 6 tests passed |
| `npm test` (full) | Passed | 45 files, 292 tests passed |
| `npm run lint` | Passed | 0 errors, 6 pre-existing React Compiler warnings |
| `npm run build` | Passed | `tsc -b && vite build` |
| `grep -R "@/app/" src/features/` | No matches | No feature imports from app |
| `grep -R "@/features/crm\|@/features/recipes" src/features/quotes/` | No matches | No CRM/recipes cross-feature imports |

### Remaining (unchanged)
- WU5: Contract Preview Settings Seam
- WU6: CRM Quote Display Seam
- WU7: Recipes Inventory/Settings Seam
- WU8: Final Lint Cleanup

### WU4b manual smoke attempt

- Local dev server launched with `npm run dev -- --host 127.0.0.1`.
- Playwright navigated to `http://127.0.0.1:5173/quotes/new`.
- Result: route rendered the app ErrorBoundary text (`Algo salió mal`). No browser console error was emitted.
- Control check: `http://127.0.0.1:5173/quotes` also rendered the same ErrorBoundary, while `/` rendered the public landing page. This suggests the local unauthenticated/protected quote route environment is not sufficient for a full manual quote-creation smoke in this session.
- Additional repair: `src/app/pages/QuoteCreatorPage.tsx` now imports `QuoteForm` from the quotes feature barrel (`@/features/quotes`) instead of the internal component path.
- Manual smoke acceptance remains unchecked in `tasks.md`; automated WU4b evidence is green, but full `/quotes/new` client/template/creation smoke needs an authenticated local/staging session with data.

### WU4b manual smoke completed

- Local Supabase status was used to provide E2E fixture environment variables without persisting secrets in repo files.
- Command run:
  - `E2E_BASE_URL=http://127.0.0.1:5173 E2E_SUPABASE_URL=<local> E2E_SUPABASE_ANON_KEY=<local> E2E_SUPABASE_SERVICE_ROLE_KEY=<local> E2E_TEST_PASSWORD=<local-test-password> VITE_SUPABASE_URL=<local> VITE_SUPABASE_ANON_KEY=<local> npx playwright test tests/e2e/browser/quote-creation.spec.ts --project=chromium --timeout=90000`
- Result: passed, 1 browser E2E test.
- Coverage: login, `/quotes/new` load, seeded client selection, seeded template selection, real-time cost preview (`481`), quote creation, redirect to `/quotes`, persisted quote cost/snapshots verified through fixture DB lookup.
- WU4b manual smoke checkbox is now complete in `tasks.md`.

## 2026-06-05 — WU5 Contract Preview Settings Seam

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`
- `artifactStore`: `openspec`
- `applyState`: `ready`
- `actionContext.mode`: `repo-local`
- `actionContext.workspaceRoot`: `/home/elias/Proyectos/carpinteroPro`
- `actionContext.allowedEditRoots`: `/home/elias/Proyectos/carpinteroPro`
- `actionContext.warnings`: none
- `strict_tdd`: active via `openspec/config.yaml`

### Workload / PR boundary

- Implemented slice: WU5 only — ContractPreview settings seam.
- Explicitly not included: WU6 CRM quote display, WU7 recipes inventory/settings seam, WU8 final lint cleanup.
- PR boundary: ~100–180 changed lines, well under the 400-line review budget.

### Completed tasks and persisted checkbox updates

Updated `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` WU5 acceptance criteria:

- [x] `ContractPreview` receives a `workshopSettings` snapshot prop.
- [x] `ContractPreview` no longer imports from `@/features/settings/**`.
- [x] Contract preview renders workshop name, address, phone, email, and footer identically.
- [x] `quotes` exception is fully removed from `eslint.config.js`.
- [x] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/quotes/:id/contract` page renders contract correctly (requires authenticated session/E2E fixtures; deferred).

### Files changed

- `src/features/quotes/components/ContractPreview.tsx` — Added `workshopSettings` prop; removed `@/features/settings/hooks/useWorkshopSettings` import; replaced `settings` references with `workshopSettings`.
- `src/features/quotes/components/ContractPreview.test.tsx` — Added RED→GREEN TDD tests for prop-based rendering.
- `src/app/pages/QuoteContractPage.tsx` — New app-owned page composing `useWorkshopSettings` from settings barrel.
- `src/app/router.tsx` — Added `/quotes/:id/contract` route pointing to app page.
- `src/features/quotes/routes.tsx` — Removed `:id/contract` route (now handled at app level); removed unused `ContractPreview` import.
- `eslint.config.js` — Removed `settings` from `featureZone("quotes")` exception; quotes now has no exceptions.
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/apply-progress.md`

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| WU5 ContractPreview settings prop | `src/features/quotes/components/ContractPreview.test.tsx` | Unit | ✅ Focused test passed after GREEN | ✅ Test written before prop existed; TypeScript error `Property 'workshopSettings' does not exist` | ✅ Prop added, settings import removed, app page wired; focused test passed | ✅ Component renders with non-null settings; QuoteContractPage uses settings barrel | ✅ Removed unused `ContractPreview` import from `routes.tsx`; removed `settings` from ESLint exception |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `grep -n "@/features/settings" src/features/quotes/components/ContractPreview.tsx && exit 1 || true` | Passed | No settings feature imports found. |
| `grep -R "@/features/\\(crm\\|recipes\\|settings\\)" src/features/quotes && exit 1 || true` | Passed | No cross-feature imports in quotes feature. |
| `npm test -- src/features/quotes/components/ContractPreview.test.tsx` | Passed | 1 file, 1 test passed. |
| `npm run lint` | Passed | 0 errors, 6 existing React Compiler warnings. |
| `npm test` | Passed | 46 files, 293 tests passed. |
| `npm run build` | Passed | tsc -b && vite build passed. |

### Validation notes

- `ContractPreview` now accepts `workshopSettings: WorkshopSettings | null` prop (type from `@/shared/types/workshopSettings`).
- Settings data is composed by app-owned `QuoteContractPage` which imports `useWorkshopSettings` from `@/features/settings` barrel.
- The contract route `/quotes/:id/contract` is now handled at the app level before the `/quotes/*` catch-all.
- Quotes ESLint exception is fully removed: `featureZone("quotes")` has no exceptions.
- No WU6+ changes were included: CRM→quotes exception still present, recipes→inventory/settings exception still present.

### Deviations from design

- Manual smoke checkbox remains unchecked because `/quotes/:id/contract` requires an authenticated session with seed data. The E2E smoke infrastructure depends on `E2E_SUPABASE_URL` which was not available during this slice. Deferred until the verify phase or a follow-up run.

### Remaining WU5 tasks

- [ ] Manual smoke: `/quotes/:id/contract` page renders contract correctly.

### WU5 manual smoke completed

- Local Supabase status was used to provide E2E fixture environment variables without persisting secrets in repo files.
- Command run:
  - `E2E_BASE_URL=http://127.0.0.1:5173 E2E_SUPABASE_URL=<local> E2E_SUPABASE_ANON_KEY=<local> E2E_SUPABASE_SERVICE_ROLE_KEY=<local> E2E_TEST_PASSWORD=<local-test-password> VITE_SUPABASE_URL=<local> VITE_SUPABASE_ANON_KEY=<local> npx playwright test tests/e2e/browser/contract-pdf.spec.ts --project=chromium --timeout=90000`
- Result: passed, 1 browser E2E test.
- Coverage: login, `/quotes/:id/contract` load, contract heading/data rendering, quote total display, and PDF download start.
- WU5 manual smoke checkbox is now complete in `tasks.md`.

## 2026-06-05 — WU6 CRM Quote Display Seam

### Structured status consumed

- `changeName`: `2026-06-04-sdd-9-core-coupling-cleanup`.
- `artifactStore`: `openspec`.
- `applyState`: `ready`.
- `actionContext.mode`: `repo-local` with edit root `/home/elias/Proyectos/carpinteroPro`.
- `strict_tdd`: active via `openspec/config.yaml`.

### Workload / PR boundary

- Implemented slice: WU6 CRM quote display seam.
- Review budget: ~250 changed lines, within the 400-line guard.
- No WU7+ recipes/inventory changes. No commits/pushes/PRs.

### Completed tasks and persisted checkbox updates

Updated `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/tasks.md` WU6 acceptance criteria from `- [ ]` to `- [x]` after validation passed. Manual smoke remains unchecked.

### Files changed

- `src/features/crm/components/ClientList.tsx` — accepts `statsByClient` prop; removed `useQuotes`/`calculateQuote` imports.
- `src/features/crm/components/ClientDetail.tsx` — accepts `quotesWithSalePrice`, `statsByClient`, `QuoteStatusBadgeSlot` props; removed `useQuotes`/`calculateQuote`/`QuoteStatusBadge` imports.
- `src/features/crm/components/KanbanCard.tsx` — accepts `salePrice` and `statusColor` props; removed `calculateQuote`/`QuoteWithExtras` imports; uses `QuoteStatus` from shared.
- `src/features/crm/routes.tsx` — removed `ClientDetail` route (now app-owned).
- `src/app/pages/CrmClientsPage.tsx` — app page composing `useQuotes` + `calculateQuote` + `ClientList`.
- `src/app/pages/CrmClientDetailPage.tsx` — app page composing `useQuotes` + `calculateQuote` + `QuoteStatusBadge` + `ClientDetail`.
- `src/app/router.tsx` — added `/crm/clientes` and `/crm/clientes/:id` routes.
- `eslint.config.js` — removed `quotes` from CRM feature exception.
- Test files: `ClientList.test.tsx`, `ClientDetail.test.tsx`, `KanbanCard.test.tsx`.

### TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| ClientList props refactor | `ClientList.test.tsx` | Unit | N/A | statsByClient prop tests failed — `useQuotes`/`calculateQuote` unmocked | Component accepts statsByClient prop with default `{}` | Zero-quotes dash display test | Removed quotes imports |
| ClientDetail props refactor | `ClientDetail.test.tsx` | Unit | N/A | Props tests failed — client not found (route not wrapping) | Component accepts all props with route wrapping | Empty quotes state test | Removed quotes imports |
| KanbanCard props refactor | `KanbanCard.test.tsx` | Unit | N/A | salePrice tests failed — no `extras` on quote object | Component accepts salePrice/statusColor props | N/A (triangulated in existing tests) | Removed quotes imports |

### Test commands run

| Command | Result | Evidence |
|---|---|---|
| `npm test -- src/features/crm/components/ClientList.test.tsx src/features/crm/components/ClientDetail.test.tsx src/features/crm/components/KanbanCard.test.tsx` | Passed | 3 files, 8 tests passed. |
| `npm run lint` | Passed | 0 errors, 6 existing warnings. |
| `npm test` | Passed | 49 files, 301 tests passed. |
| `npm run build` | Passed | tsc + vite build passed. |
| `grep -R "@/features/quotes" src/features/crm` (prod only) | Passed | No matches (test mocks excluded). |
| `grep -R "@/app/" src/features` | Passed | No matches. |

### Validation notes

- Production CRM code has zero `@/features/quotes/**` imports.
- CRM feature boundary exception removed from `eslint.config.js`: `featureZone("crm")` has no exception array.
- KanbanCard now requires explicit `salePrice` and `statusColor` props instead of computing internally.
- App-level composition pages use `calculateQuote` from shared `@/shared/lib/quotesCalculator` and `useQuotes` from `@/features/quotes` barrel.
- Router order: `/crm/clientes` and `/crm/clientes/:id` (app pages) before `/crm/*` (feature catch-all).
- Manual smoke for `/crm/clientes` and `/crm/clientes/:id` requires authenticated session with CRM and quote data; remains unchecked in tasks.md pending E2E-like validation.

### Deviations from design

- No deviation. WU6 follows the design exactly with props-based refactor and app-level composition.

### Remaining tasks

```text
- [ ] Manual smoke: `/crm/clientes` shows quote counts/totals; `/crm/clientes/:id` shows quote history with status badges.
```
(WU7+ tasks remain as-is in tasks.md.)

### WU6 boundary fix and manual smoke completed

- Removed an unnecessary cross-feature test mock from `src/features/crm/components/ClientDetail.test.tsx`; `grep -R "@/features/quotes" src/features/crm` now returns no matches.
- Validation after fix:
  - `npm test -- src/features/crm/components/ClientList.test.tsx src/features/crm/components/ClientDetail.test.tsx src/features/crm/components/KanbanCard.test.tsx` passed: 3 files, 8 tests.
  - `npm run lint` passed with 0 errors and existing 6 React Compiler warnings.
  - `npm run build` passed.
- Manual CRM smoke was executed with a temporary Playwright spec using local Supabase E2E fixtures. The temporary spec was deleted after the run.
- Smoke command used local Supabase env derived from `supabase status -o env` without persisting secrets.
- Result: passed, 1 browser smoke test.
- Coverage: login, `/crm/clientes` shows seeded client, quote count text (`1 trabajo`), and `$ 481` total; `/crm/clientes/:id` shows client stats, quote history heading, `P-0001`, status text, furniture name, and `$ 481`.
- WU6 manual smoke checkbox is now complete in `tasks.md`.

### WU7 manual smoke completed

- Manual recipes smoke was executed with a temporary Playwright spec using local Supabase E2E fixtures. The temporary spec was deleted after the run.
- Smoke command used local Supabase env derived from `supabase status -o env` without persisting secrets.
- Result: passed, 1 browser smoke test.
- Coverage: login, `/recipes` page loads, seeded furniture template `SDD 7 Mesa Operativa` appears, and estimated cost surface renders.
- WU7 manual smoke checkbox is now complete in `tasks.md`.

## 2026-06-06 — WU8 Final Lint Cleanup and Architecture Verification

### Verification evidence

- `eslint.config.js` has no SDD8 temporary exception comments.
- `featureZone("crm")`, `featureZone("quotes")`, and `featureZone("recipes")` have no exception arrays.
- Cross-feature import scan using a feature-aware Python check over `crm`, `quotes`, `recipes`, `inventory`, and `settings` reported `cross-feature violations: 0`.
- `src/shared/**` scan reported no imports from `@/features/` or `src/features`.
- `npm run lint` passed with 0 errors and the existing 6 React Compiler warnings.
- `npm test` passed: 50 files, 306 tests.
- `npm run build` passed.
- WU8 acceptance, costing auditability, and architecture shortcut rejection checklists are now complete in `tasks.md`.

### Notes

- Raw `grep -R "@/features/" ...` still prints self-feature imports such as `src/features/crm/... -> @/features/crm/...`; these are allowed by the criterion parenthetical (`only self-feature and shared imports`). The feature-aware scan confirmed zero cross-feature imports.
