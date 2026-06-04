# SDD8 Architecture Cleanup Design

SDD8 will make feature boundaries safer without changing product behavior. The implementation should start with shared ownership fixes and CI-safe guardrails, then apply only reviewable composition refactors. High-risk quotes/CRM/recipes coupling is explicitly deferred unless a later SDD/change approves it.

## Decisions

| Area | Decision | Rationale |
|---|---|---|
| Shared utilities | Cross-feature formatting utilities belong in `src/shared/lib/`. Move `formatCurrency` from `src/features/quotes/types.ts` to `src/shared/lib/formatters.ts`. | `formatCurrency` is already consumed by dashboard, inventory, CRM, and quotes; quote ownership creates false dependencies. |
| Shared settings type | `WorkshopSettings` is a shared database contract. Canonical read type should live in `src/shared/api/workshopSettings.ts` (or a new `src/shared/types/workshopSettings.ts` if apply finds that clearer). Feature-local duplicates should be removed. Mutation-only insert/update types may remain next to the settings API until they are needed outside settings. | Existing source already has `src/shared/api/workshopSettings.ts`; using it minimizes churn and avoids making recipes/quotes import from settings. |
| Feature public APIs | Features may expose `index.ts` public APIs for app-level composition only. Feature-to-feature imports remain forbidden even through public APIs unless a design explicitly allows an exception. | Public APIs reduce deep imports, but they must not become a loophole for cross-feature coupling. |
| Import-boundary enforcement | Add guardrails in a CI-safe staged mode. Enforce cross-feature restrictions only for clean or newly cleaned scopes; document temporary exceptions for dirty scopes. Never merge a lint configuration that leaves `npm run lint` red. | Current code has many legacy violations; all-at-once enforcement would block CI and unrelated delivery. |
| Composition features | Dashboard, settings, and onboarding should use an app/page-level composition pattern. Feature components become presentational or feature-local; route/page composition may import multiple feature public APIs and pass data/actions/slots into feature components. | These screens are intentionally cross-domain workflows. Moving orchestration to app/page seams preserves feature isolation without hiding coupling. |
| Core quotes/CRM/recipes coupling | Defer implementation. Treat quotes/CRM/recipes/inventory coupling as a separate gated architecture package unless SDD8 tasks later prove a single low-risk slice under budget. | This area is bidirectional and domain-heavy; mechanical cleanup risks behavior changes and oversized review diffs. |
| SDD7 PR3 | No SDD7 PR3 work is part of SDD8. | User explicitly excluded it. |

## Target import model

```text
src/app/**                         may compose multiple features
src/features/<feature>/**           may import local files and src/shared/** only
src/features/<feature>/index.ts     may expose feature public API for app composition
src/shared/**                       may not import src/features/**
```

Temporary exceptions are allowed only when documented in the lint/config comment with the SDD8 change id and a removal condition. Exceptions must cover known legacy violations so CI stays green.

## Data and control flow

### Shared foundation

1. Callers import `formatCurrency` from `@/shared/lib/formatters`.
2. Quotes retains quote-only constants and quote types in `src/features/quotes/types.ts`.
3. Code that needs workshop settings read shape imports the canonical shared `WorkshopSettings` type from `@/shared/api/workshopSettings` or a dedicated shared settings type file.
4. Settings mutation code continues through `src/features/settings/api/` and `src/features/settings/hooks/` unless broader sharing is explicitly needed.

### Dashboard composition

Preferred implementation pattern:

1. `src/app` or the dashboard route composition layer gathers `workshopId`, quote data, and inventory data.
2. The dashboard feature receives plain data and callbacks as props.
3. Dashboard components import dashboard-local types plus shared contracts/formatters only.
4. Navigation shortcuts stay local because route paths are app-level strings, not feature imports.

This means dashboard may still present quote and inventory information, but its components should not import quote/inventory hooks or components directly.

### Settings/onboarding composition

Preferred implementation pattern:

1. Settings form owns settings UI and accepts optional slots/actions for cross-domain cards such as billing and onboarding reset.
2. An app/page composition wrapper wires `BillingSettingsCard`, `useSubscription`, and `useResetOnboarding` into settings via props/slots.
3. Onboarding wizard remains a page workflow, but settings and inventory operations should be passed through a composition seam or moved to shared/app-level workflow services before strict enforcement covers onboarding.
4. The user-facing flow and copy remain unchanged.

### Core domain coupling

Quotes, CRM, recipes, and inventory should not be mechanically decoupled in this SDD8 design package. Follow-up architecture should decide between:

