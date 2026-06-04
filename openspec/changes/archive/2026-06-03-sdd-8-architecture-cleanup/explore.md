# SDD8 Architecture Cleanup — Exploration Findings

Eliminate cross-feature import violations and establish proper feature boundaries to enforce the feature-sliced architecture defined in AGENTS.md.

## Current State

The codebase follows good practices (no `var`, no `any`, proper feature structure) but has **15+ cross-feature import violations** that undermine modularity and create hidden coupling.

### Cross-Feature Import Violations

| Source Feature | Target Feature | Files | Impact |
|----------------|----------------|-------|--------|
| **quotes** | crm | types.ts, useClients.ts, ClientDialog.tsx, ClientSection.tsx | Re-exports Client types, creates false dependency |
| **quotes** | recipes | QuoteForm.tsx, FurnitureSection.tsx | Imports FurnitureTemplate types |
| **quotes** | settings | ContractPreview.tsx | Imports useWorkshopSettings hook |
| **crm** | quotes | ClientList.tsx, ClientDetail.tsx, KanbanCard.tsx | Imports formatCurrency, calculateQuote, QuoteStatusBadge |
| **dashboard** | quotes | Dashboard.tsx, StatusPieChart.tsx, KPICards.tsx, ActiveQuotesPanel.tsx, useDashboardStats.ts | Heavy coupling to quote types and hooks |
| **dashboard** | inventory | Dashboard.tsx | Imports useMaterials |
| **inventory** | quotes | MaterialList.tsx, InventoryStats.tsx | Imports formatCurrency |
| **recipes** | inventory | 9 files (pdf.ts, stockCheck.ts, computeWoodUsage.ts, etc.) | Imports Material types, useMaterials, PriceHistoryRow |
| **recipes** | settings | useStockCheck.ts, MuebleList.tsx | Imports useWorkshopSettings |
| **recipes** | quotes | pdf.ts | Imports WorkshopSettings type |
| **settings** | billing | WorkshopSettings.tsx | Imports BillingSettingsCard, useSubscription |
| **settings** | onboarding | WorkshopSettings.tsx | Imports useResetOnboarding |
| **onboarding** | settings | OnboardingWizard.tsx | Imports useUpsertWorkshopSettings |
| **onboarding** | inventory | OnboardingWizard.tsx, seedMaterials.ts | Imports useCreateMaterial, MaterialInsert |

### Shared Utilities Misplaced

| Utility | Current Location | Used By | Should Be |
|---------|-----------------|---------|-----------|
| `formatCurrency` | src/features/quotes/types.ts | dashboard, inventory, crm | src/shared/lib/formatters.ts |
| `WorkshopSettings` type | Duplicated in quotes/types.ts AND settings/api/workshopSettings.ts | recipes, quotes, settings | settings/types.ts only |

### Dependency Graph Issues

```text
Bidirectional:
  quotes ↔ crm

Chain dependencies:
  recipes → inventory → quotes

Composition features (tight coupling):
  dashboard → quotes, inventory
  settings → billing, onboarding
  onboarding → settings, inventory
```

## Cleanup Opportunities

### 1. Extract Shared Utilities (Low Risk, High Value)

**Acceptance Criteria:**
- [ ] Move `formatCurrency` from `src/features/quotes/types.ts` to `src/shared/lib/formatters.ts`
- [ ] Update all imports (dashboard, inventory, crm, quotes)
- [ ] Remove `WorkshopSettings` type from `quotes/types.ts`, use `settings/types.ts` only
- [ ] Update all imports (recipes, quotes, settings)
- [ ] Add unit test for `formatCurrency` in shared location

**Estimated Impact:** ~8 files changed, ~40 lines moved

### 2. Add ESLint Rules (Low Risk, High Value)

**Acceptance Criteria:**
- [ ] Add `eslint-plugin-import` rule: `no-restricted-paths` to prevent `src/features/*/` from importing `src/features/*/` (except self)
- [ ] Allow exceptions for composition features (dashboard, settings, onboarding) with explicit configuration
- [ ] Run `npm run lint` — should fail on current violations
- [ ] Document the rule in AGENTS.md

**Estimated Impact:** 2 files (eslintrc, AGENTS.md), ~30 lines added

### 3. Refactor Dashboard to Use Composition (Medium Risk, Medium Value)

**Acceptance Criteria:**
- [ ] Dashboard receives data via props or context, not direct hook imports
- [ ] Create `DashboardProvider` or lift state to parent route component
- [ ] Dashboard components import only from `src/shared/` and local files
- [ ] Tests verify dashboard renders with injected data

**Estimated Impact:** ~6 files changed, ~80 lines refactored

### 4. Refactor Settings/Onboarding Composition (Medium Risk, Medium Value)

**Acceptance Criteria:**
- [ ] WorkshopSettings receives billing/onboarding components via props or slots
- [ ] OnboardingWizard receives callbacks for settings/materials operations
- [ ] No direct imports from billing, onboarding, settings, inventory features
- [ ] Tests verify composition works correctly

**Estimated Impact:** ~5 files changed, ~100 lines refactored

### 5. Resolve Quotes/CRM/Recipes Coupling (High Risk, High Value)

**Requires Architectural Decision:**
- Option A: Event-based decoupling (quotes emits events, CRM subscribes)
- Option B: Composition at route level (parent route orchestrates features)
- Option C: Shared context provider (features read from shared state)

**Acceptance Criteria (pending decision):**
- [ ] Quotes does not import from CRM
- [ ] CRM does not import from quotes
- [ ] Quotes does not import from recipes
- [ ] Recipes does not import from inventory/settings/quotes
- [ ] Each feature is self-contained with public API only

**Estimated Impact:** ~15 files changed, ~200 lines refactored

## Recommended PR Split

| PR | Scope | Files | Lines | Risk | Dependencies |
|----|-------|-------|------:|------|--------------|
| PR1 | Extract shared utilities | 8 | ~40 | Low | None |
| PR2 | Add ESLint rules | 2 | ~30 | Low | None |
| PR3 | Refactor dashboard composition | 6 | ~80 | Medium | PR1 |
| PR4 | Refactor settings/onboarding | 5 | ~100 | Medium | PR1 |
| PR5 | Resolve core feature coupling | 15 | ~200 | High | PR1, PR2, architectural decision |

**Total Estimated:** ~36 files, ~450 lines. This needs chained delivery or a narrowed SDD8 scope to stay inside the 400-line review budget.

## Testing Strategy

Since this is architecture cleanup with **no intended behavior changes**:

- **PR1-PR4:** Existing tests must remain green. Add tests only for moved utilities or newly introduced contracts.
- **PR5:** May require new tests if refactoring changes component interfaces or orchestration seams.
- **Exception:** Document in design that pure structural refactoring does not require new behavior tests per `testing.strict_tdd` guidance, but must keep existing validation green.

## Open Questions

1. **Architectural decision needed:** How should quotes/CRM/recipes decouple? Options: event-based, route-level composition, or shared context.
2. **Composition features:** Should dashboard/settings/onboarding remain as features or become page-level composition modules?
3. **Public API:** Should each feature expose an `index.ts` public API to enforce import boundaries?

## Next Step

Proceed to **proposal phase** to:
1. Define SDD8 acceptance criteria and non-goals.
2. Decide whether SDD8 includes the full architecture cleanup or only PR1-PR2 foundation.
3. Capture the architecture decision for quotes/CRM/recipes coupling before high-risk refactors.
