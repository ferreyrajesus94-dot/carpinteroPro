# SDD-7 Design — Business-Critical E2E

## status

**design_complete**

## executive_summary

Proceed with a chained delivery. **PR 1 should establish the Playwright/Supabase test harness and cover exactly one business-critical slice: active-trial billing access in a real browser plus subscription-state persistence through an authenticated Supabase client.** This keeps the first review under the approved 400 changed-line budget while proving the two hardest foundations: browser auth/session/workshop context and real database-backed billing state.

## Decisions

| Topic | Decision |
| --- | --- |
| E2E framework | Use `@playwright/test` with TypeScript config. No blocking project constraint was found. |
| Playwright config | Add root `playwright.config.ts`; `testDir: "tests/e2e"`; Chromium project only for PR 1; `baseURL` from `E2E_BASE_URL` with default `http://localhost:5173`; use Vite dev server via Playwright `webServer`. |
| npm scripts | Add separate scripts: `test:e2e`, `test:e2e:ui`, `test:e2e:debug`. Keep `npm test` as `vitest run`. |
| Test layout | Use `tests/e2e/browser/` for UI journeys, `tests/e2e/integration/` for API/DB contracts run by Playwright, and minimal support files referenced from Node-only setup. |
| PR 1 critical browser contract | Active trial user logs in through `/login`, reaches the app shell, and can navigate to `/quotes` without billing redirection. |
| PR 1 integration contract | Subscription state changed by server-side fixture setup is visible through the same anon/authenticated Supabase query path used by the billing gate, and `getBillingAccess` blocks when status becomes `past_due`. |
| Local vs staging Supabase | Default to **local Supabase via CLI** for PR 1 and CI. Staging/dedicated test project is a later opt-in only after the local suite is stable. Production credentials are never valid for this suite. |
| Fixtures/setup/teardown | Use deterministic test identities/workshops with `e2e_sdd7_` naming and stable UUID/email values. Setup/teardown run in Node only, before/after Playwright suites, and are idempotent. |
| Service-role safety | Browser code and Vite env receive only anon-key variables. Any privileged setup uses a Node-only helper or local Supabase CLI/admin path that is never bundled, never exposed via `VITE_*`, and never committed with secret values. |
| CI/runbook | PR 1 documents local startup, required env vars, single-test/debug commands, cleanup, and CI expectations. CI should fail fast when required local/test env vars are missing. |
| Existing tests | Vitest remains the fast unit/component layer; Playwright and integration tests run only through the new E2E scripts. |

## PR 1 design under 400 changed lines

**Recommended scope:** config + scripts + one browser spec + one integration spec + one small fixture helper + runbook reference.

Planned files:

| File | Purpose | Budget guidance |
| --- | --- | --- |
| `package.json` / lockfile | Add `@playwright/test` and E2E scripts. | Dependency noise expected; human-reviewed source changes remain small. |
| `playwright.config.ts` | Chromium, `tests/e2e`, `baseURL`, Vite `webServer`, trace/screenshot on failure. | Keep concise; no multi-browser matrix yet. |
| `tests/e2e/browser/billing-gate-active-trial.spec.ts` | RED/GREEN browser contract for active trial access. | One happy-path scenario only. |
| `tests/e2e/integration/subscription-state.spec.ts` | RED/GREEN real Supabase subscription state contract. | One state-transition scenario only. |
| `scripts/e2e/fixtures.ts` or equivalent Node-only helper | Idempotent seed/cleanup for users, profiles, workshops, subscriptions. | Centralize to avoid duplicating setup in tests. |
| `docs/testing/runbook.md` | Local and CI runbook. | Short checklist format. |
| `README.md` | Link to runbook only. | One short mention. |

Out of PR 1:

- Expired trial and `past_due` browser scenarios.
- MercadoPago webhook endpoint persistence.
- Billing settings UI coverage.
- Tenant-isolation multi-user regression.
- Inventory and quote journeys.
- Multi-browser/device matrix.

## Data flow

### Browser E2E flow — active trial access

1. Node-only fixture setup creates or resets:
   - workshop `e2e_sdd7_active_trial_workshop`,
   - confirmed auth user `e2e_sdd7_active_trial@example.invalid`,
   - profile linked to that workshop with `onboarded_at` set,
   - subscription row with `status = trialing` and `trial_ends_at` in the future.
2. Playwright opens `E2E_BASE_URL` and submits the login form with the seeded email/password.
3. Supabase Auth stores the browser session.
4. `AuthProvider` loads the profile/workshop context through the app’s typed Supabase client.
5. `useSubscription` queries `subscriptions` for the authenticated workshop.
6. `BillingGate` calls existing billing access logic and allows app-shell rendering.
7. Test asserts the app shell/nav is visible and `/quotes` remains accessible.
8. Teardown removes rows created for the `e2e_sdd7_` identities/workshops.

### Integration flow — subscription state persistence

1. Node-only fixture setup creates a test workshop/user/subscription.
2. Test signs in using anon-key/authenticated Supabase client semantics, not a service-role browser client.
3. Server-side fixture mutates that workshop subscription from active trial to `past_due`.
4. Test re-runs the subscription query path used by `fetchSubscription`/`useSubscription`.
5. Test passes the returned row into `getBillingAccess(now)`.
6. Expected result: queried status is `past_due`; access decision is `blocked`.
7. Teardown deletes all test rows.