- app-level orchestration using feature public APIs,
- shared domain contracts for quote/client/material snapshots,
- or a dedicated workflow module for quote creation and recipe costing.

Rejected for SDD8 implementation: introducing an event bus or shared global state solely to eliminate imports. That would add runtime behavior and testing burden without a product need.

## Work units and review slices

| Unit | Scope | Expected files | Forecast changed lines | TDD/validation | Delivery |
|---|---|---:|---:|---|---|
| WU1 Shared foundation | Move `formatCurrency`; resolve `WorkshopSettings` canonical imports; add focused formatter test. | 8-12 | 80-140 | Structural exception plus formatter unit test; `npm test`; `npm run lint`. | PR1 |
| WU2 CI-safe boundary guardrails | Add/import lint guardrail config and document allowed import model/temporary exceptions. | 2-4 | 60-120 | `npm run lint` must pass; optionally add a small lint config fixture only if practical. | PR2 |
| WU3 Dashboard composition | Move dashboard data orchestration to app/route seam; dashboard components consume props/shared types. | 6-10 | 180-300 | Contract test if component props change; existing dashboard stats tests stay green. | PR3 if approved |
| WU4 Settings/onboarding composition | Replace direct settings imports of billing/onboarding with slots/actions; plan onboarding operation seam. | 5-9 | 180-320 | Component contract test if props/slots change; `npm test`; `npm run lint`. | PR4 if approved |
| WU5 Core coupling decision only | Record follow-up scope for quotes/CRM/recipes; no implementation in SDD8 unless separately approved. | OpenSpec only | 20-60 | Documentation review. | Deferred/separate SDD |

Total full cleanup forecast exceeds the 400 changed-line review budget. Use chained PRs/work-unit commits. Each implementation PR must state its start state, end state, dependency, out-of-scope items, rollback, and validation results.

## Import-boundary enforcement strategy

1. Start with a documented rule in AGENTS/OpenSpec: features import only self/shared; app composes features.
2. Add lint enforcement for clean or cleaned features first. Do not include unresolved dirty scopes unless exceptions make lint pass.
3. For dirty scopes, list temporary exceptions by source/target pair, not a broad `src/features/**` allowlist.
4. As each composition/refactor slice lands, remove that exception in the same PR.
5. CI acceptance for every slice: `npm run lint` exits 0.

Implementation can use `eslint-plugin-import` `no-restricted-paths` zones or another ESLint-compatible boundary mechanism, but the selected mechanism must support the staged model above in flat config.

## Rollback plan

- WU1: Revert imports and restore the old quote-local exports. Formatter test can be removed with the revert.
- WU2: Remove or relax the boundary rule/exception block if it blocks CI. This rollback is config-only.
- WU3: Revert the dashboard wrapper/prop changes; dashboard can return to direct hooks because no data model migration is involved.
- WU4: Revert slot/action injection and restore direct settings/onboarding imports.
- WU5: No production rollback; update or supersede the OpenSpec decision if follow-up scope changes.

No database rollback is expected because SDD8 must not change schema, migrations, or RLS.

## Validation strategy

- Before each implementation PR: identify whether the slice is structural or behavior-changing.
- Structural refactors: document strict-TDD exception, keep behavior identical, run `npm test` and `npm run lint`.
- Moved utilities: add/keep a focused unit test for outputs in the new shared location.
- Component contract changes: write the RED test for the new prop/slot contract first, then implement and refactor.
- Boundary config: validate that lint passes on the current tree and that comments identify temporary exceptions.
- Manual smoke after composition slices: dashboard renders, settings loads billing card/reset action, onboarding still saves workshop/material steps.
- Confirm every SDD8 diff excludes SDD7 PR3 production/test changes.

## Non-goals

- No SDD7 PR3 continuation, rebasing, reviewing, or code changes.
- No user-visible behavior changes or UI redesign.
- No database schema, migration, or RLS changes.
- No event bus/global store introduced for architecture cleanup.
- No all-at-once attempt to remove every cross-feature import.

## Open gates before apply

- If a planned PR exceeds 400 changed lines, use chained delivery or ask for a size exception before implementation.
- If lint tooling cannot express staged enforcement without broad loopholes, pause and choose between a smaller guardrail slice or a custom boundary check.
- If dashboard/settings/onboarding refactors reveal behavior changes, keep strict TDD and split the slice before proceeding.
- Core quotes/CRM/recipes coupling requires a separate approval/design gate before production/test implementation.
