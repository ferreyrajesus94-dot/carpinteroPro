# SDD9 Design — Core Coupling Cleanup

SDD9 resolves the six remaining core feature-coupling exceptions with a hybrid design: shared contracts for stable UI read models and pure calculations, app-owned orchestration for cross-feature hooks/UI composition, and no workflow module unless implementation proves props plus shared helpers cannot preserve quote creation cleanly.

## Design summary

| Edge | Direction | Primary seam | Exception removal gate |
|---|---|---|---|
| `crm → quotes` | Mixed | Shared quote contracts/calculator + app-owned quote data injection | CRM imports no `src/features/quotes/**`; quote history/totals/status still render identically. |
| `quotes → crm` | Mixed | Shared client contracts + app-owned client query/create composition | Quotes imports no `src/features/crm/**`; quote creation still selects/creates clients. |
| `quotes → recipes` | Mixed | Shared recipe template/costing contracts + app-owned template fetching | Quote creation keeps template selection and real-time costing unchanged. |
| `quotes → settings` | App orchestration | Contract settings snapshot passed from app/page seam | Contract preview renders the same workshop fields. |
| `recipes → inventory` | Mixed | Shared material/price contracts + app-owned material/history fetching; shared UI only if needed | Recipe stock/cost/sparkline flows import no inventory internals. |
| `recipes → settings` | App orchestration | `stock_alert_enabled` passed into recipes from app/page seam | Stock alerts preserve settings toggle behavior. |

## Constraints and inputs

- Preserve all production behavior; this is architecture cleanup, not product redesign.
- First protected workflow: quote creation.
- Shared contracts are scoped to current UI read models only.
- Quote and recipe costing values must remain exact and auditable.
- Small workflow modules are allowed only with explicit input/output limits.
- Review budget: 400 changed lines; delivery strategy: auto-forecast.
- Feature import boundary target remains:
  - `src/app/**` composes multiple features and feature public APIs.
  - `src/features/<feature>/**` imports only its own feature and `src/shared/**`.
  - `src/shared/**` imports no feature code.

## Target architecture

### 1. Shared contracts in `src/shared/**`

Shared contracts are only for stable data shapes and pure helpers already used by current UI paths. They must not perform feature data access, call hooks, own route state, or become reporting/analytics models.

| Target | Contents | Used by | Notes |
|---|---|---|---|
| `src/shared/types/client.ts` | `Client`, client source type/labels and only current client UI fields | CRM, quotes, app pages | Replace `quotes → crm` type and label imports. |
| `src/shared/types/quotes.ts` | Quote status constants, quote summary/read model, `QuoteWithExtras` equivalent, calculator input/result types if not colocated with calculator | CRM, quotes, app pages | `QUOTE_STATUS_COLORS` already belongs here; extend without speculative fields. |
| `src/shared/lib/quotesCalculator.ts` | `calculateQuote` and exact current `CalcInput`/`CalcResult` behavior | CRM, quotes | Move as-is; no rounding or formula changes. |
| `src/shared/types/recipes.ts` | `FurnitureTemplateWithItems`, recipe item/material/labor snapshots needed by quote-building UI | quotes, recipes, app pages | Snapshot should mirror current UI read shape. |
| `src/shared/lib/recipeCosting.ts` | `computeRecipeCost`, `resolveItemQuantity`, and required pure dependencies (`applyWaste`, formula evaluation, wood usage dependency as needed) | quotes, recipes | Preserve exact formulas and dependency chain. |
| `src/shared/types/material.ts` | Canonical `Material` row type already exists | inventory, recipes | Recipes should import this directly. |
| `src/shared/types/priceHistory.ts` | `PriceHistoryRow` read shape used for cost history/sparklines | inventory, recipes, app pages | Extract from inventory API type without moving API calls. |
| `src/shared/types/workshopSettings.ts` | Workshop settings snapshot fields used by contract preview and stock alerts | app pages, quotes, recipes, settings | Include only current fields such as name/address/contact/footer and `stock_alert_enabled`. |

### 2. Feature public API seams

Each involved feature needs `src/features/<feature>/index.ts` so `src/app/**` can compose without drilling into internals. These barrels are for app imports only; features must not import other feature barrels.

