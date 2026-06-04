# SDD9 Core Coupling Cleanup — Implementation Tasks

Resolve the six remaining feature-to-feature coupling exceptions with shared contracts, feature public API barrels, and app-level orchestration seams. Quote creation is the first protected workflow.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1400–2200 across all work units |
| 400-line budget risk | High (single PR) / Low (each WU individually) |
| Chained PRs recommended | Yes |
| Suggested split | WU1 → WU2 → WU3 → WU4a → WU4b → WU5 → WU6 → WU7 → WU8 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low per WU, High as single PR
```

## Work Unit Dependency Graph

```
WU1 (Material path fix)  ─────────────────────────────────────┐
WU2 (Shared calculators) ──┐                                   │
WU3 (Shared contracts)  ───┤                                   │
                            ├──→ WU4a (Feature barrels) ──┐    │
                            │                             │    │
                            │    WU4b (Quote creation     │    │
                            │         app seam) ◄─────────┘    │
                            │                                   │
                            ├──→ WU5 (Contract preview seam)    │
                            │                                   │
                            ├──→ WU6 (CRM quote display seam)   │
                            │                                   │
                            └──→ WU7 (Recipes inventory/        │
                                      settings seam) ◄─────────┘
                                                        │
                                                        ↓
                                              WU8 (Final lint cleanup)
