# SDD-7 Explore: Business-Critical E2E Testing

## status

PASS — Evidence gathered. Proceed to proposal.

## executive_summary

CarpinteroPro has solid unit/component test coverage with Vitest, jsdom, and Testing Library, but no E2E framework, no real browser tests, and no integration tests against a real database. Critical business flows — authentication, billing gate enforcement, quote creation, inventory movements, MercadoPago webhook processing, and tenant isolation — are currently tested mostly in isolation with mocked dependencies. SDD 7 should proceed to proposal with a narrow, business-critical E2E/integration scope rather than attempting broad coverage.

## artifacts

- `openspec/changes/2026-06-02-sdd-7-business-critical-e2e/explore.md` — this explore artifact.
- `qa/sdd-7-explore-agent-output.md` — recovered subagent handoff summary.

## Current State

### Testing stack

| Area | Current state | Notes |
| --- | --- | --- |
| Test runner | Vitest 4 | `npm test` runs `vitest run`. |
| DOM environment | jsdom | Good for component tests; not real browser validation. |
| UI testing | Testing Library React/Jest-DOM | Current tests are unit/component level. |
| E2E framework | None | No Playwright, Cypress, or browser runner in `package.json`. |
| DB integration tests | None found | Supabase interactions are mocked in frontend tests. |
| Strict TDD | Active | Declared in `openspec/config.yaml`. |

### Existing coverage observed

Unit/component coverage exists for important isolated behavior, including:

- `src/shared/providers/AuthProvider.test.tsx` — auth/profile state transitions.
- `src/app/layouts/AppLayout.test.tsx` — app layout integration around auth/billing states.
- `src/features/billing/components/BillingGate.test.tsx` and billing access tests — subscription gate behavior with mocked data.
- `tests/features/quotes/calculator.test.ts` — quote cost calculations.
- `tests/features/quotes/contractRenderer.test.ts` — contract variable rendering.
- `tests/supabase/functions/billingHelpers.test.ts` — MercadoPago helper logic such as status mapping/signature validation.
- SDD 6-related shared tests for error reporting/support/error boundaries.

### App route/feature surface relevant to SDD 7

Business-critical routes/features include:

- Auth/session and onboarding flows.
- Dashboard shell and billing gate.
- Inventory/material management.
- Recipes/BOM/furniture templates.
- Quotes, contracts, and PDF generation.
- CRM/client data.
- Tasks.
- Settings/workshop configuration.
- Supabase Edge Functions for billing/MercadoPago.

## Business-Critical Flows

### 1. Auth/session/workshop context

**Journey:** login → session creation → profile loading → workshop context → app access/logout.

**Current coverage:** AuthProvider unit tests cover state transitions, but there is no full browser/session flow.

**Gap:** No E2E proof that a real user can authenticate, reload, keep the correct session/workshop context, and log out safely.

**Risk:** High — auth/profile regressions can block users or attach UI state to the wrong workshop.

### 2. Billing gate and subscription access

**Journey:** app load → subscription check → allow/block access → payment initiation.

**Current coverage:** billing access and gate component tests use mocked states.

**Gap:** No integration/E2E proof that real subscription rows, trial dates, webhook updates, and UI access decisions remain aligned.

**Risk:** Critical — revenue protection can fail by allowing unpaid access or blocking paid users.

### 3. Trial lifecycle

**Journey:** onboarding → trial start → trial expiry → blocked state → payment prompt.

**Current coverage:** isolated trial/access logic only.

**Gap:** No end-to-end verification for onboarding-triggered trial state or expiry behavior.

**Risk:** High — users may lose access too early or keep access after expiry.

### 4. Quote creation and contract/PDF flow

**Journey:** select/create recipe → add materials/labor/waste → calculate quote → render contract → generate PDF.

**Current coverage:** calculator and contract renderer are unit-tested separately.

**Gap:** No E2E test covering the real user journey and persistence path.

**Risk:** High — quotes are core business output; integration bugs can produce wrong customer-facing prices/contracts.

### 5. Inventory stock movement

**Journey:** create material → apply stock movement/RPC → verify stock level and movement log.

**Current coverage:** no integration test evidence found for real stock movement persistence/RPC behavior.

**Gap:** No real DB test for stock level changes or movement history.

**Risk:** Critical — incorrect stock data undermines operational trust.

### 6. Recipe/BOM management

**Journey:** create furniture template/recipe → add materials, labor, waste, cut pieces → calculate cost basis.

**Current coverage:** related cost logic appears isolated; full workflow coverage is missing.

**Gap:** No integration/E2E coverage for recipe creation and downstream quote usage.

