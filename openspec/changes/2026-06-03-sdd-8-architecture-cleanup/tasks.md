# SDD8 Architecture Cleanup — Tasks

Establish enforceable feature-sliced boundaries by extracting shared utilities, documenting import rules, and defining safe composition patterns — without changing user-visible behavior.

## Out of Scope

**SDD7 PR3 (business-critical E2E) is explicitly out of scope.** It MUST NOT be continued, reviewed, rebased, or modified during SDD8. Any diff containing SDD7 PR3 changes is a defect and must be reverted before merge.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 500–780 (full SDD8, all work units) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 (WU1) → PR2 (WU2) → PR3 (WU3) → PR4 (WU4) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

---

## PR Sequence

```
PR1 (WU1 — shared foundation)         ←  no dependencies, start immediately
PR2 (WU2 — boundary guardrails)        ←  no dependencies, can parallel PR1
PR3 (WU3 — dashboard composition)      ←  depends on PR1, requires approval
PR4 (WU4 — settings/onboarding)        ←  depends on PR1, requires approval
Deferred (WU5 — core coupling decision) ←  OpenSpec doc only, no implementation
```

### Approval gates

- **PR1 + PR2**: Self-approvable. No architectural risk. Implementation may begin after tasks.md is reviewed.
- **PR3**: Requires explicit approval of the dashboard composition pattern (props injection at app/route seam). Do NOT start without approval.
- **PR4**: Requires explicit approval of the settings/onboarding composition pattern (slots/actions injection). Do NOT start without approval.
- **WU5**: Documentation only. Record the deferred core coupling decision. No code changes.

---

## Work Unit 1 — Shared Foundation (PR1)

**Goal:** Move `formatCurrency` to `src/shared/lib/formatters.ts`, resolve `WorkshopSettings` type canonical ownership, and update all cross-feature imports. Keep runtime behavior identical.

**TDD exception:** Pure structural refactor — no runtime behavior change. Per `openspec/config.yaml` strict TDD guidance, document this exception. The existing test suite MUST remain green. A focused unit test for `formatCurrency` in its new location is required.

**Forecast:** 8–12 files, 80–140 changed lines.

**Dependencies:** None.

### Task 1.1 — Create `src/shared/lib/formatters.ts`

- [x] Create `src/shared/lib/formatters.ts`.
- [x] Move `formatCurrency` function from `src/features/quotes/types.ts` into this file.
- [x] Export `formatCurrency` as a named export.
- [x] Preserve the exact function signature, default locale (`es-AR`), default currency (`ARS`), and output format.

**Verification:**
- File exists at `src/shared/lib/formatters.ts` with correct export.
- `grep -r "formatCurrency" src/` shows only the new location as the source definition.

### Task 1.2 — Add focused unit test for `formatCurrency`

- [x] Create `tests/shared/lib/formatters.test.ts`.
- [ ] Test cases:
  - `formatCurrency(1000)` → `"$ 1.000,00"` (or correct ARS format).
  - `formatCurrency(0)` → `"$ 0,00"`.
  - `formatCurrency(1234.56)` → `"$ 1.234,56"`.
  - `formatCurrency(-500)` → negative amount formatting.
  - Custom currency/locale override if supported.

**Verification:**
- `npm run test -- tests/shared/lib/formatters.test.ts` passes.
- Test file exists and covers at least 4 call patterns.

### Task 1.3 — Update all `formatCurrency` imports to shared path

- [x] Update imports in `src/features/dashboard/` (Dashboard.tsx, StatusPieChart.tsx, KPICards.tsx, ActiveQuotesPanel.tsx, useDashboardStats.ts) to `@/shared/lib/formatters`.
- [x] Update imports in `src/features/inventory/` (MaterialList.tsx, InventoryStats.tsx) to `@/shared/lib/formatters`.
- [x] Update imports in `src/features/crm/` (ClientList.tsx, ClientDetail.tsx, KanbanCard.tsx) to `@/shared/lib/formatters`.
- [x] Update any remaining `formatCurrency` imports in `src/features/quotes/` to `@/shared/lib/formatters`.
- [x] Remove `formatCurrency` export from `src/features/quotes/types.ts`.