| Feature barrel | Public exports for SDD9 composition |
|---|---|
| `@/features/crm` | CRM route/page components that remain feature-local, `ClientForm`, client hooks, CRM display components intended for app composition. |
| `@/features/quotes` | `QuoteList`, `QuoteForm`, `ContractPreview`, `QuoteStatusBadge` only if composed by app, quote hooks, quote route-local helpers needed by app. |
| `@/features/recipes` | `MuebleList`, `MuebleForm`, recipe template hooks, recipe display components needed by app. |
| `@/features/inventory` | `useMaterials`, `useAllPriceHistory`, and optionally `PriceSparkline` if composed at app level rather than moved to shared UI. |
| `@/features/settings` | `useWorkshopSettings` and settings components used by app pages. |

Barrel rule: exported items may be consumed by `src/app/**`; feature-to-feature imports from barrels remain forbidden.

### 3. App-level orchestration seams

Current routing lazy-loads feature route modules directly for `/crm/*`, `/quotes/*`, and `/recipes/*`. Cross-feature composition should move to app-owned wrappers where needed. Feature route modules may remain for single-feature screens, but pages that wire multiple feature dependencies must live under `src/app/**` or be route elements created there.

Recommended app seams:

| App seam | Responsibilities | Preserves |
|---|---|---|
| `src/app/pages/QuoteCreatePage.tsx` / `QuoteEditPage.tsx` or app-owned quote route wrapper | Call quote hooks, CRM client hooks, recipe template hooks, pass clients/templates/client-creation slot to `QuoteForm`. | Client selection, client creation, template selection, real-time costing. |
| `src/app/pages/QuoteContractPage.tsx` | Call quote/template hooks and `useWorkshopSettings`, pass settings snapshot to `ContractPreview`. | Contract rendering, PDF/copy behavior, current workshop info. |
| `src/app/pages/CrmClientsPage.tsx` / `CrmClientDetailPage.tsx` or app-owned CRM route wrapper | Call CRM hooks and quote hooks, compute/pass quote summaries and status rendering data/slot to CRM components. | CRM quote history, totals, statuses, badges. |
| `src/app/pages/RecipesPage.tsx` or app-owned recipes route wrapper | Call recipe hooks, inventory hooks, settings hook, pass materials, price history, and `stock_alert_enabled` to recipe list/stock components. | Stock alerts, material availability, cost history sparkline. |

The app seam should pass plain data, callbacks, or component slots. It should not move feature DB queries into `src/shared`; DB queries remain in feature `api/`, and TanStack Query wrappers remain in feature `hooks/`.

## Per-edge detailed design

### Edge 1: `crm → quotes`

**Decision:** Split into shared quote contracts/pure calculator plus app-injected quote data.

- Move `calculateQuote` unchanged to `src/shared/lib/quotesCalculator.ts`.
- Put quote status constants and the quote-with-client read shape in `src/shared/types/quotes.ts`.
- Refactor CRM components to receive quote summaries/lists through props instead of calling `useQuotes`.
- Replace direct `QuoteStatusBadge` import with either:
  1. an app-composed status badge slot, or
  2. a CRM-local/simple shared status display that uses shared quote status constants.

**No workflow module:** CRM display is read-only composition, not a cross-domain operation.

### Edge 2: `quotes → crm`

**Decision:** Shared client read contracts plus app-level client hooks and creation UI.

- Move client read types and `CLIENT_SOURCE_LABELS` to `src/shared/types/client.ts`.
- Stop quote types from re-exporting CRM types.
- Delete or retire `src/features/quotes/hooks/useClients.ts` passthrough after callers move.
- `QuoteForm`/`ClientSection` should receive clients and selected-client callbacks through props.
- `ClientDialog` should receive a create-client slot/callback from the app seam, or be replaced by an app-owned dialog that renders CRM `ClientForm` and reports the created client back to the quote form.

**Workflow module candidate:** only if preserving inline client creation requires coordinated state that cannot be expressed as explicit props/callbacks. If used, it must be a quote-creation workflow module with explicit inputs (`clients`, `createClient`, current form state) and outputs (`selectedClientId`, created client result), not a generic CRM service.

### Edge 3: `quotes → recipes`

**Decision:** Shared recipe costing/contracts plus app-owned template fetching.

