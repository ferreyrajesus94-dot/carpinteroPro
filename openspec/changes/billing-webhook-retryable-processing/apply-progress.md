# Apply Progress: Retryable Billing Webhook Processing

## Slice 1 — schema and generated types

**Status:** complete locally; ready for parent lifecycle. This is only the first `feature-branch-chain` work unit. No Slice 2 work was started.

### Completed implementation tasks

- `[x]` RED schema pgTAP proof
- `[x]` GREEN additive migration and database types
- `[x]` TRIANGULATE local catalog/schema proof and project gates
- `[x]` REFACTOR/reverification
- `[x]` Slice 1 boundary recorded

The matching Slice 1 implementation checkboxes were persisted in `tasks.md`. Parent-owned lifecycle rows are unchanged and deferred.

### Files changed

- `supabase/migrations/20260715091948_billing_webhook_retryable_schema.sql`
- `supabase/tests/billing_webhook_retryable_schema.test.sql`
- `src/shared/types/database.ts`
- Typed `SubscriptionRow` fixtures updated to represent the additive nullable subscription columns:
  - `src/features/billing/components/BillingBlockedScreen.test.tsx`
  - `src/features/billing/components/BillingGate.test.tsx`
  - `src/features/billing/components/BillingSettingsCard.test.tsx`
  - `src/features/billing/hooks/useSubscription.test.ts`
  - `src/features/billing/lib/access.test.ts`
  - `src/shared/lib/mockData.ts`

### TDD Cycle Evidence

| Task | Test file/layer | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|
| Slice 1 schema contract | `supabase/tests/billing_webhook_retryable_schema.test.sql` / local pgTAP | Local-only safe isolation: temporarily moved the untracked migration, ran `npx supabase db reset --local --no-seed`, then `npx supabase test db --local supabase/tests/billing_webhook_retryable_schema.test.sql`; 20 of 24 assertions failed because additive columns/index were absent. | Restored the same migration, reset locally, and the focused pgTAP file passed all 24 assertions. | Fresh local reset plus focused pgTAP verified defaults, constrained outcome vocabulary, operational index, subscription freshness columns, ownership FK/cascade, and RLS. | No redundant schema/type contract edits remained; reran focused pgTAP and all project gates. |
| Generated type fixture compatibility | TypeScript compilation plus five focused billing Vitest files | `npm run build` initially failed on six typed `SubscriptionRow` fixtures after the required non-optional Row fields were added. | Added `null` values for the four nullable subscription freshness fields to the affected fixtures; `npm run build` passed. | `npm test --` against five billing files passed 49 tests; complete local-only `npm test` passed 982 tests. | Mechanical fixture alignment only; no behavior or schema contract changed. |

### Verification evidence

- CLI discovery, from repository root: `npx supabase --help`, `npx supabase db --help`, `npx supabase test --help`, `npx supabase test db --help`, `npx supabase migration --help`, `npx supabase db reset --help`, `npx supabase migration up --help`, `npx supabase db advisors --help`, and `npx supabase db lint --help`.
- Discovered focused local command: `npx supabase test db --local supabase/tests/billing_webhook_retryable_schema.test.sql`.
- Local-only resets used `npx supabase db reset --local --no-seed`; no `--linked`, remote URL, remote mutation, push, PR, deployment, or commit was used.
- Focused pgTAP: PASS, 24/24 assertions.
- Local schema lint: completed with pre-existing warnings in unrelated production functions.
- Local database advisors: completed; findings are pre-existing unrelated RLS/function-search-path warnings, with no new Slice 1 finding.
- `npm test`: initial bare invocation failed because the shell lacked local Vite Supabase environment values and Node localStorage backing. Rerun with local-only `VITE_SUPABASE_URL`, local anon key from `npx supabase status -o env`, and `NODE_OPTIONS=--localstorage-file=/tmp/carpinteropro-vitest-localstorage`: PASS, 122 files / 982 tests.
- `npm run test:coverage`: same local-only environment: PASS, 122 files / 982 tests; lines 73.94%, branches 66.67%, functions 63.92%, statements 72.87%.
- `npm run lint`: PASS with existing warnings only (five React Hook Form compiler warnings; coverage-report lint warnings after coverage generation).
- `npm run build`: PASS after fixture alignment.

