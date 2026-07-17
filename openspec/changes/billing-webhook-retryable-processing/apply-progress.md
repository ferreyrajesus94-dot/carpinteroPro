# Apply Progress: Retryable Billing Webhook Processing

## Slice 1 — schema and generated types (preserved)

**Status:** complete locally; additive schema/types only.

- Files: `20260715091948_billing_webhook_retryable_schema.sql`, `billing_webhook_retryable_schema.test.sql`, `src/shared/types/database.ts`, and six typed billing fixtures.
- Evidence: focused local pgTAP 24/24; local-only `npm test` 982 tests, coverage 73.94% lines / 66.67% branches / 63.92% functions / 72.87% statements, lint and build passed.
- Size: 173 additions, 0 deletions. Rollback before Slice 2 is limited to that additive migration/types and local reset; no remote operation occurred.

## Slice 2 — atomic RPC and local PostgREST proof

**Status:** complete locally. The seven Slice 2 implementation-owned checkboxes are persisted as `[x]` in `tasks.md`; Slice 1 is retained and Slice 3 was not started.

### Completed work

- Added `public.process_mercadopago_billing_event_v2(jsonb)` as `SECURITY INVOKER` with a pinned `pg_catalog` search path, server-derived subscription/workshop resolution, event-first/subscription-second locking, nested atomic effects, retryable durable error evidence, v1 enrichment, strict v2 retry, and exact service-role grants.
- Missing `providerSnapshotAt` for `payment` and `authorized_payment` now returns durable `uncertain/missing_provider_timestamp` without a subscription mutation even when no previous snapshot exists. The existing same-resource preapproval exception remains.
- pgTAP T15 proves that missing-timestamp behavior; a safe v1 enrichment followed by a forced commission conflict persists only v2 identity/retryable evidence, rolls back subscription/completion/new commission effects, and a corrected strict-v2 retry completes exactly once. It also proves service_role has no workshop/profile INSERT, UPDATE, or DELETE privileges while required RPC/table grants remain positive.
- The loopback-only PostgREST proof explicitly asserts `Promise.all` has one `completed/applied` result and one `duplicate/non-applied` result, then one event and one commission. Its conflict path explicitly reads the durable `retryable/local_failure` event before a corrected retry.

### TDD Cycle Evidence

| Task | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| Missing payment/authorized timestamp | Local pgTAP T15 failed: `missing payment timestamp mutated or was not durable uncertain`. | Narrowed the RPC freshness condition to allow only the bound same-resource preapproval exception. | Focused pgTAP passed 15/15. | Kept the conditional local to the existing freshness branch. |
| v1 side-effect rollback and privilege boundary | T15 was added before rerunning the RPC and exercises the forced nested commission conflict plus negative privilege assertions. | Existing subtransaction/strict-v2 path satisfied the proof after the test fixture corrected its intentional identity setup. | Focused pgTAP passed 15/15; local PostgREST passed 2/2. | Kept assertions in the owner SQL/Vitest files; no pgTAP concurrency duplication. |
| Local PostgREST concurrency and retryability | Extended the opt-in test before final gate execution. | Queries now assert durable retryable event evidence and exact same-event result roles. | Focused opt-in Vitest passed 2/2. | Fixtures remain local `supabase db query --local` setup/cleanup only; no production hook or grant. |

### Verification

- CLI/local runner discovery: `npx supabase --version` (2.109.1), `--help` for root/migration/test db/db lint/db advisors; imperative `schema_paths = []`; migration created with `npx supabase migration new process_mercadopago_billing_event_v2`.
- RED: `npx supabase db reset --local --no-seed && npx supabase test db --local supabase/tests/billing_webhook_retryable_rpc.test.sql` failed T15 before the freshness fix.
- GREEN/REFACTOR: local reset and `npx supabase test db --local supabase/tests/billing_webhook_retryable_rpc.test.sql` passed **15/15**.
- Opt-in local PostgREST: `RUN_LOCAL_SUPABASE_INTEGRATION=true E2E_SUPABASE_URL="$API_URL" E2E_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" npm test -- tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` passed **2/2**; credentials were read only from local `npx supabase status -o env` and the test rejects non-loopback URLs.
- Local-only project gates with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `NODE_OPTIONS=--localstorage-file=/tmp/carpinteropro-vitest-localstorage`: `npm test`, `npm run test:coverage`, `npm run lint`, and `npm run build` all passed. Coverage: lines **73.97%**, branches **66.71%**, functions **63.97%**, statements **72.89%**. Lint had 11 pre-existing/generated warnings only.
- `npx supabase db lint --local` and `npx supabase db advisors --local --fail-on none` completed with pre-existing unrelated warnings; no finding named the new RPC.

### Boundary, size, rollback, and deviations