**Verification:**
- `grep -r "from.*features/quotes/types.*formatCurrency" src/` returns no results.
- `npm test` passes (all existing tests green).

### Task 1.4 — Resolve `WorkshopSettings` type canonical ownership

- [x] Identify canonical `WorkshopSettings` read type. Per design decision, canonical location is `src/shared/api/workshopSettings.ts` (verify this file exists) or create `src/shared/types/workshopSettings.ts`.
- [x] Remove `WorkshopSettings` type export from `src/features/quotes/types.ts`.
- [x] Update imports in `src/features/recipes/` to reference the canonical shared location.
- [x] Update imports in `src/features/quotes/` to reference the canonical shared location.
- [x] Mutation-only types (`WorkshopSettingsInsert`, `WorkshopSettingsUpdate`) may remain in `src/features/settings/api/` — do NOT move them unless needed outside settings.

**Verification:**
- `grep -r "WorkshopSettings" src/features/quotes/types.ts` returns no type definition/export.
- Single canonical source exists for `WorkshopSettings` read type.
- `npm test` passes.

### Task 1.5 — PR1 commit and verification

- [ ] Commit as: `refactor(shared): extract formatCurrency and resolve WorkshopSettings type ownership`
- [x] Run `npm test` — all tests green.
- [x] Run `npm run lint` — passes with no new warnings.
- [x] Verify diff changed-line count ≤ 140.

**Rollback:** Revert the single commit. `formatCurrency` returns to `quotes/types.ts`; all imports restored. No database changes to reverse.

---

## Work Unit 2 — CI-Safe Boundary Guardrails (PR2)

**Goal:** Add ESLint `no-restricted-paths` rules that prevent new cross-feature imports, staged to cover cleaned scopes with documented temporary exceptions for dirty scopes. CI MUST stay green.

**TDD exception:** Configuration-only change. No runtime behavior. Document strict TDD exception per `openspec/config.yaml`.

**Forecast:** 2–4 files, 60–120 changed lines.

**Dependencies:** None (can parallel PR1).

### Task 2.1 — Verify or install `eslint-plugin-import`

- [ ] Check if `eslint-plugin-import` is already in `package.json` dependencies.
- [ ] If not installed, run `npm install -D eslint-plugin-import`.
- [ ] Verify the plugin loads in the existing ESLint config (flat config or `.eslintrc`).

**Verification:**
- `npx eslint --print-config src/app/App.tsx | grep import` shows plugin active.
- `npm run lint` still passes (no config breakage).

### Task 2.2 — Add `no-restricted-paths` rule configuration

- [ ] In the ESLint config file, add `import/no-restricted-paths` zones:
  - **Zone: feature isolation** — `src/features/` cannot import from other `src/features/` subdirectories (except self).
  - **Exception: cleaned shared imports** — features may import from `src/shared/`.
  - **Temporary exceptions** for dirty scopes that are NOT yet cleaned:
    - `quotes → crm` (bidirectional, deferred to WU5)
    - `quotes → recipes` (deferred to WU5)
    - `dashboard → quotes` (deferred to WU3)
    - `dashboard → inventory` (deferred to WU3)
    - `settings → billing` (deferred to WU4)
    - `settings → onboarding` (deferred to WU4)
    - `onboarding → settings` (deferred to WU4)
    - `onboarding → inventory` (deferred to WU4)
    - `recipes → inventory` (deferred to WU5)
    - `recipes → settings` (deferred to WU5)
    - `recipes → quotes` (deferred to WU5)
    - `crm → quotes` (deferred to WU5)
    - `inventory → quotes` (deferred to WU5)
  - Each exception must include a code comment: `// SDD8 temp exception — remove after <WU#> completion`
