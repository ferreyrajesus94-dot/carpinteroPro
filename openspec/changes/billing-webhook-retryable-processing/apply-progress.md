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

## Next recommended

`parent-lifecycle`
