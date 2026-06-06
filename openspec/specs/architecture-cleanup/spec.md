# SDD8 Specification — Architecture Cleanup

## Purpose

Keep CarpinteroPro's feature-sliced architecture enforceable and reviewable: feature code imports only its own feature and shared code, while `src/app/**` owns cross-feature composition.

## Requirements

### Requirement: Shared utilities and contracts have neutral ownership

Cross-feature utilities and read contracts MUST live in `src/shared/**` instead of a feature that is not their true owner.

#### Scenario: Currency formatting is shared

- GIVEN multiple features render monetary values
- WHEN code imports `formatCurrency`
- THEN the import source is `@/shared/lib/formatters`.

#### Scenario: Workshop settings read type is shared

- GIVEN quotes, recipes, and settings need the workshop settings read shape
- WHEN code imports the canonical `WorkshopSettings` read type
- THEN the import source is a shared settings type/API module, not `src/features/quotes/**` or another unrelated feature.

### Requirement: Feature import boundaries are enforced

Feature modules MUST NOT import from other feature modules unless a narrow, documented temporary exception exists for a deferred architecture change.

#### Scenario: Cleaned feature tries to import another feature

- GIVEN a cleaned feature such as dashboard, settings, or onboarding
- WHEN a developer adds a direct import from another feature
- THEN `npm run lint` fails through the feature boundary guardrail.

#### Scenario: App composes features

- GIVEN a route or page workflow needs multiple features
- WHEN cross-feature hooks/components must be wired together
- THEN the composition belongs in `src/app/**` and feature components receive data, callbacks, actions, or slots through props.

### Requirement: Dashboard composition is app-owned

Dashboard feature code MUST receive quote/material data through dashboard-local or shared contracts and MUST NOT import quotes or inventory feature modules directly.

#### Scenario: Dashboard renders cross-domain data

- GIVEN the dashboard displays quote and inventory information
- WHEN the dashboard route is rendered
- THEN `src/app/pages/DashboardPage.tsx` gathers cross-feature data and passes plain props to dashboard components.

### Requirement: Settings and onboarding composition is app-owned

Settings and onboarding feature code MUST receive cross-domain UI/actions through props or callbacks instead of importing unrelated features directly.

#### Scenario: Settings renders billing and reset actions

- GIVEN settings displays billing state and onboarding reset
- WHEN the settings route is rendered
- THEN `src/app/pages/SettingsPage.tsx` wires billing/onboarding dependencies and passes a billing slot plus reset action to `WorkshopSettings`.

#### Scenario: Onboarding creates settings and materials

- GIVEN onboarding saves workshop settings and optional seed materials
- WHEN the onboarding route is rendered
- THEN `src/app/pages/OnboardingPage.tsx` wires settings/inventory mutations and passes callbacks to `OnboardingWizard`.

### Requirement: Core coupling is resolved through staged replacement

Remaining quotes/CRM/recipes/inventory/settings coupling MUST be resolved through explicit replacement seams. Each lint exception MUST be removed only when the corresponding replacement seam is implemented and validated.
(Previously: coupling was deferred behind narrow lint exceptions until a separate SDD decided the architecture.)

#### Scenario: Staged exception removal

- GIVEN an import boundary exception remains in `eslint.config.js`
- WHEN the replacement seam is implemented and tests pass
- THEN the exception is removed in the same work unit as the seam, and `npm run lint` passes without the exception.

#### Scenario: Architecture direction is chosen per workflow

- GIVEN a core coupling direction is being resolved
- WHEN implementation is considered
- THEN the team chooses between app-level orchestration, shared domain contracts, or dedicated workflow modules per workflow, and rejects event-bus/global-state shortcuts unless separately justified.

### Requirement: CRM quote display dependencies are removed

The CRM feature MUST NOT import from the quotes feature. CRM components that display quote data MUST receive it through app-level orchestration or shared quote summary contracts.

#### Scenario: CRM Kanban card displays quote data

- GIVEN `KanbanCard` needs quote totals and status colors
- WHEN the `crm → quotes` exception is removed
- THEN `KanbanCard` receives quote summary data and status constants through props or imports them from `src/shared/**`, not from `src/features/quotes/**`.

#### Scenario: CRM client list shows quote totals

- GIVEN `ClientList` needs quote totals per client
- WHEN the `crm → quotes` exception is removed
- THEN `ClientList` receives quote summary data through props from app-level orchestration, and pure calculation helpers are either shared or totals are pre-computed.

#### Scenario: CRM client detail shows quote history