## Environment contract

PR 1 should document these variables without committing secret values:

| Variable | Context | Notes |
| --- | --- | --- |
| `E2E_BASE_URL` | Playwright | Defaults to `http://localhost:5173`. |
| `VITE_SUPABASE_URL` | Vite/browser | Local Supabase URL for app runtime. |
| `VITE_SUPABASE_ANON_KEY` | Vite/browser | Anon key only. |
| `E2E_SUPABASE_URL` | Node setup/tests | Same target as local Supabase. |
| `E2E_SUPABASE_ANON_KEY` | Node setup/tests | Used for authenticated client checks. |
| `E2E_SUPABASE_SERVICE_ROLE_KEY` or local admin equivalent | Node setup only | Allowed only in Node/CI secret scope; never `VITE_*`, never browser-accessible. |
| `E2E_TEST_PASSWORD` | Node + browser test input | Dedicated seeded-user password. |

Local Supabase is preferred because it gives deterministic cleanup, avoids shared staging pollution, and prevents accidental production access. CI should start or connect to the same local/test Supabase target before `npm run test:e2e`.

## Test contracts and strict TDD expectations

### PR 1 RED/GREEN/REFACTOR

- **RED:** Add the browser active-trial spec and integration subscription-state spec before completing the fixture implementation. The new `npm run test:e2e` should fail because the contracts cannot yet authenticate/query deterministic data.
- **GREEN:** Add the minimal Playwright config, scripts, fixture setup/teardown, and docs needed for those two tests to pass. Keep `npm test` green and separate from Playwright.
- **REFACTOR:** Remove duplication from specs into the helper only after both contracts are green. Do not broaden scenarios during refactor.
- **Structural exception:** Package/config/runbook changes are infrastructure, but PR 1 must still include the two failing-first test contracts before they are made green.

### Verification commands

```bash
npm test
npm run test:e2e
npm run test:e2e -- tests/e2e/browser/billing-gate-active-trial.spec.ts
npm run test:e2e:ui
npm run test:e2e:debug
```

## Follow-up PR plan

| PR | Scope | Planned high-level files |
| --- | --- | --- |
| PR 1 | Harness + active-trial browser access + subscription-state integration. | `package.json`, lockfile, `playwright.config.ts`, `tests/e2e/**`, `scripts/e2e/**`, `docs/testing/runbook.md`, `README.md`. |
| PR 2 | Billing/webhook/tenant regression coverage. Add expired trial and `past_due` browser cases, simulated MercadoPago webhook persistence, duplicate/invalid webhook behavior, and cross-tenant denial. | Additional `tests/e2e/browser/billing-gate-blocked.spec.ts`, `tests/e2e/integration/mercadopago-webhook.spec.ts`, `tests/e2e/integration/tenant-isolation.spec.ts`, fixture extensions, runbook updates. |
| PR 3 | Operational workflows. Add quote creation/contract/PDF surface and inventory stock movement/RPC tests if still needed and budget permits. | `tests/e2e/browser/quote-creation.spec.ts`, `tests/e2e/integration/inventory-stock-movement.spec.ts`, targeted fixture extensions. |

## Rollout and CI/runbook approach

1. Land PR 1 with Playwright installed but isolated from `npm test`.
2. CI adds a separate E2E job or optional gated step after the existing Vitest job.
3. The E2E job starts local Supabase/test services, validates required env vars, runs `npm run test:e2e`, and uploads Playwright traces/screenshots on failure.
4. Keep retries conservative: one CI retry is acceptable for diagnostics, but flaky tests must be fixed or quarantined in a follow-up issue rather than normalized.
5. Expand to PR 2 only after PR 1 is stable locally and in CI.

## Rollback plan

- Revert PR 1 to remove Playwright dependency, scripts, config, E2E specs, fixture helper, and runbook link.
- Delete any local/CI test data with the documented `e2e_sdd7_` cleanup command.
- Existing Vitest tests and app source behavior remain unaffected because PR 1 does not change production source code.
- If CI becomes unstable, disable only the E2E job while keeping `npm test` required.

## Review workload forecast

| PR | Forecast | Budget status |
| --- | ---: | --- |
| PR 1 | ~250–380 human-reviewed changed lines plus lockfile churn | Within 400 if scope stays narrow. |
| PR 2 | ~350–500 lines | Split if webhook + tenant fixtures exceed budget. |
| PR 3 | ~350–650 lines | Likely split quote and inventory if both grow. |

## Risks

| Risk | Mitigation |
| --- | --- |
| Local Supabase setup is slower than expected | Keep PR 1 runbook explicit; defer staging/dedicated project until needed. |
| Service-role leakage | Only Node setup may access privileged credentials; browser/Vite env remains anon-only. |
| E2E flakiness | Use seeded identities, URL assertions, role/text selectors, and Playwright auto-waiting; avoid arbitrary sleeps. |
| Review over budget | Do not add blocked billing, webhook, tenant, quote, or inventory scenarios to PR 1. |
| Fixture cleanup misses rows | Prefix/stable IDs plus teardown after each suite; document manual cleanup. |

## next_recommended

Proceed to **tasks**. Break PR 1 into work units that keep tests with the harness behavior they verify and preserve `npm test` as the existing fast suite.

## skill_resolution

**paths-injected** — loaded `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md` and `/home/elias/.config/opencode/skills/work-unit-commits/SKILL.md` before design work.
