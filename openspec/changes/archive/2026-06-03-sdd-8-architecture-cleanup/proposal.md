# SDD8 Architecture Cleanup Proposal

SDD8 will reduce feature-sliced architecture coupling by establishing safe shared boundaries, moving clearly shared utilities/types out of feature modules, and defining guardrails for future refactors. It intentionally avoids high-risk core coupling changes until the spec/design phases choose an architecture for quote/CRM/recipe orchestration.

## Intent

The codebase already follows the intended `src/features/<name>/` and `src/shared/` shape, but exploration found 15+ cross-feature import violations. SDD8 should make architecture boundaries reviewable and enforceable without changing user-visible behavior.

## Scope

### In scope

1. **Shared foundation cleanup**
   - Move feature-owned utilities that are already used across multiple features into `src/shared/`.
   - Resolve duplicated/shared type ownership where the owner is unambiguous.
   - Keep changes behavior-preserving; add focused tests only for moved utilities or newly introduced contracts.

2. **Import-boundary guardrails**
   - Define the allowed import model for feature-sliced modules.
   - Add or prepare lint/configuration guardrails that prevent new cross-feature imports once scoped violations are resolved.
   - Document any temporary exceptions explicitly.

3. **Architecture decision capture**
   - Decide, during spec/design, how composition features and tightly coupled domains should interact:
     - route/page-level composition,
     - feature public APIs,
     - shared contracts,
     - or another explicit pattern.
   - Produce concrete follow-up boundaries for dashboard, settings/onboarding, quotes/CRM, and recipes/inventory coupling.

4. **Low-risk boundary refactors only after design approval**
   - Include only refactors whose dependency direction and rollback are clear in the SDD8 design/tasks artifacts.
   - Keep each delivery slice within the 400 changed-line review budget.

### Explicitly out of scope

- Continuing, reviewing, rebasing, or implementing **SDD7 PR3**.
- High-risk quotes/CRM/recipes decoupling implementation before an architecture decision is recorded.
- Behavior changes, new product features, or UI redesign.
- Database schema/RLS changes unless a later SDD8 design explicitly identifies an unavoidable need.
- Large all-at-once cleanup of every cross-feature import violation.

## Affected Areas

| Area | Expected impact |
|---|---|
| `src/shared/` | New shared utilities/contracts for cross-feature reuse. |
| `src/features/quotes/` | Remove ownership of utilities/types that are not quote-specific. |
| `src/features/crm/`, `dashboard/`, `inventory/`, `recipes/` | Update imports for moved shared utilities/contracts where safe. |
| Lint/config/docs | Boundary rules and documented exceptions for feature-sliced architecture. |
| OpenSpec artifacts | Spec/design/tasks must record decisions before high-risk refactors. |

## Non-Goals

- Do not eliminate every architecture violation in one implementation package.
- Do not introduce event buses, shared global state, or route orchestration without design approval.
- Do not make lint fail in CI as an intermediate end state.
- Do not change runtime behavior to satisfy structural cleanup.

## Acceptance Criteria

- [ ] `proposal.md`, `spec.md`, `design.md`, and `tasks.md` define a bounded SDD8 implementation plan before code changes.
- [ ] SDD7 PR3 is documented as out of scope and remains untouched.
- [ ] Shared utility/type moves have clear owners, updated imports, and focused tests where required by strict TDD.
- [ ] Import-boundary rules are documented and either enforced without breaking CI or staged with explicit temporary exceptions.
- [ ] Any composition/core-coupling refactor has a recorded architecture decision, rollback plan, and review slice under the 400 changed-line budget.
- [ ] Existing tests and lint remain green after each implementation slice.
- [ ] No production/test implementation changes are made during the proposal phase.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Boundary lint exposes many existing violations and blocks CI. | Stage enforcement behind resolved scopes or documented temporary exceptions; never leave CI red. |
| Utility/type moves accidentally change runtime behavior. | Keep moves mechanical, add focused unit tests for moved utilities, and run existing tests. |
| Composition refactors expand beyond review budget. | Use chained delivery with one boundary per PR and stop before high-risk coupling if design is unresolved. |
| Quotes/CRM/recipes coupling requires product/API decisions. | Treat as a design decision gate, not automatic implementation scope. |
| SDD7 PR3 work leaks into SDD8. | Keep SDD7 PR3 explicitly excluded from tasks, diffs, and verification. |

## Delivery Strategy

Use chained delivery if implementation exceeds the 400 changed-line review budget. The initial forecast from exploration is about 450 changed lines for full cleanup, so SDD8 should prefer small review slices:

1. **Slice 1 — Shared foundation**: move clearly shared utilities/types and update imports.
2. **Slice 2 — Boundary guardrails**: document and enforce import rules where they can pass cleanly.
3. **Slice 3 — Composition cleanup, if approved by design**: dashboard/settings/onboarding seams only if the design proves they are low-to-medium risk and reviewable.
4. **Deferred/follow-up — Core coupling**: quotes/CRM/recipes decoupling remains gated on an explicit architecture decision and may become a separate SDD/change if risk or size exceeds SDD8.

Each slice must include its own verification plan, rollback notes, and out-of-scope statement.

## Rollback

- Revert individual shared utility/type moves by restoring prior exports and imports.
- Remove or relax boundary lint rules if they block unrelated delivery.
- Revert any composition slice independently because each should be delivered as a bounded PR.
- No database rollback is expected for this proposal.

## Success Criteria

SDD8 succeeds when the project has a documented, enforceable path toward feature-sliced boundaries, the safest shared-foundation cleanup is implemented in reviewable slices, CI remains green, and high-risk core coupling is either resolved by an approved design or explicitly deferred with a clear follow-up plan.