- [ ] **Critical:** Run `npm run lint` after configuration. It MUST pass. If it fails, adjust exceptions until green.

**Verification:**
- `npm run lint` exits 0.
- ESLint config has `no-restricted-paths` zones with documented exceptions.
- A manual test: adding a fake `import { X } from '@/features/crm/...'` in `src/features/quotes/` triggers a lint error (for the non-excepted pairs).

### Task 2.3 — Update AGENTS.md with import boundary documentation

- [ ] Add a section to `AGENTS.md` documenting the target import model:
  ```
  src/app/**                  → may compose multiple features
  src/features/<feature>/**   → may import self and src/shared/** only
  src/shared/**               → must not import src/features/**
  ```
- [ ] Reference `eslint-plugin-import` `no-restricted-paths` as the enforcement mechanism.
- [ ] Note that temporary exceptions exist and link to this SDD8 change.

**Verification:**
- AGENTS.md contains the import model documentation.
- `npm run lint` still passes.

### Task 2.4 — PR2 commit and verification

- [ ] Commit as: `chore(lint): add feature-sliced import boundary rules with SDD8 staged exceptions`
- [ ] Run `npm test` — all tests green.
- [ ] Run `npm run lint` — exits 0.
- [ ] Verify diff changed-line count ≤ 120.

**Rollback:** Remove the `no-restricted-paths` rule and exception entries from ESLint config. Revert AGENTS.md additions. Config-only change, no runtime impact.

---

## Work Unit 3 — Dashboard Composition (PR3) ⚠️ REQUIRES APPROVAL

**Goal:** Move dashboard data orchestration to an app/route composition seam. Dashboard components receive data and callbacks as props instead of importing from quotes/inventory features directly.

**TDD note:** This refactor changes component interfaces (props injection). Per strict TDD rules:
- Write RED tests for new prop contracts first.
- Implement GREEN changes to satisfy the contract.
- Refactor keeping tests green.

**Forecast:** 6–10 files, 180–300 changed lines.

**Dependencies:** PR1 (WU1) must be merged first. Requires explicit user approval before starting.

### Task 3.1 — Define dashboard component prop contracts

- [ ] Identify data dependencies of each dashboard component:
  - `Dashboard.tsx` — which quote/inventory data does it consume?
  - `StatusPieChart.tsx` — what props does it need?
  - `KPICards.tsx` — what props does it need?
  - `ActiveQuotesPanel.tsx` — what props does it need?
  - `useDashboardStats.ts` — does this hook move to the composition seam or stay local?
- [ ] Define TypeScript interfaces for each component's props.
- [ ] Place shared dashboard contracts in `src/features/dashboard/types.ts` or `src/shared/types/dashboard.ts`.

**Verification:**
- Type interfaces exist and document each component's data requirements.

### Task 3.2 — Write RED tests for new prop contracts

- [ ] Write failing tests for each dashboard component that verify rendering with injected props (no direct feature imports).
- [ ] Use Testing Library React to render components with mock prop data.
- [ ] Tests MUST fail before implementation (RED phase).

**Verification:**
- `npm test -- tests/features/dashboard/` shows expected failures for new prop-based tests.

### Task 3.3 — Implement composition seam (GREEN phase)

- [ ] Create or update the dashboard route/page composition wrapper (likely in `src/app/` or `src/pages/`).
- [ ] The wrapper gathers data using quote/inventory hooks and passes data as props to dashboard components.
- [ ] Refactor dashboard components to accept props instead of importing from quotes/inventory.
- [ ] Remove cross-feature imports from `src/features/dashboard/`:
  - No imports from `src/features/quotes/`.
  - No imports from `src/features/inventory/`.
- [ ] Dashboard components may import from `src/shared/` and dashboard-local files only.

**Verification:**
- `npm test` passes (including new prop contract tests).
- `grep -r "from.*@/features/quotes" src/features/dashboard/` returns no results.
- `grep -r "from.*@/features/inventory" src/features/dashboard/` returns no results.