### Scope, size, rollback, and deviations

- PR boundary: Slice 1 only — additive schema contract, generated types, schema proof, and required typed fixture alignment.
- Measured implementation diff: **173 additions, 0 deletions** (37 migration + 52 pgTAP + 60 generated database types + 24 fixture fields). This is under the 400-line budget.
- Rollback before Slice 2: revert/delete only `20260715091948_billing_webhook_retryable_schema.sql`, restore the prior `database.ts` and fixture shape, and reset/apply the **local** stack as needed. Do not drop data-bearing columns from any deployed environment.
- Deviation: the design named `database.ts` as the Slice 1 type file. The generated Row contract correctly made the four nullable subscription columns required keys, so six existing typed test/mock fixtures needed `null` fields to keep the existing app buildable. No runtime behavior, RPC, handler, RLS policy, or Slice 2 work was changed.
- A second untracked migration (`20260715093242_billing_webhook_retryable_schema.sql`) appeared during the recovery reset. It was byte-identical to the designated valid `20260715091948` migration and caused duplicate schema application. It was removed as redundant; the designated migration remains and local migration history ends at `20260715091948`.
- No prior apply-progress artifact existed in OpenSpec. Engram retrieval for the prior apply-progress was attempted but the Engram HTTP provider was unavailable.

### Structured status consumed

- Native status: `artifactStore: openspec`, `applyState: ready`, `nextRecommended: apply`.
- `actionContext`: `repo-local`; workspace root and allowed edit root were `/home/elias/Projects/carpinteroPro`.
- Workload decision: resolved as the assigned `feature-branch-chain` Slice 1 work unit; no size exception was used.
- Strict TDD: active, test runner `npm test`.

## Remaining tasks