- Move `FurnitureTemplateWithItems`/recipe snapshot types to `src/shared/types/recipes.ts`.
- Move `computeRecipeCost` and `resolveItemQuantity` to `src/shared/lib/recipeCosting.ts` with exact current formula behavior.
- Move or expose required pure dependencies without feature imports; ensure the moved code imports only `src/shared/**`.
- `QuoteForm` receives furniture templates as props from an app quote page that calls the recipe template hook.
- `QuoteForm` may continue computing live preview internally, but only with shared pure helpers and injected template data.

**Workflow module candidate:** `src/shared/workflows/quoteCreation` (or an app-local workflow module) is acceptable only if live quote-building becomes too awkward with props. It must not fetch data; it should accept clients/templates/settings/form values and return deterministic quote draft/cost outputs.

### Edge 4: `quotes → settings`

**Decision:** App-level settings injection for contract preview.

- `ContractPreview` receives a `workshopSettings` snapshot prop containing the fields currently rendered by `renderContract`.
- The app contract page calls `useWorkshopSettings(workshopId)` and passes the snapshot.
- Keep quote-owned contract templates, renderer, PDF generation, and selected-template state in quotes unless they need app composition.

**No workflow module initially:** current evidence is a single hook import for display data.

### Edge 5: `recipes → inventory`

**Decision:** Shared material/price contracts plus app-owned inventory fetching; choose shared UI only for pure presentational sparkline.

- Redirect `Material` type imports to existing `src/shared/types/material`.
- Move/extract `PriceHistoryRow` to `src/shared/types/priceHistory.ts`.
- Recipe components/hooks receive `materials` and `priceHistory` from app-owned orchestration rather than calling inventory hooks internally.
- `useStockCheck` may remain recipe-owned if it accepts explicit inputs (`recipe`, `materials`, `stockAlertEnabled`) and returns computed shortages/status.
- `PriceSparkline` should either:
  - be composed in the app page and passed as a slot, if it remains inventory-owned, or
  - move to `src/shared/ui/PriceSparkline.tsx` if it is purely presentational and has no inventory-specific behavior.

**Workflow module candidate:** recipe cost/stock workflow only if app props plus recipe-local pure hooks cannot preserve shortage and history calculations. It must not own inventory fetching.

### Edge 6: `recipes → settings`

**Decision:** App-level settings flag injection.

- The app recipes page calls `useWorkshopSettings(workshopId)`.
- Pass `stock_alert_enabled` or a minimal settings snapshot to `MuebleList` and `useStockCheck`.
- Recipes code must not call `useWorkshopSettings` after this seam lands.

**No workflow module initially:** the coupling is a single boolean setting used by stock alert behavior.

## Costing and auditability design

To keep quote/recipe costing exact and auditable:

1. Move pure functions by copy-equivalence: no rounding, no formula rewrites, no number type changes, no changed default values.
2. Preserve existing formulas:
   - quote cost base = recipe cost + all extras;
   - visible extras = extras with `show_in_quote=true`;
   - `on_cost` and `on_price` margin behavior, including divisor fallback;
   - recipe quantity formula fallback through `safeEvalFormula`;
   - waste percentage application;
   - wood usage behavior;
   - labor total behavior.
3. Add characterization tests around moved functions before/with import rewrites.
4. Use fixed fixture inputs for quote totals, recipe totals, and price-history trend points.
5. Treat any numeric output delta as a failed refactor unless explicitly approved outside SDD9.

## Validation strategy

| Area | Validation |
|---|---|
| Quote creation | Characterization/component coverage for creating/editing a quote with existing client, selecting furniture template, changing params, adding extras, and seeing identical live totals. Manual smoke: `/quotes/new` and quote edit route. |
| Costing auditability | Unit tests for `calculateQuote`, `computeRecipeCost`, `resolveItemQuantity`, wood usage dependency, waste, labor, margin modes, and price-history cost points. Compare pre/post expected values exactly. |
| Contract preview | Component or integration coverage for `ContractPreview` receiving settings snapshot; verify workshop name/address/phone/email/footer render and copy/PDF pathways still receive rendered contract text. Manual smoke: `/quotes/:id/contract`. |
| CRM history | Component/integration coverage for client list/detail quote counts/totals/status labels or colors using injected quote summaries. Manual smoke: `/crm/clientes` and `/crm/clientes/:id`. |
| Stock alerts | Unit/component coverage for `useStockCheck`/stock shortage calculation with `stock_alert_enabled=true/false`, enough stock, and shortage cases. Manual smoke: `/recipes`. |
| Architecture guard | Run `npm run lint` after each exception removal; grep for `@/features/<other>` imports under changed feature directories. |