### Task 3.4 — Remove dashboard exceptions from ESLint boundary rules

- [ ] Remove temporary ESLint exceptions for `dashboard → quotes` and `dashboard → inventory`.
- [ ] `npm run lint` must still pass.

**Verification:**
- `npm run lint` exits 0.
- The ESLint config no longer has dashboard-related exceptions.

### Task 3.5 — Manual smoke test

- [ ] Dashboard page renders with real data (quote stats, inventory stats, KPIs).
- [ ] No visual regressions or missing data.

### Task 3.6 — PR3 commit and verification

- [ ] Commit(s) follow TDD story: RED test → GREEN implementation → REFACTOR.
- [ ] Run `npm test` — all tests green.
- [ ] Run `npm run lint` — exits 0.
- [ ] Verify diff changed-line count ≤ 300.
- [ ] PR description states: depends on PR1, out-of-scope items, rollback plan.

**Rollback:** Revert PR3. Dashboard returns to direct hook imports. No data model changes to reverse.

**Gate:** Do NOT start PR3 until the dashboard composition pattern is approved by the user.

---

## Work Unit 4 — Settings/Onboarding Composition (PR4) ⚠️ REQUIRES APPROVAL

**Goal:** Replace direct settings imports of billing/onboarding features with props/slot injection at an app/page composition seam.

**TDD note:** Component interface changes require RED → GREEN → REFACTOR.

**Forecast:** 5–9 files, 180–320 changed lines.

**Dependencies:** PR1 (WU1) must be merged first. Requires explicit user approval before starting.

### Task 4.1 — Define settings component prop/slot contracts

- [ ] Identify cross-feature dependencies in settings:
  - `WorkshopSettings.tsx` imports `BillingSettingsCard` and `useSubscription` from billing.
  - `WorkshopSettings.tsx` imports `useResetOnboarding` from onboarding.
- [ ] Define prop types for optional slots/actions:
  - `billingSlot?: React.ReactNode` (or similar pattern).
  - `onResetOnboarding?: () => void` (callback pattern).
- [ ] Identify onboarding's dependencies on settings/inventory:
  - `OnboardingWizard.tsx` imports `useUpsertWorkshopSettings` from settings.
  - `OnboardingWizard.tsx` and `seedMaterials.ts` import from inventory.

**Verification:**
- Type interfaces exist for settings slots and onboarding callbacks.

### Task 4.2 — Write RED tests for new prop/slot contracts

- [ ] Write failing tests for `WorkshopSettings` that verify rendering with injected billing slot and onboarding reset callback.
- [ ] Write failing tests for `OnboardingWizard` that verify operation with injected settings/inventory callbacks.
- [ ] Tests MUST fail before implementation (RED phase).

**Verification:**
- `npm test` shows expected failures for new slot/callback tests.

### Task 4.3 — Implement settings composition seam (GREEN phase)

- [ ] Create or update the settings route/page composition wrapper.
- [ ] Wrapper injects `BillingSettingsCard`, `useSubscription` result, and `useResetOnboarding` into `WorkshopSettings` via props.
- [ ] `WorkshopSettings` no longer imports from `src/features/billing/` or `src/features/onboarding/`.
- [ ] For onboarding: create a composition seam that passes settings and inventory operations as callbacks.
- [ ] `OnboardingWizard` no longer imports from `src/features/settings/` or `src/features/inventory/`.

**Verification:**
- `npm test` passes (including new slot/callback tests).
- `grep -r "from.*@/features/billing" src/features/settings/` returns no results.
- `grep -r "from.*@/features/onboarding" src/features/settings/` returns no results.
- `grep -r "from.*@/features/settings" src/features/onboarding/` returns no results (if scope allows).

### Task 4.4 — Remove settings/onboarding exceptions from ESLint boundary rules

- [ ] Remove temporary ESLint exceptions for `settings → billing`, `settings → onboarding`, `onboarding → settings`, `onboarding → inventory`.
- [ ] `npm run lint` must still pass.