- [ ] RED: CREATE `supabase/tests/billing_webhook_retryable_rpc.test.sql` following the repository's `*.test.sql` convention, with SQL/pgTAP-only failing tests for rollback/durable retry, successful retry, completed duplicate, same-event concurrency, same-subscription ordering, stale/identity validation, commission conflict, v1 enrichment/strict-v2 retry, all legacy no-mutation cases, exact grants/RLS/invoker privileges, and required service-role table privileges; include before/after snapshots for byte-for-byte legacy cases and capture failures locally. Do not place Supabase-js or PostgREST client code in this SQL file. <!-- sdd-owner: implementation -->
- [ ] RED: CREATE new `tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` and its absent parent directory with a Vitest/local integration proof gated by `RUN_LOCAL_SUPABASE_INTEGRATION=true`: ordinary `npm test` skips it with a clear reason; `RUN_LOCAL_SUPABASE_INTEGRATION=true npm test -- tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` enables it and fails actionably when `E2E_SUPABASE_URL`/`E2E_SUPABASE_SERVICE_ROLE_KEY` are absent or the URL is non-loopback. No remote fallback; prove committed success and durable retryable rollback through real Supabase-js RPC. <!-- sdd-owner: implementation -->
- [ ] GREEN: implement `public.process_mercadopago_billing_event_v2(jsonb)` in `supabase/migrations/<CLI-generated timestamp>_process_mercadopago_billing_event_v2.sql` only after help discovery proves the migration workflow; implement event-first then subscription locking, strict identity/freshness rules, nested atomic side effects, durable retryable error evidence, v1 eligibility/enrichment, commission conflict verification, and exact `REVOKE`/`GRANT` plus invoker/search-path posture. <!-- sdd-owner: implementation -->
- [ ] GREEN: implement the local PostgREST proof in `tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` with `createClient(localPostgrestUrl, localServiceRoleKey)`, actionable local-stack prerequisite failures, and no remote credential or URL substitution; keep all SQL/pgTAP assertions in `supabase/tests/billing_webhook_retryable_rpc.test.sql`. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: from the repository root, first discover the supported Supabase SQL-test runner and flags with `supabase --help`, the relevant `supabase db --help`, and any relevant group help; bind the selected invocation to the local project at `supabase/config.toml`, and do not guess a SQL subcommand or flags. Run that discovered local-only SQL command separately from ordinary `npm test` and the opt-in focused Vitest command `RUN_LOCAL_SUPABASE_INTEGRATION=true npm test -- tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts`; keep the PostgREST proof local-only with no remote fallback. Use no linked/remote fallback, run available local advisors and all project gates, and verify no `SECURITY DEFINER`, no PUBLIC/anon/authenticated execute, required service-role table privileges only, RLS posture, concurrency outcomes, committed success, and durable retryable rollback. Record exact help discovery, local config binding, commands, evidence, and changed-line count in apply-progress. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: simplify SQL and integration setup while preserving lock order, subtransaction boundary, immutable identity rules, local-only client configuration, and legacy byte-for-byte no-mutation behavior; rerun the focused SQL command, `npm test`, focused Vitest, and all project gates. If measured Slice 2 additions+deletions exceed 400, stop and request an explicit conditional `size:exception` before further implementation; the exception may cover only the indivisible RPC plus minimum SQL safety proof, never unrelated integration-test growth. <!-- sdd-owner: implementation -->
- [ ] Record the Slice 2 boundary, dependency on Slice 1, rollback procedure for the migration and both proof files, measured line count, and either the approved conditional `size:exception` record or under-budget evidence; local branch and commit creation is authorized for this feature-branch-chain, but do not push, create a PR, deploy, or mutate a remote database. <!-- sdd-owner: implementation -->
- [ ] RED: add failing tests in `tests/supabase/functions/billingHelpers.test.ts` and CREATE new `tests/supabase/functions/mercadopagoWebhookProcessing.test.ts` for closed status mapping, all primary/fallback/missing/malformed timestamp cases, equal-resource ordering, unknown status, linkage, commission facts, provider 400/404/429/other-4xx/5xx, malformed resources (retryable `invalid_provider_resource`, 502, no RPC), RPC result mapping, and sanitized logger allowlisting/correlation/forbidden-field removal; update `scripts/e2e/fixtures.ts` tests/contracts to fail against the sequential fixture behavior. <!-- sdd-owner: implementation -->
- [ ] GREEN: implement `supabase/functions/_shared/mercadopago-webhook-processing.ts` with allowlisted resource interfaces/type guards, strict ISO parsing, provider-fetch abstraction, tenant-resolution boundary, diagnostic logger seam, RPC invocation, and HTTP result mapping; update `supabase/functions/_shared/billing.ts` to remove unknown-to-`past_due` fallback; replace the sequential `simulateMercadoPagoWebhook` behavior in `scripts/e2e/fixtures.ts` with provider/fetch/RPC fixture inputs and commission facts. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run focused Vitest files, the local supported Supabase SQL/RPC evidence from Slices 1–2 as a dependency check, and all four project gates; prove no RPC call before tenant resolution, no raw provider/error/credential logging, generated correlation IDs, conservative freshness, and fixture compatibility. Record evidence and changed-line count in apply-progress. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove casts and duplicate mapping logic without broadening accepted provider keys/statuses, rerun focused tests and all project gates, and confirm the shared processor is not yet wired to production traffic. <!-- sdd-owner: implementation -->
- [ ] Record the Slice 3 commit/PR candidate, rollback boundary, dependency graph, verification results, and prohibited remote operations in apply-progress; local feature-branch and commit creation is authorized, while push, PR creation, deployment, and remote database mutation remain forbidden. <!-- sdd-owner: implementation -->
- [ ] RED: CREATE new failing entry test file `tests/supabase/functions/mercadopagoWebhook.test.ts` for fetch-before-RPC, retryable non-2xx, exact correlation header, and exclusive invalid-signature/payload/topic/provider-400/404/429/other-4xx/5xx/malformed-resource/missing-subscription cases with exactly one sanitized log and no RPC call; assert 429 → 503 with safe `Retry-After`, other 4xx → 502, and malformed resource → retryable `invalid_provider_resource` 502 with no event/tenant mutation. <!-- sdd-owner: implementation -->
- [ ] GREEN: atomically cut over `supabase/functions/mercadopago-webhook/index.ts` to validate then invoke the Slice 3 shared processor, remove sequential billing writes, and update `supabase/functions/mercadopago-webhook/commissions.ts` to retain only pure helpers or remove runtime commission writes; do not add a fallback branch to the old handler. <!-- sdd-owner: implementation -->
- [ ] GREEN: make `tests/e2e/integration/mercadopago-webhook.spec.ts` use the Slice 3 fixtures and a local service-role database client to verify durable event/subscription/commission effects, non-2xx retry semantics, completed duplicate no-op, stale protection, at-most-one commission, and no tenant state for pre-tenant failures. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run focused webhook Vitest, focused Playwright `tests/e2e/integration/mercadopago-webhook.spec.ts`, the supported local SQL/RPC checks, and `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`; capture HTTP/status/header/log/database evidence and changed-line count in apply-progress. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove dead sequential paths and duplicated entry assertions without weakening atomic cutover or diagnostics, rerun focused Playwright/Vitest and all project gates, and confirm rollback remains fail-closed. <!-- sdd-owner: implementation -->
- [ ] Record the Slice 4 commit/PR candidate and explicit dependency on the validated Slice 3 processor; local feature-branch and commit creation is authorized, but do not push, create a PR, deploy, or mutate a remote database. <!-- sdd-owner: implementation -->
- [ ] RED: CREATE new failing test file `tests/supabase/functions/adminRetryWebhook.test.ts` for unauthorized no-op and exact eligible enrichment/completion, post-enrichment failure then strict-v2 retry, non-NULL mismatch, unsupported/ineligible resource, NULL/empty resource ID, and cross-workshop rejection with byte-for-byte event/billing snapshots; CREATE new failing tenant-only visibility test file `tests/supabase/functions/adminSupportDiagnostics.test.ts` with no platform-log reader/query field. <!-- sdd-owner: implementation -->
- [ ] GREEN: implement `supabase/functions/admin-retry-webhook/index.ts` with `requirePlatformAdmin`, original-event lookup, eligibility checks, fresh provider fetch, same shared processor/RPC path, reconciliation audit context, and no synthetic `admin.retry` row; implement `supabase/functions/admin-support-diagnostics/index.ts` to expose only tenant-resolved outcomes and reconciliation context. <!-- sdd-owner: implementation -->
- [ ] TRIANGULATE: run focused admin Vitest, focused Playwright/database reconciliation evidence as available, the supported local SQL/RPC checks, and all four project gates; prove real processing, exact workshop/identity matching, no mutation for ineligible cases, no platform-log exposure, and no remote mutation. Record all results and changed-line count in apply-progress. <!-- sdd-owner: implementation -->
- [ ] REFACTOR: remove duplicated eligibility/diagnostic mapping while preserving `requirePlatformAdmin`, fresh-state ordering, auditability, and byte-for-byte no-mutation guarantees; rerun focused tests and all project gates, and confirm no remote mutation. <!-- sdd-owner: implementation -->
- [ ] Record the Slice 5 terminal work-unit boundary, complete ordered-chain verification, rollback evidence, and remaining operational rollout notes; local feature-branch and commit creation is authorized, but do not push, create a PR, deploy, or mutate a remote database. <!-- sdd-owner: implementation -->
- [ ] Start or reuse the bounded post-apply review only after an approved slice is applied, with the exact slice scope and its recorded evidence; do not treat planning as review approval. <!-- sdd-owner: parent -->
- [ ] Validate the existing content-bound review receipt at lifecycle gates; never create a new review budget at pre-commit, pre-push, or pre-PR. <!-- sdd-owner: parent -->
- [ ] Approve only the next dependency-ready slice under `auto-forecast`; local feature-branch and commit creation is authorized under `feature-branch-chain`, while push, PR creation, deployment, and remote database mutation remain forbidden. <!-- sdd-owner: parent -->

## Deferred parent lifecycle actions

- Parent must start/reuse bounded post-apply review for this exact Slice 1 scope.
- Parent owns receipt validation and approval of the next dependency-ready slice.

## Next recommended

`parent-lifecycle`