- PR boundary: feature-branch-chain Slice 2 only — RPC migration, SQL proof, and local PostgREST proof. No handler/UI/Slice 3 change.
- Approved exception: `size:exception` up to **635 additions + deletions**. Final measured working diff: **475 additions + deletions**, below that ceiling.
- Rollback: remove `20260715101021_process_mercadopago_billing_event_v2.sql`, `supabase/tests/billing_webhook_retryable_rpc.test.sql`, and `tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts`; revert Slice 2 checkboxes/progress only; retain Slice 1.
- No commit, push, PR, deploy, linked/remote database operation, production fixture hook/grant, handler/UI edit, or Slice 3 work occurred.

## Remaining implementation work

- Slice 3: all five implementation rows remain unchecked; provider decoder/shared processor and fixtures are not started.
- Slice 4: all five implementation rows remain unchecked; webhook HTTP cutover/E2E is not started.
- Slice 5: all five implementation rows remain unchecked; admin reconciliation/diagnostics is not started.
- Deferred parent lifecycle actions remain byte-for-byte unchanged in `tasks.md`.

## Structured status consumed

- Native authoritative status: `artifactStore: openspec`, `applyState: ready`, `nextRecommended: apply`.
- `actionContext`: `repo-local`, workspace and allowed root `/home/elias/Projects/carpinteroPro`; no warning.
- Strict TDD: active (`npm test`). Delivery: approved feature-branch-chain Slice 2 with a `size:exception` ceiling of 635.

## Slice 3 — provider decoder, fixtures, and shared processor (forecast blocked)

**Status:** blocked before code or test edits by the Slice 3 hard 400-line review budget.

### Forecast and boundary

- Forecast before editing: **440–510 additions + deletions** (minimum 440), exceeding the hard <=400 target.
- Indivisible requested work-unit: the new shared decoder/processor (**190–230**), its dedicated decoder/diagnostic/RPC-mapping tests (**160–200**), conservative closed-status helper coverage/change (**15–25**), and replacement provider/fetch/RPC fixture contract (**45–55**). The tests and fixtures are required evidence for the processor and cannot be removed or deferred within the assigned Slice 3 boundary without leaving the behavior unproven.
- No production, test, fixture, task-checkbox, database, Git, or remote operation was performed. Slice 4 webhook routing and Slice 5 administration remain untouched.
- Required delivery decision: authorize an explicit `size:exception` for this indivisible Slice 3 work unit, or provide a newly approved split with separately owned task rows and PR boundaries.

### Inputs and status consumed

- Native authoritative status supplied by parent: `artifactStore: both` (OpenSpec canonical), `applyState: ready`, `nextRecommended: apply`; workspace and allowed edit root `/home/elias/Projects/carpinteroPro`.
- Strict TDD: active (`npm test`). Existing Slice 1–2 local SQL/RPC evidence remains preserved.
- Review forecast in `tasks.md`: decision needed `Yes`, chained PRs recommended `Yes`, chain strategy `feature-branch-chain`, risk `High`. Parent resolved the chain strategy and assigned Slice 3, but no explicit Slice 3 size exception was supplied.

## Slice 3 — provider decoder, fixtures, and shared processor (complete locally)

**Status:** complete locally under the user-approved Slice 3-only `size:exception` of **510 additions + deletions**. The prior forecast block is retained as decision history.

### Completed work

- Added `supabase/functions/_shared/mercadopago-webhook-processing.ts`: allowlisted MercadoPago resource decoding, strict ISO timestamp parsing, linkage/commission validation, conservative freshness classification, sanitized diagnostic emission, provider failure mapping, and RPC result mapping through injected fetch/RPC/logger dependencies.
- Updated `supabase/functions/_shared/billing.ts` so unknown/empty MercadoPago status returns `null` rather than silently mapping to `past_due`.
- Added unit coverage in `tests/supabase/functions/mercadopagoWebhookProcessing.test.ts`; updated helper expectations. It proves decoder primary/fallback/missing/malformed timestamps, linkage/commission facts, same/different-resource equal timestamps, provider 400/404/429/other-4xx/5xx classification, malformed-resource RPC suppression, RPC retryable mapping, and exact diagnostic allowlisting.
- Replaced the sequential fixture event-insert/subscription-update implementation with a local RPC fixture contract containing resource kind, linkage, snapshot/fetch times, and optional commission facts. The production webhook entry point was not imported or modified.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| Closed status mapping | `billingHelpers.test.ts` | Unit | Existing 21 tests passed; original focused command also discovered a stale `.git/gentle-ai/candidate-views` path and exited non-zero (infrastructure only). | Unknown/empty status assertions failed against `past_due`. | Focused suite passed. | Uppercase known status remains covered; unknown and empty take `null`. | Narrow return type retained; no fallback added. |
| Shared decoder/processor | `mercadopagoWebhookProcessing.test.ts` | Unit | N/A (new file) | Missing module plus changed helper expectations failed. | Focused suite passed 32/32 after minimal module. | Added freshness cases first; they failed with missing export, then passed 34/34 after conservative classifier. | Kept dependencies injected and diagnostics allowlisted; no entry wiring. |
| Fixture contract | `scripts/e2e/fixtures.ts` | Local RPC fixture | Existing E2E fixture is excluded from ordinary Vitest by config. | New processor tests establish the required provider/RPC contract. | Build compiles fixture RPC contract. | Slice 1–2 local pgTAP and local PostgREST evidence passed. | Removed the sequential insert/update sequence; retained no production route change. |