## Staged implementation forecast

Auto-forecast recommends staged work units. The full change is likely over 400 lines if done at once, so each slice should be treated as a PR-ready work unit and measured before implementation.

| Slice | Scope | Expected review risk | Budget forecast | Exception impact |
|---|---|---:|---:|---|
| WU1 | Mechanical shared contracts: `Material` import path, quote status constant path, establish minimal shared types if already trivial | Low | ~20–80 changed lines | Reduces `recipes → inventory` and `crm → quotes`, may not fully remove exceptions. |
| WU2 | Shared pure calculators/contracts: quote calculator, recipe costing, client/quote/recipe/price/settings read models + characterization tests | Medium | ~180–350 changed lines | Removes type/pure-helper portions; keep hook/UI exceptions until app seams land. |
| WU3 | Quote creation app seam: public barrels for CRM/quotes/recipes, app-owned quote create/edit wrappers, `QuoteForm` gets clients/templates/create-client seam | High | ~250–400 changed lines | Target first protected workflow: `quotes → crm` and `quotes → recipes` hook/UI portions. Split if forecast exceeds budget. |
| WU4 | Contract preview settings seam | Low | ~80–180 changed lines | Removes `quotes → settings`. |
| WU5 | CRM quote display seam: app-owned CRM wrappers, injected quote summaries/status display | Medium | ~180–350 changed lines | Removes `crm → quotes`. |
| WU6 | Recipes inventory/settings seam: injected materials, price history, stock flag; sparkline decision | Medium/High | ~250–400 changed lines | Removes remaining `recipes → inventory` and `recipes → settings`. Split sparkline/shared UI if needed. |
| WU7 | Final ESLint cleanup and architecture verification notes | Low | ~10–60 changed lines | Removes any remaining temporary exception entries atomically with the last seam. |

If WU3 or WU6 exceeds 400 changed lines during task planning, auto-slice by workflow boundary rather than by file type. Keep tests with the slice they verify.

## Rollout and rollback plan

- Land slices in dependency order: shared contracts before app orchestration that depends on them.
- Remove each lint exception only in the same slice that eliminates the corresponding imports.
- Roll back by reverting the latest slice; earlier shared contracts should remain backward-compatible until their consumers are migrated.
- Keep old component behavior reachable until the app seam is fully wired and verified.
- Do not remove feature route modules until their app-owned replacements are active and covered.
- If a slice reveals ambiguous product behavior or numeric deltas, stop before exception removal and return to design/spec clarification.

## Rejected approaches

| Approach | Reason rejected |
|---|---|
| One blanket pattern for all edges | The coupling mixes type-only imports, pure calculations, hooks, UI slots, and settings flags; one pattern would either over-share or over-orchestrate. |
| Event bus | Adds runtime behavior and failure modes without product need; hides dependencies. |
| Shared global store | Turns feature boundaries into implicit state coupling. |
| Feature-to-feature public API imports | Barrels are for `src/app/**` composition only, not a loophole for feature imports. |
| Moving hooks/API calls into `src/shared` | Violates existing architecture: DB queries stay in feature `api/`, TanStack Query wrappers stay in feature `hooks/`. |
| All-at-once decoupling | Likely exceeds 400 changed lines and mixes quote creation, CRM display, contract preview, and stock alerts in one review. |
| Workflow module first | Current evidence supports props plus shared helpers for most edges; workflow modules should be a fallback for explicit cross-domain operations only. |

## Open implementation notes for tasks

- Confirm exact route ownership before apply: current `/crm/*`, `/quotes/*`, and `/recipes/*` lazy routes point to feature route modules, so app orchestration likely needs new app route wrappers or app pages.
- Decide sparkline placement during WU6: shared UI if pure presentational; app slot if inventory ownership matters.
- Keep public API barrels minimal and reviewable; exporting everything recreates an implicit service layer.
- Update OpenSpec/task artifacts to tie each exception removal to validation evidence.

## skill_resolution

paths-injected

## Persistence note

Engram memory tools were not available in this child session, so no observation was saved. The design artifact is persisted at `sdd9/design.md`.
