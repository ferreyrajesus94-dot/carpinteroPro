# SDD9 Core Coupling Cleanup Proposal

SDD9 should turn the remaining feature-to-feature coupling left by SDD8 into explicit, reviewable architecture decisions. The proposal does **not** choose one blanket pattern up front. It frames each core workflow for later spec/design/tasks to decide between app-level orchestration seams, shared domain contracts in `src/shared`, and dedicated workflow/coordination modules.

## Problem Statement

CarpinteroPro now has enforceable feature-sliced boundary rules, but the highest-risk domain coupling remains behind temporary lint exceptions. SDD8 intentionally deferred these dependencies because quote creation, CRM quote history, recipe costing, contract rendering, stock checks, and settings-driven calculations are domain-heavy workflows where mechanical import rewrites could change behavior.

Current evidence shows the remaining coupling is both UI/composition-oriented and domain-calculation-oriented:

- `openspec/specs/architecture-cleanup/spec.md` requires feature code to import only its own feature and `src/shared/**`, while `src/app/**` owns cross-feature composition.
- The same canonical spec says future core-coupling work must first choose between app-level orchestration, shared domain contracts, or dedicated workflow modules, and should reject event-bus/global-state shortcuts unless separately justified.
- `openspec/changes/archive/2026-06-03-sdd-8-architecture-cleanup/decisions/core-coupling.md` documents the deferred coupling directions: `crm → quotes`, `quotes → crm`, `quotes → recipes`, `quotes → settings`, `recipes → inventory`, and `recipes → settings`.
- `eslint.config.js` keeps narrow SDD8 temporary exceptions for exactly those directions, so lint can enforce cleaned areas while making the remaining debt visible.
- `AGENTS.md` establishes the target boundary model: feature modules may import their own feature and `src/shared/**`; `src/app/**` may compose multiple feature public APIs; `src/shared/**` must not import from features.
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/explore.md` maps the current coupling with file-level evidence and identifies missing public API seams for app-level composition.

## Goals

1. Define a decision framework for resolving each remaining lint exception without weakening feature-sliced architecture.
2. Preserve current user-visible behavior while moving orchestration and contracts to clearer ownership boundaries.
3. Identify which coupling belongs at the app/page seam, which belongs in neutral shared contracts, and which needs a dedicated workflow/coordination layer.
4. Keep implementation slices reviewable under the 400 changed-line budget by deferring work-unit boundaries to tasks.
5. Remove temporary SDD8 lint exceptions only when the corresponding workflow has a replacement seam and verification coverage.

## Non-Goals

- Do not implement production, source, or test changes in this proposal phase.
- Do not continue or modify SDD7 PR3.
- Do not add event buses, shared global state, or feature public API loopholes as a shortcut around boundaries.
- Do not move every domain type into `src/shared` by default; shared contracts should be stable, neutral, and intentionally scoped.
- Do not decide all implementation details before spec/design validates workflow ownership and risk.

## Scope Boundaries

### In scope for SDD9 planning

| Coupling area | Later phase should decide |
|---|---|
| CRM views that display quote history, totals, status, or badges | Whether app/page orchestration can fetch quote data and pass CRM-owned display props, or whether shared quote summary contracts are needed. |
| Quotes flows that create/select/update CRM clients | Whether client selection and client creation stay composed at the app seam, or require shared client read/write contracts. |
| Quotes flows that use recipe templates and recipe costing | Whether recipe template snapshots belong in shared contracts, or whether quote-building needs a workflow module. |
| Quotes contract preview that reads workshop settings | Whether settings reads become shared domain contracts or route-level injected configuration. |
| Recipes costing/stock checks that read inventory materials/price history | Whether material/price snapshots belong in shared contracts, or recipe costing needs a workflow module. |
| Recipes flows that read workshop settings | Whether settings are plain shared read contracts or injected workflow inputs. |

### Out of scope for this proposal

- Billing, auth, dashboard, onboarding, landing, legal, tasks, or SDD7 E2E work unless spec/design discovers a direct dependency.
- Database schema changes unless later design proves a workflow module needs a new persisted contract.
- Broad package or lint rule changes beyond eventual removal of existing temporary exceptions.

## Architecture Options to Evaluate in Spec/Design

### 1. App-level orchestration/composition seams

Use when the coupling is page/workflow composition: a route or app container can call multiple feature hooks/public APIs and pass plain props, callbacks, or slots into feature components.

Likely candidates:

- CRM client detail/list displays quote summaries.
- Quote form coordinates client selection/creation UI.
- Contract preview receives settings-derived inputs.

### 2. Shared domain contracts in `src/shared`

Use when multiple features need stable, neutral read models or pure helpers that are not owned by one feature.

Likely candidates:

- Client summary/read model used by quotes and CRM.
- Quote summary/status/total read model used by CRM and quotes.
- Material/price/settings snapshots used by recipes and quotes.

Guardrail: shared contracts should stay domain-neutral and should not import feature code.

### 3. Workflow modules / coordination layer

Use when the behavior is a cross-domain operation rather than simple composition or shared type reuse.

Likely candidates:

- Quote creation workflows involving client data, recipe templates, costing, and settings.
- Recipe costing/stock checks involving inventory price history and workshop settings.
- Contract preview generation if it combines quote data, templates, settings, and formatting rules.

Guardrail: spec/design should define where workflow modules live and how they avoid becoming an unbounded service layer.

## Affected Areas

- `src/features/crm/**`
- `src/features/quotes/**`
- `src/features/recipes/**`
- `src/features/inventory/**`
- `src/features/settings/**`
- `src/shared/**` for neutral contracts/helpers approved by spec/design
- `src/app/**` for cross-feature composition approved by spec/design
- `eslint.config.js` for staged removal of SDD8 temporary exceptions
- OpenSpec artifacts for architecture cleanup follow-up requirements

## Risks

- **Behavior regression:** quote totals, recipe costs, stock checks, CRM history, or contract previews could change if imports are moved mechanically.
- **Over-shared contracts:** moving too much into `src/shared` could recreate coupling under a neutral path.
- **Overbuilt workflow layer:** a coordination module could become a vague service layer if ownership and inputs are not explicit.
- **Review overload:** resolving all six coupling directions at once may exceed 400 changed lines and mix unrelated workflows.
- **Lint drift:** removing exceptions before replacement seams are ready could block unrelated work; keeping them too long leaves architecture debt unresolved.

## Rollback Approach

Each future implementation slice should be independently revertible:

- Keep lint exception removal in the same slice as the replacement seam it validates.
- Avoid broad shared-contract migrations unless the slice can be rolled back without affecting unrelated features.
- Preserve current feature behavior and query semantics; if a seam changes data flow, tests should cover the old user-visible result.
- If a slice exceeds the review budget or exposes ambiguous ownership, pause and return to design/tasks rather than forcing a refactor.

## Acceptance-Oriented Success Criteria

SDD9 proposal succeeds when:

- [ ] The proposal artifact exists at `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/proposal.md`.
- [ ] The proposal frames the three valid architecture directions without prematurely choosing one global answer.
- [ ] Spec/design follow-up is clearly responsible for mapping each remaining coupling direction to an approved seam.
- [ ] No production/source/test changes are made during the proposal phase.
- [ ] SDD7 PR3 remains untouched.
- [ ] The 400 changed-line review guard is recorded for later tasks/apply planning.
- [ ] The remaining temporary ESLint exceptions are tied to future acceptance criteria for staged removal.

## Review Workload Guard

Review strategy is **auto-forecast** with a **400 changed-line budget**. Later tasks should forecast each work unit before implementation and prefer chained PR/work-unit slices when a workflow cannot be safely resolved under the limit.

Suggested first-pass slicing for later tasks, subject to spec/design:

1. CRM ↔ quotes display/client-selection seams.
2. Quotes ↔ recipes quote-building/costing seams.
3. Quotes/recipes ↔ settings read-contract seams.
4. Recipes ↔ inventory material/price/stock seams.
5. Final lint-exception removal and architecture verification.

## Proposal Question Round / Decisions

The parent/user proposal round resolved these planning decisions for spec/design:

1. **First protected workflow:** quote creation. SDD9 should protect quote creation, client selection, recipe template selection, and real-time quote costing before less central displays.
2. **Shared contract scope:** current UI read models. Shared domain contracts should be scoped to stable current UI needs, not expanded into a future reporting/analytics language in this SDD.
3. **Costing auditability:** all quote/recipe costing values must remain exact and auditable after refactor, including material prices, settings, margins, quantities, and computed results.
4. **Workflow modules:** small workflow modules are acceptable with limits when app-level orchestration plus shared contracts becomes awkward; they must have explicit inputs/outputs and must not become a generic service layer.
5. **Behavior preservation:** preserve all production behavior unless spec/design identifies and the user approves a narrower exception.

Current planning assumptions:

- Preserve all production behavior; SDD9 is architecture cleanup, not product redesign.
- Prefer app-level composition for UI/page wiring, shared contracts for stable current UI read models, and tightly scoped workflow modules only for true cross-domain operations.
- Remove lint exceptions incrementally, never before the replacement seam is implemented and verified.
- Keep SDD7 PR3 out of scope.

## Evidence References

- `openspec/specs/architecture-cleanup/spec.md`
- `openspec/changes/archive/2026-06-03-sdd-8-architecture-cleanup/decisions/core-coupling.md`
- `eslint.config.js`
- `AGENTS.md`
- `openspec/changes/2026-06-04-sdd-9-core-coupling-cleanup/explore.md`

## skill_resolution

paths-injected