**Verification:**
- `npm run lint` exits 0.

### Task 4.5 — Manual smoke test

- [ ] Settings page renders with billing card and onboarding reset action.
- [ ] Onboarding wizard still saves workshop settings and materials correctly.

### Task 4.6 — PR4 commit and verification

- [ ] Commit(s) follow TDD story: RED test → GREEN implementation → REFACTOR.
- [ ] Run `npm test` — all tests green.
- [ ] Run `npm run lint` — exits 0.
- [ ] Verify diff changed-line count ≤ 320.
- [ ] If >320 lines, split PR4 into two stacked PRs (settings composition first, then onboarding).
- [ ] PR description states: depends on PR1, out-of-scope items, rollback plan.

**Rollback:** Revert PR4. Settings and onboarding return to direct imports. No data model changes.

**Gate:** Do NOT start PR4 until the settings/onboarding composition pattern is approved by the user. If PR4 line count approaches 400, request approval to split.

---

## Work Unit 5 — Core Coupling Architecture Decision (Deferred)

**Goal:** Record the follow-up architecture plan for quotes/CRM/recipes/inventory coupling. This is documentation only — no implementation.

**No PR.** This is an OpenSpec update.

### Task 5.1 — Record deferred architecture decision

- [ ] Update `design.md` (or create `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/decisions/core-coupling.md`) with:
  - Decision: Defer quotes/CRM/recipes/inventory decoupling to a separate SDD/change.
  - Rationale: Bidirectional coupling, domain-heavy, mechanical cleanup risks behavior changes and oversized diffs.
  - Rejected approaches: Event bus, shared global state (adds runtime behavior without product need).
  - Recommended follow-up: App-level orchestration using feature public APIs, shared domain contracts, or a dedicated workflow module.
  - Remaining ESLint exceptions to resolve in the follow-up SDD.

**Verification:**
- Decision document exists with rationale and follow-up plan.
- No code changes are made.

---

## Dependency Summary

```
WU1 ──┬──→ WU3 (dashboard composition)     [requires approval]
      └──→ WU4 (settings/onboarding)        [requires approval]

WU2 (lint guardrails)                        [independent, can parallel WU1]

WU5 (core coupling decision)                 [documentation only, independent]
```

## Explicit Approval Required Before Apply

| Decision | Required for | Default |
|----------|-------------|---------|
| Start WU1 + WU2 | PR1, PR2 | Yes — safe to proceed after tasks.md review |
| Start WU3 (dashboard composition) | PR3 | No — requires explicit approval of props injection pattern |
| Start WU4 (settings/onboarding composition) | PR4 | No — requires explicit approval of slots/actions pattern |
| Split PR4 if >320 lines | PR4 | Ask on risk |
| Approve core coupling approach for follow-up | WU5/future SDD | Deferred — record decision only |

## What Requires Explicit Approval

- **WU1 + WU2** may begin immediately after tasks.md review — they are low-risk structural/config changes.
- **WU3** must NOT begin until the dashboard props-injection pattern is approved and PR1 is merged.
- **WU4** must NOT begin until the settings/onboarding slots pattern is approved and PR1 is merged.
- **WU5** is documentation only — no approval needed beyond tasks.md review.
- If any PR approaches 400 changed lines, pause and request a size-exception decision before merging.

## Verification Per PR

| PR | `npm test` | `npm run lint` | Manual check | Diff ≤ budget |
|----|-----------|----------------|-------------|---------------|
| PR1 | ✅ green | ✅ pass | formatCurrency output unchanged | ≤ 140 lines |
| PR2 | ✅ green | ✅ pass | lint fails on new cross-feature import | ≤ 120 lines |
| PR3 | ✅ green | ✅ pass | Dashboard renders with real data | ≤ 300 lines |
| PR4 | ✅ green | ✅ pass | Settings + onboarding flow intact | ≤ 320 lines |