```

## Quote Creation Priority

WU1–WU3 establish shared contracts. WU4a–WU4b wire the quote creation app seam as the first protected workflow. All subsequent WUs remove remaining exceptions after the creation seam is validated.

---

## WU1: Mechanical Material and Quote Status Path Fixes

**Goal:** Remove trivially unnecessary cross-feature imports by redirecting to already-existing shared types.

**PR boundary:** Single PR, ~30–60 changed lines.

### Target files/areas

| File | Change |
|------|--------|
| `src/features/recipes/lib/stockCheck.ts` | `@/features/inventory/types` → `@/shared/types/material` (Material type) |
| `src/features/recipes/lib/computeWoodUsage.ts` | `@/features/inventory/types` → `@/shared/types/material` (Material type) |
| `src/features/recipes/lib/computeRecipeCost.test.ts` | `@/features/inventory/types` → `@/shared/types/material` (Material type) |
| `src/features/recipes/components/ExtraItemsSection.tsx` | `@/features/inventory/types` → `@/shared/types/material` (Material type) |
| `src/features/crm/components/KanbanCard.tsx` | `@/features/quotes/types` → `@/shared/types/quotes` (QUOTE_STATUS_COLORS only) |

### Acceptance criteria

- [ ] All 5 files above import from `src/shared/**` instead of cross-feature paths for the identified symbols.
- [ ] `npm run lint` passes (exceptions still present but unused by these files).
- [ ] `npm test` passes with no behavioral changes.
- [ ] No production behavior changes; purely import path redirects.

### TDD/validation evidence

**Structural-only exception:** No runtime behavior changes. Validation: `npm run lint && npm test` both pass. Verify via `grep -r "@/features/inventory/types" src/features/recipes/` returns no matches for the changed files and `grep -r "@/features/quotes/types" src/features/crm/components/KanbanCard` returns no match for `QUOTE_STATUS_COLORS`.

### Lint exception impact

Partial reduction only. The `recipes → inventory` exception covers more sites (hooks, UI components) that are addressed in WU7. The `crm → quotes` exception covers more sites (hooks, calculator, QuoteStatusBadge) addressed in WU2/WU6. Exceptions remain in place.

### Rollback note

Revert the 5 import path changes. No shared contract or orchestration changes exist to unwind.

### May need splitting?

No. Well under budget.

---

## WU2: Shared Pure Calculators and Characterization Tests

**Goal:** Move `calculateQuote` and its types to `src/shared/lib/quotesCalculator.ts`. Move `computeRecipeCost`, `resolveItemQuantity`, `applyWaste`, and their pure dependency chain (`safeEvalFormula`, `evalFormula`, `computeWoodUsage`) to `src/shared/lib/recipeCosting.ts`. Add characterization tests capturing exact current behavior before moving.

**PR boundary:** Single PR, ~250–380 changed lines.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/shared/lib/quotesCalculator.ts` | Move `CalcInput`, `CalcExtra`, `CalcResult`, `calculateQuote` from `src/features/quotes/lib/calculator.ts` |
| **Create** `src/shared/lib/quotesCalculator.test.ts` | Move or copy existing tests from `src/features/quotes/lib/calculator.test.ts` |
| **Create** `src/shared/lib/recipeCosting.ts` | Move `applyWaste`, `resolveItemQuantity`, `computeRecipeCost`, `RecipeCost` from `src/features/recipes/types.ts` |
| **Create** `src/shared/lib/recipeCosting.test.ts` | Move or copy existing tests from `src/features/recipes/lib/computeRecipeCost.test.ts` |
| **Create** `src/shared/lib/evalFormula.ts` | Move `evalFormula`, `safeEvalFormula` from `src/features/recipes/lib/evalFormula.ts` |
| **Create** `src/shared/lib/computeWoodUsage.ts` | Move `computeWoodUsage`, `WoodMaterial`, `WoodUsage`, `WoodUsageMode` from `src/features/recipes/lib/computeWoodUsage.ts` |
| **Create** `src/shared/lib/computeWoodUsage.test.ts` | Create characterization tests for wood usage modes (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat) |
| `src/features/quotes/lib/calculator.ts` | Re-export from shared (backward compat until WU4b migrates callers) |
| `src/features/recipes/types.ts` | Re-export `computeRecipeCost`, `resolveItemQuantity`, `RecipeCost` from shared; remove local definitions |
| `src/features/recipes/lib/evalFormula.ts` | Re-export from shared (backward compat until WU7 migrates callers) |
| `src/features/recipes/lib/computeWoodUsage.ts` | Re-export from shared; fix import of Material to `@/shared/types/material` |
| `src/features/recipes/lib/stockCheck.ts` | Already uses Material from shared after WU1; `computeStockShortages` stays recipe-owned |

### Acceptance criteria

- [ ] `calculateQuote` lives in `src/shared/lib/quotesCalculator.ts` with zero feature imports.
- [ ] `computeRecipeCost` and full dependency chain live in `src/shared/lib/recipeCosting.ts` with zero feature imports.
- [ ] `evalFormula` and `safeEvalFormula` live in `src/shared/lib/evalFormula.ts`.
- [ ] `computeWoodUsage` and related types live in `src/shared/lib/computeWoodUsage.ts`.
- [ ] Existing tests pass at old and new locations (re-export preserves backward compat).
- [ ] New characterization tests cover: `calculateQuote` on_cost/on_price margins, zero-margin edge, division-by-zero guard; `computeRecipeCost` with empty items, waste_pct, mixed madera/extras, labor; `computeWoodUsage` with each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] All moved functions produce identical numeric outputs for identical inputs (fixture-based assertions).
- [ ] `npm test` passes. `npm run lint` passes (no new violations; re-exports keep old paths working).

### TDD/validation evidence

**RED:** Write characterization tests in `src/shared/lib/quotesCalculator.test.ts`, `src/shared/lib/recipeCosting.test.ts`, and `src/shared/lib/computeWoodUsage.test.ts` that assert exact current behavior with fixture inputs and expected outputs. These tests fail because the shared files do not exist yet.

**GREEN:** Move the function implementations to shared locations. Tests pass.

**TRIANGULATE:** Add edge-case tests: zero-margin recipe cost, wood usage with null dimensions, formula evaluation with variables, waste_pct of 0 and null.

**REFACTOR:** Clean up re-export files; verify no circular dependencies.

### Lint exception impact

No exception removal yet. Re-exports keep old paths working so existing feature-to-feature imports still compile. Exceptions are addressed in later WUs when callers migrate to shared imports directly.

### Rollback note

Delete the new shared files. Restore local function definitions in `src/features/quotes/lib/calculator.ts` and `src/features/recipes/types.ts`. Characterization tests revert to existing test files.

### May need splitting?

WU2 is near the budget ceiling (~380 lines including characterization tests). If estimation during implementation exceeds 400 lines, split into:
- **WU2a:** Quote calculator move + tests (~120 lines)
- **WU2b:** Recipe costing chain move + tests (~260 lines)

---

## WU3: Shared Client and Recipe Read Contracts

**Goal:** Move client types and recipe template snapshot types to shared contracts so downstream app seams can use them without cross-feature imports.

**PR boundary:** Single PR, ~100–180 changed lines.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/shared/types/client.ts` | Move `Client`, `ClientInsert`, `ClientUpdate`, `ClientSource`, `CLIENT_SOURCE_LABELS` from `src/features/crm/types.ts` |
| **Create** `src/shared/types/recipes.ts` | Move `FurnitureTemplateWithItems`, `RecipeItemWithMaterial`, `FurnitureParam`, `RecipeCost` type from `src/features/recipes/types.ts` (functions already in shared after WU2) |
| **Create** `src/shared/types/priceHistory.ts` | Extract `PriceHistoryRow` interface from `src/features/inventory/api/priceHistory.ts` |
| `src/features/crm/types.ts` | Re-export from `@/shared/types/client` (backward compat) |
| `src/features/recipes/types.ts` | Re-export `FurnitureTemplateWithItems`, `RecipeItemWithMaterial`, `FurnitureParam` from `@/shared/types/recipes`; keep DB row types locally |
| `src/features/inventory/api/priceHistory.ts` | Import `PriceHistoryRow` from `@/shared/types/priceHistory`; re-export for backward compat |
| `src/features/quotes/types.ts` | Replace `@/features/crm/types` imports with `@/shared/types/client`; remove Client/ClientSource/CLIENT_SOURCE_LABELS re-exports from CRM |
| `src/features/quotes/hooks/useClients.ts` | Mark for removal (replaced by app seam in WU4b); leave as-is for now if callers still exist |
| `src/features/recipes/components/FurnitureCostSparkline.tsx` | Update `PriceHistoryRow` import to `@/shared/types/priceHistory` |

### Acceptance criteria

- [ ] `src/shared/types/client.ts` exports `Client`, `ClientInsert`, `ClientUpdate`, `ClientSource`, `CLIENT_SOURCE_LABELS` with zero feature imports.
- [ ] `src/shared/types/recipes.ts` exports `FurnitureTemplateWithItems`, `RecipeItemWithMaterial`, `FurnitureParam`, `RecipeCost` with imports only from `@/shared/**`.
- [ ] `src/shared/types/priceHistory.ts` exports `PriceHistoryRow` with zero feature imports.
- [ ] `src/features/quotes/types.ts` imports `Client` from `@/shared/types/client` instead of `@/features/crm/types`.
- [ ] `npm test` passes. `npm run lint` passes.
- [ ] No speculative fields added; contracts mirror current UI read shapes exactly.

### TDD/validation evidence

**Structural-only exception:** Type moves and re-exports do not change runtime behavior. Validation: `npm run lint && npm test` both pass. TypeScript compilation confirms type compatibility. Verify with `grep -r "@/features/crm/types" src/features/quotes/types.ts` returns no match.

### Lint exception impact

Partial reduction. `quotes → crm` type-only imports are eliminated from `quotes/types.ts`. Exception still needed for `ClientDialog` (ClientForm component) and `useClients` hook until WU4b.

### Rollback note

Delete new shared type files. Restore direct feature imports in `quotes/types.ts`, `inventory/api/priceHistory.ts`, and `FurnitureCostSparkline.tsx`.

### May need splitting?

No. Well under budget.

---

## WU4a: Feature Public API Barrels

**Goal:** Create `index.ts` public API barrels for the five involved features so `src/app/**` can compose features without drilling into internal paths.

**PR boundary:** Single PR, ~80–150 changed lines.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/features/crm/index.ts` | Export `ClientForm`, `KanbanCard`, `ClientList`, `ClientDetail`, `useClients`, `useCreateClient` |
| **Create** `src/features/quotes/index.ts` | Export `QuoteForm`, `QuoteStatusBadge`, `ContractPreview`, `useQuotes`, `useCreateQuote`, `useUpdateQuote`, `useGenerateQuoteNumber` |
| **Create** `src/features/recipes/index.ts` | Export `MuebleList`, `MuebleForm`, `useFurnitureTemplates`, `useStockCheck` |
| **Create** `src/features/inventory/index.ts` | Export `useMaterials`, `useAllPriceHistory`, `PriceSparkline` |
| **Create** `src/features/settings/index.ts` | Export `useWorkshopSettings` |

### Acceptance criteria

- [ ] Each barrel exports only items needed for app-level SDD9 composition. No speculative re-exports.
- [ ] Barrel imports do not create new cross-feature coupling (barrels must not import from other features).
- [ ] `npm run lint` passes. The `import/no-restricted-paths` rule does not fire for barrel self-imports.
- [ ] `npm test` passes.
- [ ] Features do not import other feature barrels (barrels are for `src/app/**` only).

### TDD/validation evidence

**Structural-only exception:** Barrels are pure re-exports with no behavior change. Validation: `npm run lint && npm test` pass. Manual verification: `grep -r "from '@/features/crm'" src/features/` shows no feature-to-feature barrel imports.

### Lint exception impact

No exception removal yet. Barrels are a prerequisite for the app seams in WU4b–WU7.

### Rollback note

Delete the 5 `index.ts` files. No existing code depends on them yet.

### May need splitting?

No. Well under budget.

---

## WU4b: Quote Creation App Seam (First Protected Workflow)

**Goal:** Wire the quote creation page at the app level so `QuoteForm` receives clients, templates, and a client-creation callback through props instead of importing from CRM and recipes features. Remove `quotes → crm` and `quotes → recipes` hook/UI exceptions.

**PR boundary:** Single PR, ~280–400 changed lines. Monitor closely.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/app/pages/QuoteCreatePage.tsx` | App-owned page that calls `useClients` (from CRM barrel), `useFurnitureTemplates` (from recipes barrel), and passes clients/templates/client-creation-callback to `QuoteForm` |
| **Create** `src/app/pages/QuoteEditPage.tsx` | Same pattern for quote editing (if separate route exists; else extend QuoteCreatePage) |
| `src/app/router.tsx` | Update `/quotes/new` and `/quotes/:id/edit` routes to use app pages instead of feature route module (or add new routes alongside existing ones) |
| `src/features/quotes/components/QuoteForm.tsx` | Accept `clients`, `onCreateClient`, `furnitureTemplates` as props instead of calling `useClients`/`useFurnitureTemplates` internally. Keep `calculateQuote`/`computeRecipeCost` calls using shared imports. |
| `src/features/quotes/components/ClientSection.tsx` | Accept `clients`, `selectedClientId`, `onSelectClient`, `onCreateClient` as props. Import `Client` type from `@/shared/types/client`. |
| `src/features/quotes/components/ClientDialog.tsx` | Accept `onClientCreated` callback prop. Receive `ClientForm` render slot from parent or import from `@/features/crm` barrel. Remove direct `@/features/crm/components/ClientForm` import. |
| `src/features/quotes/components/FurnitureSection.tsx` | Accept `templates` as prop. Import `FurnitureTemplateWithItems` from `@/shared/types/recipes`. |
| `src/features/quotes/hooks/useClients.ts` | Delete file (pure re-export barrel; callers migrated to app seam) |
| `src/features/quotes/types.ts` | Remove `Client`/`CLIENT_SOURCE_LABELS` re-exports from CRM (done in WU3; verify clean) |
| `eslint.config.js` | Remove `crm` and `recipes` from the quotes exception: `featureZone("quotes", ["settings"])` |

### Acceptance criteria

- [ ] `QuoteForm` receives clients, templates, and client-creation callback as props.
- [ ] `ClientSection` and `ClientDialog` no longer import from `@/features/crm/**`.
- [ ] `FurnitureSection` no longer imports from `@/features/recipes/**`.
- [ ] `QuoteForm` still computes real-time quote totals using shared `calculateQuote` and `computeRecipeCost`.
- [ ] `quotes → crm` and `quotes → recipes` lint exceptions are removed from `eslint.config.js`.
- [ ] `npm run lint` passes with the reduced exception set: `featureZone("quotes", ["settings"])`.
- [ ] `npm test` passes.
- [ ] Manual smoke: `/quotes/new` page loads, client selection works, template selection works, real-time cost preview updates, quote creation succeeds.

### TDD/validation evidence

**RED:** Write component tests:
- `QuoteForm` renders with props-provided clients and templates (no internal hook calls).
- Selecting a client updates the form value.
- Selecting a furniture template triggers cost computation using shared `computeRecipeCost`.
- Creating a new client via callback propagates back to the form.
These tests fail because `QuoteForm` still calls hooks internally.

**GREEN:** Refactor `QuoteForm` and child components to accept props. Wire `QuoteCreatePage` at the app level. Tests pass.

**TRIANGULATE:** Test edge cases: empty client list, empty template list, client creation failure callback, template with formula-based quantities.

**REFACTOR:** Clean up unused hook imports, verify no dead code remains.

### Lint exception impact

**Removes:** `crm` and `recipes` from the quotes exception. After this WU, `featureZone("quotes", ["settings"])` — only `quotes → settings` remains (addressed in WU5).

### Rollback note

Delete `QuoteCreatePage.tsx` and `QuoteEditPage.tsx`. Restore hook calls inside `QuoteForm`, `ClientSection`, `ClientDialog`, `FurnitureSection`. Restore `quotes/hooks/useClients.ts`. Re-add `crm` and `recipes` to the quotes exception in `eslint.config.js`.

### May need splitting?

This WU is at the budget ceiling. If during implementation the changed-line count approaches 400, split into:
- **WU4b-i:** `QuoteForm` props refactor + `ClientSection`/`ClientDialog` decoupling (~180 lines)
- **WU4b-ii:** App page wiring + router update + exception removal (~150 lines)

---

## WU5: Contract Preview Settings Seam

**Goal:** Wire `ContractPreview` to receive workshop settings through props from an app-owned contract page. Remove `quotes → settings` exception.

**PR boundary:** Single PR, ~100–180 changed lines.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/app/pages/QuoteContractPage.tsx` | App-owned page that calls `useWorkshopSettings` (from settings barrel) and passes settings snapshot to `ContractPreview` |
| `src/app/router.tsx` | Update contract route to use app page (or add new route) |
| `src/features/quotes/components/ContractPreview.tsx` | Accept `workshopSettings` prop (name, address, phone, email, footer_text fields). Remove `useWorkshopSettings` import. |
| `eslint.config.js` | Remove `settings` from the quotes exception: `featureZone("quotes")` (no exceptions) |

### Acceptance criteria

- [ ] `ContractPreview` receives a `workshopSettings` snapshot prop.
- [ ] `ContractPreview` no longer imports from `@/features/settings/**`.
- [ ] Contract preview renders workshop name, address, phone, email, and footer identically.
- [ ] `quotes` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/quotes/:id/contract` page renders contract correctly.

### TDD/validation evidence

**RED:** Write component test: `ContractPreview` renders workshop name/address/phone/email from props. Test fails because it currently calls `useWorkshopSettings` internally.

**GREEN:** Refactor `ContractPreview` to accept props. Wire `QuoteContractPage`. Test passes.

**TRIANGULATE:** Test with null/empty settings fields, settings change between renders.

**REFACTOR:** Clean up unused hook import.

### Lint exception impact

**Removes:** The entire `quotes` feature exception. After this WU, `featureZone("quotes")` has no exceptions.

### Rollback note

Delete `QuoteContractPage.tsx`. Restore `useWorkshopSettings` call inside `ContractPreview`. Re-add `settings` to quotes exception.

### May need splitting?

No. Well under budget.

---

## WU6: CRM Quote Display Seam

**Goal:** Wire CRM pages to receive quote summary data through props from app-owned wrappers. Remove `crm → quotes` exception.

**PR boundary:** Single PR, ~200–350 changed lines.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/app/pages/CrmClientsPage.tsx` | App-owned page that calls `useQuotes` (from quotes barrel) and passes quote summaries to CRM `ClientList` |
| **Create** `src/app/pages/CrmClientDetailPage.tsx` | App-owned page that calls `useQuotes` and passes quotes + status badge slot to `ClientDetail` |
| `src/app/router.tsx` | Update `/crm/clientes` and `/crm/clientes/:id` routes to use app pages |
| `src/features/crm/components/ClientList.tsx` | Accept `quoteSummaries` prop (pre-computed per-client totals). Remove `useQuotes` and `calculateQuote` imports. |
| `src/features/crm/components/ClientDetail.tsx` | Accept `quotes` and `quoteStatusBadge` slot/callback as props. Remove `useQuotes`, `calculateQuote`, `QuoteStatusBadge` imports. |
| `src/features/crm/components/KanbanCard.tsx` | Accept `quoteSummary` and `statusColor` as props (or import status color from shared). Remove `calculateQuote`, `QuoteWithExtras`, and remaining quotes imports. |
| `eslint.config.js` | Remove quotes from CRM exception: `featureZone("crm")` (no exceptions) |

### Acceptance criteria

- [ ] `ClientList` receives quote summaries through props; no `@/features/quotes/**` imports.
- [ ] `ClientDetail` receives quotes and status badge rendering through props/slots; no `@/features/quotes/**` imports.
- [ ] `KanbanCard` receives quote summary and status color through props or shared imports; no `@/features/quotes/**` imports.
- [ ] CRM quote history, totals, statuses, and badges render identically.
- [ ] `crm` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/crm/clientes` shows quote counts/totals; `/crm/clientes/:id` shows quote history with status badges.

### TDD/validation evidence

**RED:** Write component tests:
- `ClientList` renders quote totals from props (not internal hooks).
- `ClientDetail` renders quote list and status badges from props.
- `KanbanCard` displays correct quote total and status color from props.
Tests fail because components call hooks internally.

**GREEN:** Refactor components to accept props. Wire app pages. Tests pass.

**TRIANGULATE:** Test: client with zero quotes, client with multiple statuses, null client in QuoteWithExtras.

**REFACTOR:** Remove unused imports, verify shared calculator import path.

### Lint exception impact

**Removes:** The entire `crm` feature exception. After this WU, `featureZone("crm")` has no exceptions.

### Rollback note

Delete `CrmClientsPage.tsx` and `CrmClientDetailPage.tsx`. Restore hook calls and direct imports inside CRM components. Re-add `quotes` to CRM exception.

### May need splitting?

Possibly. If the combined component refactors + app pages exceed 350 lines, split into:
- **WU6a:** `ClientList` + `KanbanCard` props refactor + `CrmClientsPage` (~180 lines)
- **WU6b:** `ClientDetail` props refactor + `CrmClientDetailPage` + exception removal (~170 lines)

---

## WU7: Recipes Inventory and Settings Seam

**Goal:** Wire recipe pages to receive materials, price history, and `stock_alert_enabled` through props from app-owned wrappers. Decide sparkline placement. Remove `recipes → inventory` and `recipes → settings` exceptions.

**PR boundary:** Single PR, ~250–400 changed lines. Monitor closely.

### Target files/areas

| File/area | Change |
|-----------|--------|
| **Create** `src/app/pages/RecipesPage.tsx` | App-owned page that calls `useMaterials`, `useAllPriceHistory` (from inventory barrel), `useWorkshopSettings` (from settings barrel), and passes data to recipe components |
| `src/app/router.tsx` | Update `/recipes/*` route to use app page |
| `src/features/recipes/components/MuebleList.tsx` | Accept `materials`, `priceHistory`, `stockAlertEnabled` as props. Remove `useMaterials`, `useAllPriceHistory`, `useWorkshopSettings` imports. |
| `src/features/recipes/hooks/useStockCheck.ts` | Accept `materials` and `stockAlertEnabled` as arguments instead of calling `useMaterials` and `useWorkshopSettings` internally. Keep `computeStockShortages` as recipe-owned pure helper. |
| `src/features/recipes/components/FurnitureCostSparkline.tsx` | Accept `priceHistory` as prop. Move `PriceSparkline` to `src/shared/ui/PriceSparkline.tsx` if purely presentational, or compose at app level. Remove inventory imports. |
| `src/features/recipes/components/ExtraItemsSection.tsx` | Verify `Material` import is from `@/shared/types/material` (done in WU1). Accept `materials` as prop if it fetches internally. |
| `src/features/recipes/lib/computeCostHistory.ts` | Import `PriceHistoryRow` from `@/shared/types/priceHistory` (done in WU3). No further changes needed. |
| `eslint.config.js` | Remove both inventory and settings from recipes exception: `featureZone("recipes")` (no exceptions) |

### Acceptance criteria

- [ ] `MuebleList` receives materials, price history, and stock_alert_enabled through props; no inventory/settings imports.
- [ ] `useStockCheck` accepts materials and stockAlertEnabled as arguments; no internal hook calls to inventory/settings.
- [ ] `FurnitureCostSparkline` receives price history through props or uses shared PriceSparkline; no inventory imports.
- [ ] Stock alert behavior preserves `stock_alert_enabled` toggle: when false, no stock shortages displayed; when true, shortages computed correctly.
- [ ] Cost history sparkline renders identical data points.
- [ ] `recipes` exception is fully removed from `eslint.config.js`.
- [ ] `npm run lint` passes. `npm test` passes.
- [ ] Manual smoke: `/recipes` page loads, stock alerts toggle works, cost history sparkline renders, material availability displays.

### TDD/validation evidence

**RED:** Write tests:
- `useStockCheck` computes shortages correctly when given materials and stockAlertEnabled as arguments (test with `stockAlertEnabled=true`, `stockAlertEnabled=false`, sufficient stock, insufficient stock).
- `MuebleList` renders stock alerts from props.
Tests fail because hooks/components call inventory/settings hooks internally.

**GREEN:** Refactor `useStockCheck` to accept explicit arguments. Refactor `MuebleList` and `FurnitureCostSparkline` to accept props. Wire `RecipesPage`. Tests pass.

**TRIANGULATE:** Test: empty materials list, zero stock, price history with zero entries, stock_alert_enabled undefined.

**REFACTOR:** Remove unused hook imports. Decide sparkline placement (shared UI vs app slot).

### Lint exception impact

**Removes:** The entire `recipes` feature exception. After this WU, `featureZone("recipes")` has no exceptions.

### Rollback note

Delete `RecipesPage.tsx`. Restore hook calls inside `useStockCheck`, `MuebleList`, `FurnitureCostSparkline`. Re-add `inventory` and `settings` to recipes exception.

### May need splitting?

This WU is at the budget ceiling. If changed lines approach 400, split into:
- **WU7a:** `useStockCheck` refactor + `MuebleList` props refactor + app page wiring (~200 lines)
- **WU7b:** `FurnitureCostSparkline` + sparkline placement decision + exception removal (~150 lines)

---

## WU8: Final Lint Cleanup and Architecture Verification

**Goal:** Confirm all six SDD8 temporary exceptions are removed. Run full lint and test suite. Record verification evidence.

**PR boundary:** Single PR, ~20–60 changed lines.

### Target files/areas

| File/area | Change |
|-----------|--------|
| `eslint.config.js` | Verify all SDD8 temporary exception comments and exception arrays are removed. Confirm `featureZone` calls for crm, quotes, recipes have no exceptions. |
| **Verify** all feature directories | `grep -r "@/features/" src/features/crm/ src/features/quotes/ src/features/recipes/` returns no cross-feature imports |
| **Verify** `src/shared/**` | No imports from `src/features/**` |

### Acceptance criteria

- [ ] `eslint.config.js` has zero SDD8 temporary exception comments.
- [ ] `featureZone("crm")`, `featureZone("quotes")`, `featureZone("recipes")` have no exception arrays.
- [ ] `npm run lint` passes with no `import/no-restricted-paths` violations in the five involved features.
- [ ] `npm test` passes (full suite).
- [ ] `grep -r "@/features/" src/features/crm/ src/features/quotes/ src/features/recipes/ src/features/inventory/ src/features/settings/ | grep -v node_modules` returns no cross-feature imports (only self-feature and shared imports).
- [ ] Verification evidence recorded in this task file or a verification.md artifact.

### TDD/validation evidence

**Structural verification only:** This WU is a confirmation gate. Validation: full `npm run lint && npm test` pass. Manual grep for cross-feature imports returns zero matches.

### Lint exception impact

**Removes:** Any remaining exception entries (should be none if WU4b–WU7 completed correctly). If exceptions remain, they indicate a missed seam — return to the relevant WU.

### Rollback note

If a remaining exception is discovered, restore the exception and reopen the relevant WU. Do not force-remove exceptions without replacement seams.

### May need splitting?

No. Minimal scope.

---

## Implementation Sequence Summary

| Order | WU | Scope | Est. lines | Exception removal | PR dependency |
|-------|----|-------|-----------:|-------------------|---------------|
| 1 | WU1 | Material + status path fixes | 30–60 | None (partial reduction) | None |
| 2 | WU2 | Shared calculators + tests | 250–380 | None (re-exports) | None |
| 3 | WU3 | Shared read contracts | 100–180 | None (re-exports) | None |
| 4 | WU4a | Feature API barrels | 80–150 | None | None |
| 5 | WU4b | Quote creation app seam | 280–400 | `quotes → crm`, `quotes → recipes` | WU2, WU3, WU4a |
| 6 | WU5 | Contract preview seam | 100–180 | `quotes → settings` | WU2 |
| 7 | WU6 | CRM display seam | 200–350 | `crm → quotes` | WU2, WU4a |
| 8 | WU7 | Recipes inventory/settings seam | 250–400 | `recipes → inventory`, `recipes → settings` | WU1, WU3, WU4a |
| 9 | WU8 | Final lint verification | 20–60 | Confirmation gate | WU4b, WU5, WU6, WU7 |

WU1, WU2, WU3, and WU4a can land in any order (or in parallel) since they create foundations without removing exceptions. WU4b–WU7 each remove specific exceptions and should land after their dependencies. WU8 is the final gate.

## Costing Auditability Checklist

Per design constraint, all costing values must remain exact. This checklist applies to WU2 and any WU that touches costing paths:

- [ ] `calculateQuote` produces identical `CalcResult` for every fixture tested in `calculator.test.ts`.
- [ ] `computeRecipeCost` produces identical `RecipeCost` for every fixture tested in `computeRecipeCost.test.ts`.
- [ ] `computeWoodUsage` produces identical `WoodUsage.subtotal` for each mode (placa-pieces, placa-area, lineal-pieces, lineal-meters, flat).
- [ ] `resolveItemQuantity` evaluates formulas identically via `safeEvalFormula`.
- [ ] `applyWaste` applies `qty * (1 + wastePct / 100)` with no rounding.
- [ ] No numeric type changes (all remain `number`).
- [ ] No formula rewrites; only import path changes.

## Architecture Shortcut Rejection Checklist

Per design and spec constraints:

- [ ] No event bus introduced.
- [ ] No shared global state (Zustand store spanning features) introduced.
- [ ] No feature-to-feature barrel imports (barrels are for `src/app/**` only).
- [ ] No hooks or DB queries moved into `src/shared/**`.
- [ ] No TanStack Query wrappers moved into `src/shared/**`.
- [ ] Workflow modules created only if explicitly justified by WU4b or WU7 implementation evidence.

## SDD7 PR3 Exclusion

SDD7 PR3 is explicitly out of scope. No work unit touches SDD7 E2E test files, routes, or configurations.