- GIVEN `ClientDetail` needs quote lists and status badges
- WHEN the `crm → quotes` exception is removed
- THEN `ClientDetail` receives quote data and callbacks through props, and `QuoteStatusBadge` is composed at the app level or replaced with a CRM-owned wrapper.

### Requirement: Quotes CRM client dependencies are removed

The quotes feature MUST NOT import from the CRM feature. Quote components that need client data MUST receive it through app-level orchestration or shared client contracts.

#### Scenario: Quote form selects a client

- GIVEN `QuoteForm` and `ClientSection` need client types
- WHEN the `quotes → crm` exception is removed
- THEN client types are imported from `src/shared/**` and client selection UI is composed at the app level or through callbacks.

#### Scenario: Quote form creates a new client

- GIVEN `ClientDialog` needs `ClientForm`
- WHEN the `quotes → crm` exception is removed
- THEN `ClientDialog` receives a client creation slot/callback through props from app-level orchestration, or the client creation flow is moved to the app/page level.

### Requirement: Quotes recipe dependencies are removed

The quotes feature MUST NOT import from the recipes feature. Quote components that need recipe templates and costing MUST receive them through shared contracts or app-level orchestration.

#### Scenario: Quote form uses furniture templates

- GIVEN `QuoteForm` and `FurnitureSection` need recipe templates
- WHEN the `quotes → recipes` exception is removed
- THEN `QuoteForm` receives template data and selection callbacks through props, and shared recipe snapshot types live in `src/shared/**`.

#### Scenario: Quote form computes recipe costs

- GIVEN `QuoteForm` needs `computeRecipeCost` and `resolveItemQuantity`
- WHEN the `quotes → recipes` exception is removed
- THEN pure costing helpers are either moved to `src/shared/**` or the cost is pre-computed and passed as props.

### Requirement: Quotes settings dependencies are removed

The quotes feature MUST NOT import from the settings feature. Quote components that need workshop settings MUST receive them through shared contracts or app-level orchestration.

#### Scenario: Contract preview reads workshop settings

- GIVEN `ContractPreview` needs workshop name/address/contact/footer
- WHEN the `quotes → settings` exception is removed
- THEN `ContractPreview` receives a workshop settings snapshot through props, and the hook `useWorkshopSettings` is called at the app/page level.

### Requirement: Recipes inventory dependencies are removed

The recipes feature MUST NOT import from the inventory feature. Recipe components that need materials and price history MUST receive them through shared contracts or app-level orchestration.

#### Scenario: Recipe costing uses material types

- GIVEN `stockCheck.ts`, `computeWoodUsage.ts`, and `ExtraItemsSection` need `Material` type
- WHEN the `recipes → inventory` exception is removed
- THEN `Material` is imported from `src/shared/types/material` instead of `src/features/inventory/types`.

#### Scenario: Recipe components fetch materials and price history

- GIVEN `useStockCheck`, `MuebleList`, and `FurnitureCostSparkline` fetch inventory data
- WHEN the `recipes → inventory` exception is removed
- THEN data fetching happens at the app/page level and results are passed as props, or shared neutral hooks in `src/shared/**` are used.

#### Scenario: Recipe sparkline renders price history

- GIVEN `FurnitureCostSparkline` needs `PriceSparkline` and `PriceHistoryRow`
- WHEN the `recipes → inventory` exception is removed
- THEN `PriceSparkline` is composed at the app level or replaced with a shared UI component, and `PriceHistoryRow` is imported from `src/shared/**`.

### Requirement: Recipes settings dependencies are removed

The recipes feature MUST NOT import from the settings feature. Recipe components that need workshop settings flags MUST receive them through shared contracts or app-level orchestration.

#### Scenario: Stock checks read settings flag

- GIVEN `useStockCheck` and `MuebleList` need `stock_alert_enabled`
- WHEN the `recipes → settings` exception is removed
- THEN the settings flag is passed as a prop or injected at the app/page level, and `useWorkshopSettings` is not called inside `src/features/recipes/**`.

### Requirement: Shared contracts are scoped to current UI read models

Shared domain contracts extracted for SDD9 MUST be limited to stable current UI read models and pure helpers. They MUST NOT be expanded into a future reporting or analytics language.

#### Scenario: Client type is shared

- GIVEN client data is needed by both CRM and quotes
- WHEN a shared client contract is created
- THEN it contains only the fields currently used by the UI read paths, not speculative analytics fields.

#### Scenario: Recipe template snapshot is shared