### Verification

- Focused RED: `npm test -- --exclude '.git/**' tests/supabase/functions/billingHelpers.test.ts tests/supabase/functions/mercadopagoWebhookProcessing.test.ts` failed as expected: missing processor module plus two closed-status assertions. Freshness triangulation then failed with `evaluateProviderFreshness is not a function` before implementation.
- Focused GREEN/TRIANGULATE/REFACTOR: same command passed **34/34**.
- Slice 1–2 local dependency checks: `npx supabase test db --local supabase/tests/billing_webhook_retryable_schema.test.sql` passed **24/24**; `npx supabase test db --local supabase/tests/billing_webhook_retryable_rpc.test.sql` passed **15/15**.
- Local PostgREST dependency check: with local-only values from `npx supabase status -o env`, `RUN_LOCAL_SUPABASE_INTEGRATION=true E2E_SUPABASE_URL="$API_URL" E2E_SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" npm test -- --exclude '.git/**' tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` passed **2/2**.
- Project gates, using local Supabase VITE values and `NODE_OPTIONS=--localstorage-file=/tmp/carpinteropro-vitest-localstorage`: `npm test -- --exclude '.git/**'` passed **995/995** with **1 skipped**; `npm run test:coverage -- --exclude '.git/**'` passed with lines **73.94%**, branches **66.71%**, functions **63.92%**, statements **72.87%**; `npm run lint` passed with 11 existing/generated warnings; `npm run build` passed after one test-only implicit-parameter type correction.

### Boundary, size, rollback, and status

- PR boundary: feature-branch-chain Slice 3 only (child after #111; tracker #109). Dependencies: Slice 1 schema → Slice 2 RPC → **Slice 3 processor/fixtures** → Slice 4 webhook adoption → Slice 5 admin reconciliation.
- Final measured working diff: **410 additions + deletions** (363 additions, 47 deletions), within the approved <=510 exception.
- Rollback: revert only `mercadopago-webhook-processing.ts`, `billing.ts`, the two Slice 3 test files/changes, and `scripts/e2e/fixtures.ts`; retain Slice 1–2 schema/RPC. Production traffic remains on the old entry point.
- No commit, stage, push, PR, deploy, Supabase link, remote mutation, production traffic change, `mercadopago-webhook/index.ts` edit, Slice 4 edit, or Slice 5 edit occurred.
- Structured status consumed: parent-authoritative `artifactStore: both`, `applyState: ready`, `nextRecommended: apply`, action context root `/home/elias/Projects/carpinteroPro`. Delivery decision: explicit Slice 3-only `size:exception` <=510 with mandatory parent-owned full 4R review afterward.

## Remaining implementation work

- Slice 4: all five implementation rows remain unchecked; webhook HTTP cutover/E2E is not started.
- Slice 5: all five implementation rows remain unchecked; admin reconciliation/diagnostics is not started.
- Parent lifecycle actions, including the mandatory bounded full 4R review, remain deferred and byte-for-byte unchanged in `tasks.md`.

## Slice 3 corrective rerun — gatekeeper gaps closed

**Status:** the one authorized corrective rerun completed locally; prior Slice 3 evidence is preserved above.

- `evaluateProviderFreshness` now allows a missing timestamp only when the resource is the same bound `preapproval`; missing `payment` and `authorized_payment` timestamps return `uncertain` and cannot enter a mutating path.
- Added an injected `resolveSubscription(providerPreapprovalId)` boundary before RPC. A missing subscription returns acknowledged `not_applicable/missing_subscription`, emits exactly one allowlisted correlated `subscription_resolution` diagnostic, and does not invoke RPC or create state.
- Corrective RED: focused Slice 3 tests failed for missing-timestamp payment behavior and missing-subscription RPC suppression. GREEN: focused tests passed **36/36** after the minimal implementation; prior primary/fallback/malformed/missing timestamp coverage remains intact.
- Required rerun evidence: local schema pgTAP **24/24**, local RPC pgTAP **15/15**, opt-in local PostgREST **2/2**, full Vitest **997 passed / 1 skipped**, coverage lines **73.94%** / branches **66.71%** / functions **63.92%** / statements **72.87%**, lint passed with 11 existing/generated warnings, and build passed. Full Node 26 gates used a fresh `mktemp` localstorage file; local credentials were never printed.
- The production webhook entry point and Slices 4–5 remain untouched. No commit, stage, push, PR, deploy, link, or remote mutation occurred.

## Next recommended

`parent-lifecycle`
