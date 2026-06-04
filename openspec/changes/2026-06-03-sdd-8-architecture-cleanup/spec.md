# SDD8 Architecture Cleanup Specification

## Purpose

Establish enforceable feature-sliced architecture boundaries by extracting shared utilities to their proper owner, documenting import rules, and defining safe composition patterns. The outcome MUST make architecture violations reviewable and prevent new ones, without changing user-visible behavior.

## Out of Scope

- **SDD7 PR3** (business-critical E2E) is explicitly out of scope and MUST NOT be continued, reviewed, rebased, or modified during SDD8.
- High-risk quotes/CRM/recipes decoupling implementation before an architecture decision is recorded.
- Behavior changes, new product features, or UI redesign.
- Database schema or RLS changes.

## Requirements

### Requirement: Shared Foundation Cleanup

The system MUST move cross-feature utilities and types that currently live inside individual features into `src/shared/` or their rightful single-feature owner, keeping runtime behavior identical.

#### Scenario: formatCurrency moves to shared

- GIVEN `formatCurrency` currently lives in `src/features/quotes/types.ts` and is imported by dashboard, inventory, crm, and quotes
- WHEN the SDD8 shared-foundation slice is applied
- THEN `formatCurrency` lives in `src/shared/lib/formatters.ts`, all imports are updated to the new path, and the old export in `src/features/quotes/types.ts` is removed

#### Scenario: WorkshopSettings type ownership resolved

- GIVEN `WorkshopSettings` type is duplicated in `src/features/quotes/types.ts` and `src/features/settings/api/workshopSettings.ts`
- WHEN the SDD8 shared-foundation slice is applied
- THEN `src/features/quotes/types.ts` no longer exports `WorkshopSettings`, `src/features/settings/types.ts` (or `api/workshopSettings.ts`) owns the canonical type, and all imports in recipes, quotes, and settings reference the canonical source

#### Scenario: Moved utilities retain behavior

- GIVEN existing code calls `formatCurrency` with a numeric value and optional locale/currency arguments
- WHEN the function is moved to `src/shared/lib/formatters.ts`
- THEN all existing outputs remain identical, and a focused unit test in the shared location covers at least the previously untested call patterns

### Requirement: Import-Boundary Guardrails

The system MUST define and document the allowed import model for feature-sliced modules, and MUST enforce that no new cross-feature imports are introduced once scoped violations are resolved.

#### Scenario: ESLint rule prevents new cross-feature imports

- GIVEN `eslint-plugin-import` is configured with `no-restricted-paths`
- WHEN a developer attempts to add `import { ... } from '@/features/crm/...'` inside `src/features/quotes/`
- THEN `npm run lint` fails with a clear message identifying the forbidden cross-feature import

#### Scenario: Temporary exceptions are explicit

- GIVEN composition features (dashboard, settings, onboarding) require time-bounded exceptions during migration
- WHEN the ESLint configuration is reviewed
- THEN any exceptions are listed with a code comment linking to the SDD8 design decision and a TODO or issue reference for eventual removal

#### Scenario: CI does not stay red for legacy violations

- GIVEN the current codebase has unresolved cross-feature imports in areas outside the current cleanup slice
- WHEN the boundary guardrails slice is merged
- THEN CI passes because enforcement is staged to resolved scopes only, or documented temporary exceptions cover known unresolved violations

### Requirement: Architecture Decision Capture

The system MUST record an explicit architecture decision for how tightly coupled domains (quotes/CRM/recipes, dashboard composition, settings/onboarding composition) should interact before any high-risk refactoring begins.

#### Scenario: Decision document exists before core coupling work

- GIVEN quotes/CRM/recipes have bidirectional and chain dependencies
- WHEN the SDD8 design phase completes
- THEN `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/design.md` (or a linked decision doc) records the chosen pattern with rationale and explicit rejection of the alternatives considered

#### Scenario: Composition patterns are defined

- GIVEN dashboard imports from quotes and inventory, and settings imports from billing and onboarding
- WHEN the architecture decision is recorded
- THEN the decision document specifies whether these features become page-level composition modules, use prop/slot injection, rely on a shared context provider, or another pattern, and includes rollback notes

#### Scenario: Public API boundaries are specified

- GIVEN each feature should expose a well-defined surface to prevent hidden coupling
- WHEN the architecture decision is recorded
- THEN the decision states whether features MUST export an `index.ts` public API, what belongs in it, and how consumers MUST import from it

### Requirement: Safe/Deferred Composition Cleanup

The system MUST refactor composition seams (dashboard, settings, onboarding) only after design approval, using reviewable slices under the 400 changed-line budget, and MUST defer high-risk core coupling until the architecture decision is approved.

#### Scenario: Dashboard composition is reviewable

- GIVEN the design approves dashboard decoupling from quotes and inventory
- WHEN the dashboard composition slice is implemented
- THEN the changed-line count is ≤400, the diff touches only dashboard and shared contracts, existing tests remain green, and dashboard components no longer import directly from quotes or inventory features

#### Scenario: Settings/onboarding composition is reviewable

- GIVEN the design approves settings/onboarding decoupling
- WHEN the settings/onboarding composition slice is implemented
- THEN the changed-line count is ≤400, the diff touches only settings, onboarding, and shared contracts, existing tests remain green, and settings no longer imports directly from billing or onboarding features

#### Scenario: Core coupling remains deferred

- GIVEN quotes/CRM/recipes decoupling is high-risk and requires an approved architecture decision
- WHEN SDD8 implementation completes
- THEN quotes may still import from CRM, CRM may still import from quotes, quotes may still import from recipes, and recipes may still import from inventory/settings/quotes, BUT the architecture decision document specifies the follow-up plan with explicit boundaries and acceptance criteria

## TDD and Validation Expectations

### Pure Structural Refactors

Packages that move code without changing runtime behavior (e.g., moving `formatCurrency` to `src/shared/lib/formatters.ts`) are purely structural. For these packages:

- The existing test suite MUST remain green (`npm test`).
- A focused unit test SHOULD cover the utility in its new shared location.
- No new integration or behavior tests are required because runtime behavior is unchanged.

This exception to `strict_tdd` is documented per `openspec/config.yaml` testing guidance for purely structural changes.

### Behavior-Changing Refactors

If a composition refactor changes component interfaces (e.g., introducing prop injection instead of direct hook imports):

- A failing test MUST demonstrate the new contract or the gap being closed.
- The minimal change MUST make the test pass.
- Refactoring MUST keep tests green.

### Lint and CI

- `npm run lint` MUST pass before each PR is merged.
- If lint rules are added that would fail on existing unresolved violations, they MUST be staged with documented exceptions or scoped to clean directories only.

## Validation Checklist

- [ ] `formatCurrency` is in `src/shared/lib/formatters.ts` with a focused unit test.
- [ ] `WorkshopSettings` type has a single canonical owner and no duplicate exports.
- [ ] ESLint configuration documents and enforces feature-sliced boundaries.
- [ ] CI passes after each SDD8 slice.
- [ ] Architecture decision for core coupling is recorded in the design doc before high-risk work begins.
- [ ] Dashboard/settings/onboarding composition has a recorded pattern and rollback plan before implementation.
- [ ] No SDD7 PR3 changes are present in any SDD8 diff.
- [ ] `npm test` remains green after every slice.