**Risk:** Medium/high — cost basis errors cascade into quotes.

### 7. MercadoPago webhook processing

**Journey:** webhook event → signature verification → event classification → subscription update → billing gate reflects state.

**Current coverage:** helper-level tests for billing functions.

**Gap:** No integration proof that webhook processing updates real subscription state and UI access decisions.

**Risk:** Critical — paid users can remain blocked or stale payment state can persist.

### 8. Cross-tenant isolation regression

**Journey:** user/workshop A attempts to access user/workshop B data → RLS denies access.

**Current coverage:** SDD 1 hardened RLS and SQL policy direction exists.

**Gap:** No app-level/integration regression test tying authenticated client behavior to tenant isolation.

**Risk:** Critical — cross-tenant leakage is a trust and launch-blocking class of regression.

## Testing Gaps Summary

| Gap | Severity | Impact |
| --- | --- | --- |
| No E2E framework | Critical | Real user journeys are manually verified only. |
| No real browser tests | High | jsdom cannot catch browser/router/session behavior. |
| No DB integration tests | High | Supabase/RLS/RPC behavior can drift behind mocks. |
| Billing gate only tested with mocks | Critical | Revenue access decisions can regress in production. |
| Webhook flow lacks end-to-end persistence proof | Critical | Payment confirmations may not unblock users. |
| Quote workflow tested in fragments | High | Customer-facing quote/contract flow can break between components. |
| Inventory movements lack real DB tests | Critical | Stock numbers can become untrustworthy. |
| Tenant isolation lacks app-level regression test | Critical | SDD 1 security guarantees need guardrails against regression. |

## Recommendations

### Proceed to proposal

Proceed to SDD proposal for a business-critical E2E/integration test package.

### Recommended framework direction

Use **Playwright** for E2E browser testing unless proposal uncovers a stronger project-specific reason not to.

Rationale:

- Mature TypeScript-first E2E framework.
- Real browser execution for auth/session/router/UI flows.
- Good fit for CI and headed/headless local debugging.
- Compatible with a hybrid approach where Playwright covers journeys and Vitest remains for fast unit/component tests.

### Recommended test strategy

Use a hybrid strategy:

1. **Playwright E2E** for user journeys:
   - auth/session/logout;
   - onboarding/trial entry;
   - quote creation to contract/PDF surface;
   - billing gate states where browser UI matters.
2. **Integration tests** for real database/server behavior:
   - subscription state transitions;
   - MercadoPago webhook persistence;
   - inventory stock movement RPC;
   - tenant isolation with multiple authenticated users/workshops.
3. **Keep existing Vitest unit/component tests** for pure logic and component states.

### Priority recommendation

Initial SDD 7 scope should prioritize tests by production risk:

1. Billing gate/subscription state integration.
2. Auth/session/workshop context E2E.
3. MercadoPago webhook integration.
4. Inventory stock movement integration.
5. Quote creation E2E.
6. Trial lifecycle/onboarding E2E.
7. Cross-tenant isolation regression test.

## Scope and Non-Goals for Proposal

### Candidate scope

- Add Playwright test setup and scripts.
- Define deterministic test data setup/teardown.
- Add a small set of business-critical tests, not full product coverage.
- Document how to run locally and in CI.
- Keep strict TDD evidence for all new test infrastructure and behavior coverage.

### Non-goals

- 100% coverage.
- Visual regression testing.
- Performance/load testing.
- Full accessibility audit.
- Rewriting existing unit/component tests.
- Expanding product behavior beyond existing intended flows.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| E2E flakiness | Medium | Medium/high | Prefer deterministic waits, seeded data, minimal UI scope. |
| Test DB state pollution | Medium | High | Use isolated fixtures, cleanup helpers, and documented test identities. |
| Local Supabase/CI setup complexity | Medium | High | Proposal must choose local vs staging strategy explicitly. |
| MercadoPago dependency complexity | Medium | Medium/high | Prefer webhook simulation for core state transitions; sandbox only if needed. |
| Review workload over 400 changed lines | Medium | Medium | Split setup, integration helpers, and first flows into chained PRs if forecast exceeds budget. |

## next_recommended

Run SDD 7 proposal phase. The proposal should make these decisions explicit:

1. Playwright vs alternative framework.
2. Local Supabase vs staging/sandbox environment for integration tests.
3. Test data seeding and teardown model.
4. CI execution policy and expected runtime.
5. Exact first test flows to implement under the 400-line review budget.

## skill_resolution

paths-injected — parent provided `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md` to the explore subagent. The subagent lacked write tools, so the parent recovered and wrote this artifact from the subagent session output.