- GIVEN recipe templates are needed by quotes
- WHEN a shared recipe contract is created
- THEN it represents the current quote-building UI read model, not a future reporting schema.

### Requirement: Workflow modules are tightly bounded

If app-level orchestration plus shared contracts cannot cleanly represent a cross-domain operation, a dedicated workflow module MAY be created. It MUST have explicit inputs and outputs, MUST contain only true cross-domain operations, and MUST NOT become a generic service layer.

#### Scenario: Quote creation workflow module

- GIVEN quote creation combines client, recipe, costing, and settings data
- WHEN a workflow module is evaluated
- THEN it is only created if the operation cannot be represented with props plus shared helpers, and its interface lists every input and output explicitly.

#### Scenario: Recipe costing workflow module

- GIVEN recipe costing combines inventory, price history, and settings
- WHEN a workflow module is evaluated
- THEN it is only created if pure helpers plus props are insufficient, and it does not contain generic data access patterns.

### Requirement: Feature public API barrels enable app composition

Features involved in SDD9 coupling MUST expose a public API through `src/features/<name>/index.ts` so that `src/app/**` can compose them without importing internal paths.

#### Scenario: CRM feature exports public API

- GIVEN app pages compose CRM and quotes
- WHEN `src/app/**` imports CRM code
- THEN it imports only from `@/features/crm`, not from `@/features/crm/components/ClientForm` or `@/features/crm/hooks/useClients`.

#### Scenario: Quotes feature exports public API

- GIVEN app pages compose quotes with other features
- WHEN `src/app/**` imports quotes code
- THEN it imports only from `@/features/quotes`, not from `@/features/quotes/lib/calculator` or `@/features/quotes/hooks/useQuotes`.

#### Scenario: Recipes feature exports public API

- GIVEN app pages compose recipes with other features
- WHEN `src/app/**` imports recipes code
- THEN it imports only from `@/features/recipes`, not from `@/features/recipes/lib/computeRecipeCost` or `@/features/recipes/hooks/useStockCheck`.

### Requirement: Staged removal preserves validation

Each ESLint exception MUST be removed only in the same work unit as its replacement seam. `npm run lint` MUST pass after each exception removal, and no exception MUST be removed before its replacement is implemented.

#### Scenario: Exception removal is atomic with seam

- GIVEN a lint exception has a replacement seam
- WHEN the work unit is implemented
- THEN the exception and the feature import changes are in the same commit slice, and CI lint passes.

#### Scenario: Exception is not removed early

- GIVEN a replacement seam is not ready
- WHEN a developer considers removing the exception
- THEN the exception stays in place and the code continues to build and lint.

### Requirement: Quote creation is protected first

The quote creation workflow MUST be the first protected workflow in SDD9 implementation. Real-time quote costing, client selection, recipe template selection, and contract preview MUST remain functionally identical during and after refactor.

#### Scenario: Quote creation still works after refactor

- GIVEN a user creates a quote with a client and furniture templates
- WHEN SDD9 refactors the quote creation dependencies
- THEN the quote totals, client association, template selection, and contract preview render identically.

### Requirement: Costing values remain exact and auditable

All quote and recipe costing values MUST remain exact after refactor. Material prices, workshop settings, margins, quantities, and computed results MUST NOT change due to import moves or contract reorganization.

#### Scenario: Quote total is unchanged

- GIVEN a quote with specific furniture and materials
- WHEN imports are moved to shared contracts or app orchestration
- THEN the calculated total equals the pre-refactor total for the same inputs.

#### Scenario: Recipe cost is unchanged

- GIVEN a recipe with specific materials and quantities
- WHEN inventory dependencies are refactored
- THEN the computed recipe cost equals the pre-refactor cost for the same inputs.

### Requirement: Architecture shortcuts are rejected

SDD9 MUST NOT introduce an event bus, shared global state, or feature-to-feature public API loopholes as shortcuts to resolve coupling.

#### Scenario: No event bus is added

- GIVEN coupling needs to be resolved
- WHEN architecture options are evaluated
- THEN an event bus is rejected unless a separate product need justifies it.

#### Scenario: No global state is added

- GIVEN state sharing is considered
- WHEN architecture options are evaluated
- THEN shared global state (e.g., a global Zustand store spanning features) is rejected as a coupling shortcut.

#### Scenario: No feature-to-feature barrel loophole

- GIVEN features need to communicate
- WHEN public APIs are designed
- THEN feature `index.ts` exports are for app-level composition only; features MUST NOT import from other feature barrels.
