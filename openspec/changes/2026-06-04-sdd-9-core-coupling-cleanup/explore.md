# SDD9 Explore — Core Coupling Cleanup

## Context

SDD8 archived the general architecture cleanup and intentionally deferred the remaining core workflow coupling to a separate SDD. The target boundary remains:

- `src/app/**` composes multiple features and wires feature public APIs together.
- `src/features/<feature>/**` imports only its own feature files and `src/shared/**`.
- `src/shared/**` must not import from `src/features/**`.

The current lint guard in `eslint.config.js` still allows six narrow temporary exceptions:

- `crm → quotes`
- `quotes → crm`
- `quotes → recipes`
- `quotes → settings`
- `recipes → inventory`
- `recipes → settings`

This explore phase does not implement production/source/test changes.

## Evidence

Primary artifacts reviewed:

- `openspec/specs/architecture-cleanup/spec.md`
- `openspec/changes/archive/2026-06-03-sdd-8-architecture-cleanup/decisions/core-coupling.md`
- `eslint.config.js`
- `AGENTS.md`
- live source imports under `src/features/crm`, `src/features/quotes`, `src/features/recipes`, `src/features/inventory`, and `src/features/settings`

## Current coupling map

### `crm → quotes`

CRM components import quote calculations, quote status display, quote types, and quote query hooks:

- `src/features/crm/components/KanbanCard.tsx`
  - `calculateQuote` from `@/features/quotes/lib/calculator`
  - `QUOTE_STATUS_COLORS` and `QuoteWithExtras` from `@/features/quotes/types`
- `src/features/crm/components/ClientList.tsx`
  - `useQuotes` from `@/features/quotes/hooks/useQuotes`
  - `calculateQuote` from `@/features/quotes/lib/calculator`
- `src/features/crm/components/ClientDetail.tsx`
  - `useQuotes` from `@/features/quotes/hooks/useQuotes`
  - `calculateQuote` from `@/features/quotes/lib/calculator`
  - `QuoteStatusBadge` from `@/features/quotes/components/QuoteStatusBadge`

Classification: mixed.

- Shared contract candidates: `calculateQuote`, `QuoteWithExtras`, quote status constants.
- App-level orchestration candidates: `useQuotes` data fetching and quote status UI injection/composition.

### `quotes → crm`

Quotes imports CRM client types, labels, hooks, and UI:

- `src/features/quotes/types.ts`
  - `Client` and related type/constant re-exports from `@/features/crm/types`
- `src/features/quotes/hooks/useClients.ts`
  - pure re-export of CRM client hooks
- `src/features/quotes/components/ClientSection.tsx`
  - `Client` type from CRM
- `src/features/quotes/components/ClientDialog.tsx`
  - `ClientForm` and `Client` type from CRM

Classification: mixed.

- Shared contract candidates: stable client read/write types and client source labels.
- App-level orchestration candidates: client query/mutation hooks and `ClientForm` slot/callback wiring.

### `quotes → recipes`

Quotes form components import recipe template hooks, recipe cost helpers, and template types:

- `src/features/quotes/components/QuoteForm.tsx`
  - `useFurnitureTemplates` from recipes hooks
  - `computeRecipeCost` and `resolveItemQuantity` from recipes types
- `src/features/quotes/components/FurnitureSection.tsx`
  - `FurnitureTemplateWithItems` type from recipes types

Classification: mixed.

- Shared contract candidates: pure costing helpers and stable recipe/template read models.
- App-level orchestration candidates: recipe template fetching for quote form workflows.
- Possible workflow-module candidate: quote-building if later design finds the operation cannot stay coherent with only props plus shared pure helpers.

### `quotes → settings`

Contract preview imports settings hook directly:

- `src/features/quotes/components/ContractPreview.tsx`
  - `useWorkshopSettings` from settings hooks

Classification: app-level orchestration.

Contract rendering needs workshop display fields as inputs. The quote component should receive those fields through props from the route/page seam or a dedicated contract workflow if design finds broader cross-domain behavior.

### `recipes → inventory`

Recipes imports inventory material/price types, hooks, and sparkline UI:

- `src/features/recipes/lib/stockCheck.ts`
  - `Material` type from inventory
- `src/features/recipes/lib/computeWoodUsage.ts`
  - `Material` type from inventory
- `src/features/recipes/lib/computeRecipeCost.test.ts`
  - `Material` type from inventory
- `src/features/recipes/lib/computeCostHistory.ts`
  - `PriceHistoryRow` type from inventory API
- `src/features/recipes/hooks/useStockCheck.ts`
  - `useMaterials` from inventory hooks
- `src/features/recipes/components/MuebleList.tsx`
  - `useMaterials` and `useAllPriceHistory` from inventory hooks
- `src/features/recipes/components/FurnitureCostSparkline.tsx`
  - `PriceSparkline` and `PriceHistoryRow` from inventory
- `src/features/recipes/components/ExtraItemsSection.tsx`
  - `Material` type from inventory

