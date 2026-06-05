# SDD-7 Proposal — Business-Critical E2E

## status

**proposal_complete**

## executive_summary

Proceed with SDD 7 as a narrow, chained business-critical testing package. CarpinteroPro already has useful Vitest/jsdom unit and component coverage, but it lacks browser E2E tests and real Supabase integration tests for the flows most likely to block launch confidence: auth/workshop context, billing access, webhook-driven subscription updates, inventory stock movements, quote creation, and tenant isolation. The first scope should establish a deterministic E2E/integration test foundation and cover only the highest-risk contracts rather than attempting broad product coverage.

## Intent

Add a small, maintainable business-critical regression suite that proves CarpinteroPro’s most important user and data-integrity flows work across real application boundaries.

The intended direction is hybrid:

- **Playwright** for real-browser journeys where routing, auth/session persistence, and UI state matter.
- **Integration tests** for Supabase/RLS/RPC/webhook behavior where mocked frontend tests cannot prove production contracts.
- Existing **Vitest + Testing Library** tests remain the fast unit/component layer.

## Problem

Current tests validate important pieces in isolation, but critical launch-risk behavior is still manually verified or mocked:

- Auth/profile/workshop context has no real browser/session regression test.
- Billing gate behavior is covered mostly with mocked subscription states.
- MercadoPago webhook helpers are unit-tested, but persistence and access-state effects are not proven end to end.
- Inventory stock movement/RPC behavior lacks real database regression coverage.
- Quote creation and contract/PDF surface are tested in fragments, not as a user journey.
- Cross-tenant isolation relies on prior RLS hardening without ongoing app/integration regression coverage.

Strict TDD is active in `openspec/config.yaml`; implementation phases must introduce failing tests/contracts before production changes and keep `npm test` green for the existing suite.

## Scope

### Included

1. **Test strategy and harness definition**
   - Introduce a deterministic E2E/integration testing approach for business-critical flows.
   - Prefer Playwright for browser coverage unless the spec/design phase finds a blocking project constraint.
   - Define test data setup/teardown and environment requirements before implementation.

2. **Narrow first business-critical coverage**
   - Prioritize these initial contracts:
     1. Billing/subscription access state integration.
     2. Auth/session/workshop context browser journey.
     3. MercadoPago webhook-to-subscription persistence integration.
     4. Cross-tenant/RLS denial regression.
   - Add quote creation and inventory stock movement only if the review forecast stays under budget; otherwise move them into follow-up chained PRs.

3. **Runbook and CI expectations**
   - Document local execution, required environment variables, seeded identities/data, cleanup model, and expected CI runtime.
   - Preserve current `npm test` behavior while defining any additional E2E/integration commands in spec/design.

### Non-goals

- 100% product coverage.
- Visual regression testing.
- Performance/load testing.
- Full accessibility audit.
- Rewriting existing unit/component tests.
- Changing product behavior beyond what is required to make tests deterministic and supportable.
- Using frontend service-role credentials or weakening tenant isolation for test convenience.

## Affected Areas and Candidate Files

| Area | Expected impact |
| --- | --- |
| `package.json` / lockfile | Possible Playwright dependency and scripts in apply phase. |
| `tests/` | New E2E/integration test structure, fixtures, setup, and cleanup helpers. |
| `playwright.config.*` | Browser test configuration if Playwright is confirmed in spec/design. |
| `src/shared/lib/supabase` | Read-only dependency for typed client behavior; no service-role exposure. |
| `src/features/billing/` | Billing gate/access surfaces and API contracts under test. |
| `src/features/auth` / app providers/layouts | Auth/session/workshop context surfaces under test. |
| `src/features/inventory/` | Candidate follow-up stock movement/RPC coverage. |
| `src/features/quotes/` | Candidate follow-up quote-to-contract journey coverage. |
| `supabase/functions/` | Webhook behavior under integration test; avoid broad function rewrites. |
| `supabase/migrations` / RLS policies | Only if tests expose a contract gap; no speculative policy changes. |
| `openspec/changes/2026-06-02-sdd-7-business-critical-e2e/` | SDD artifacts for proposal/spec/design/tasks. |

## Acceptance / Success Criteria

- [ ] The spec/design phase confirms the E2E framework choice, with Playwright as the default recommendation.
- [ ] Integration-test strategy identifies local Supabase vs staging/sandbox requirements and avoids service-role exposure in frontend code.
- [ ] Test data setup/teardown is deterministic and documented.
- [ ] At least one browser E2E journey proves auth/session/workshop context or billing gate behavior in a real browser.
- [ ] At least one integration test proves subscription/webhook persistence or billing access-state alignment against real Supabase behavior.
- [ ] At least one tenant-isolation regression proves cross-workshop access is denied through authenticated client behavior or migration-level assertions.
- [ ] Existing `npm test` remains green.
- [ ] Any new E2E/integration command is documented for local and CI use.
- [ ] Review chunks stay within the approved 400 changed-line budget or are split into chained PRs.

## Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| E2E flakiness | Medium | High | Prefer seeded data, deterministic waits, stable selectors, and a small first suite. |
| Test DB pollution | Medium | High | Use isolated fixtures, teardown helpers, and documented test identities/workshops. |
| Supabase environment complexity | Medium | High | Decide local vs staging in spec/design before implementation. |
| MercadoPago sandbox complexity | Medium | Medium/high | Simulate webhook payloads for persistence contracts first; sandbox can be follow-up. |
| Review scope exceeds budget | High | Medium | Use chained PRs: harness first, then critical flows. |
| Security shortcuts in tests | Low/medium | Critical | Never expose service-role keys in frontend; preserve RLS and project DB conventions. |

## Rollback

- Remove newly added E2E/integration dependencies, scripts, configs, and test fixtures.
- Delete generated test artifacts and seeded test data.
- Revert any product-code changes made only for testability if they are not required by existing unit tests.
- Keep existing Vitest unit/component tests and `npm test` behavior unaffected.

## Review Workload Forecast

Forecast: **600–1,000 changed lines** if Playwright setup, fixtures, Supabase integration helpers, CI/runbook docs, and multiple business flows are implemented together.

Recommended delivery: **chained PRs under the 400-line budget**.

1. **PR 1 — Harness + one critical contract**: Playwright/integration configuration, deterministic fixture model, docs, and one high-risk test target.
2. **PR 2 — Billing/webhook/tenant integration**: subscription state, webhook persistence, and cross-tenant denial coverage.
3. **PR 3 — Operational workflows**: inventory stock movement and quote creation journey if still needed after PRs 1–2.

The first implementation slice should stay narrow: establish the harness and prove either billing access or auth/workshop context before expanding coverage.

## artifacts

- `openspec/changes/2026-06-02-sdd-7-business-critical-e2e/explore.md` — source exploration findings.
- `openspec/changes/2026-06-02-sdd-7-business-critical-e2e/proposal.md` — this proposal.
- `qa/sdd-7-proposal-agent-output.md` — proposal-phase handoff output.

## next_recommended

Proceed to **spec**.

The spec phase should decide:

1. Final E2E framework choice, defaulting to Playwright.
2. Local Supabase vs staging/sandbox integration-test environment.
3. Test data seeding, cleanup, and identity/workshop isolation model.
4. Exact first test cases and file paths for PR 1.
5. CI policy, commands, and expected runtime.

## skill_resolution

**paths-injected** — loaded `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md` before writing.