Classification: mixed.

- Shared contract candidates: `Material` type, price history row type, pure stock/cost input models.
- App-level orchestration candidates: material and price-history fetching.
- Shared UI or app-level composition candidate: price sparkline rendering.
- Possible workflow-module candidate: recipe costing/stock checks if later design finds cross-domain behavior is more than input passing.

### `recipes → settings`

Recipes imports settings hook directly for the stock-alert flag:

- `src/features/recipes/hooks/useStockCheck.ts`
  - `useWorkshopSettings`
- `src/features/recipes/components/MuebleList.tsx`
  - `useWorkshopSettings`

Classification: app-level orchestration.

The recipe feature should receive `stock_alert_enabled` or an equivalent settings snapshot as an input instead of fetching settings internally.

## Key discoveries

1. No inspected core feature exposes an `index.ts` public API barrel for app-level composition. This makes route-level orchestration harder without importing internal feature paths.
2. Several imports are type-only or pure-helper coupling and are lower-risk candidates for shared contracts.
3. Some coupling is workflow/data-fetching coupling and should not be hidden by moving hooks into `src/shared`.
4. `Material` already has a shared canonical type at `@/shared/types/material`, so part of `recipes → inventory` can be resolved mechanically later.
5. `QUOTE_STATUS_COLORS` is already available through shared quote types, so one CRM import is unnecessary feature coupling.

## Decision space

### App-level orchestration/composition seams

Best fit for feature hooks, page data dependencies, callbacks, and UI slots:

- CRM pages fetching quote summaries and passing them into CRM components.
- Quote pages fetching clients and recipe templates and passing them into quote components.
- Contract preview receiving workshop settings data.
- Recipe pages fetching materials, price history, and settings flags and passing them into recipe components.

This direction likely requires public API barrels for involved features so `src/app/**` can compose features without drilling into internals.

### Shared domain contracts in `src/shared`

Best fit for stable read models, type aliases, constants, and pure helpers with no feature dependencies:

- Client read/write contracts and client source labels.
- Quote summary/quote-with-extras and quote status display constants.
- Quote calculator helpers.
- Recipe template snapshots and recipe costing helpers if dependency chains remain pure.
- Material and price history snapshots.
- Workshop settings snapshots needed by contract/stock workflows.

Guardrail: shared contracts must remain neutral and must not become a dumping ground for feature-owned workflows.

### Workflow modules / coordination layer

Potential fit only when a behavior is truly cross-domain and cannot be represented cleanly as route composition plus shared contracts:

- Quote-building flows combining client, recipe templates, costing, and settings.
- Recipe costing or stock checks combining inventory, price history, and settings.
- Contract preview/generation if it grows beyond display inputs into a cross-domain document workflow.

Guardrail: avoid event bus, global state, or vague service-layer shortcuts.

## Risks and behavior to preserve

- Quote creation and real-time cost preview must keep current behavior when selecting templates and changing template parameters.
- Contract preview must continue rendering current workshop name/address/contact/footer data.
- Recipe stock alerts must preserve `stock_alert_enabled` behavior and shortage calculations.
- CRM quote history/totals/status display must preserve current visible totals and statuses.
- Lint exceptions must be removed only when replacement seams are implemented and verified.

## Recommended planning direction

Use a hybrid architecture, decided per workflow rather than globally:

1. Move stable, pure contracts/helpers into `src/shared/**` first when this reduces coupling without behavior changes.
2. Add feature public API barrels for app-owned composition before moving hook orchestration to `src/app/**`.
3. Use dedicated workflow modules only for operations that remain truly cross-domain after shared contracts and app-level composition are considered.
4. Slice implementation so each lint exception is removed only with the replacement seam and validation evidence.

## Suggested first work-unit forecast

Subject to spec/design, the likely reviewable sequence is:

1. Mechanical shared contract cleanup for existing shared `Material` type and already-shared quote status constants.
2. Shared quote/client/recipe/price/settings contract extraction for type-only and pure-helper imports.
3. Public feature API seams for app-level composition.
4. CRM ↔ quotes route/component orchestration.
5. Quotes ↔ recipes/settings orchestration for quote form and contract preview.
6. Recipes ↔ inventory/settings orchestration for materials, price history, stock alerts, and sparkline display.
7. Final `eslint.config.js` exception removal and verification.

## Open questions for proposal/spec

1. Which workflow must be protected first: quote creation, CRM quote history, recipe costing, stock checks, or contract preview generation?
2. Should shared domain contracts be limited to current UI read models, or should they become canonical language for future reporting/analytics?
3. Which costing inputs must remain exact and auditable after refactor: material prices at quote time, current inventory prices, workshop settings, margins, or all of them?
4. Are small dedicated workflow modules acceptable if app-level orchestration plus shared contracts becomes awkward?
5. Must the first implementation slice preserve all production behavior, including UI layout, query behavior, and persisted data shapes?
