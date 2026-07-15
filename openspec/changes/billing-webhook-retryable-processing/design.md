# Technical Design: Retryable Billing Webhook Processing

## 1. Objective and constraints

This design fixes the billing integrity failure without adding a queue, worker, lease, polling loop, or retry SLA. MercadoPago I/O and normalization remain outside PostgreSQL. One short PostgreSQL RPC is the local correctness boundary for a tenant-resolved event row, subscription mutation, and optional referral commission.

The design preserves these project and proposal invariants:

- `public.billing_webhook_events.workshop_id` remains `uuid NOT NULL`.
- Tenant authority is derived server-side from `provider_preapproval_id`; callers never supply authoritative `workshop_id` or `subscription_id`.
- Event idempotency remains `(provider, provider_event_id)` and commission idempotency remains `provider_payment_id`.
- Provider calls never occur while database locks are held.
- Subscription mutation, applicable commission insertion/verification, and event completion commit together or roll back together.
- Strict TDD uses RED → GREEN → TRIANGULATE → REFACTOR evidence.
- Each delivery slice targets fewer than 400 changed lines unless the indivisible RPC safety boundary receives an explicit, conditional size exception.

Only outcomes whose tenant has been resolved from a provider preapproval relationship are durable in `billing_webhook_events`. Pre-tenant failures use structured, sanitized, allowlisted platform logs only. This design adds no pre-tenant database row, global diagnostics table, fake or nullable workshop, or external observability dependency, and it does not weaken `workshop_id NOT NULL`. Log retention, search, alerting, and dashboards remain production-observability concerns outside this change.

## 2. Architecture and data flow

### 2.1 Shared processing path

Create `supabase/functions/_shared/mercadopago-webhook-processing.ts`, used by both entry points:

1. `mercadopago-webhook` validates method, payload shape, signature, supported topic, and stable provider event identity.
2. `admin-retry-webhook` retains `requirePlatformAdmin`, loads the original event by UUID, and passes the returned admin `userId` only as reconciliation audit context.
3. The shared processor fetches fresh MercadoPago state, validates it with allowlisted runtime type guards, derives the preapproval linkage, and normalizes only trusted facts.
4. Once a non-empty `provider_preapproval_id` is available, the RPC resolves the subscription and workshop from the database. Neither entry point passes caller-controlled tenant authority.
5. The processor invokes `public.process_mercadopago_billing_event_v2(jsonb)` with the backend-only service-role client.
6. The Edge mapper converts the RPC result to HTTP semantics.

Admin reconciliation uses the original `(provider, provider_event_id)` and resource identity, fetches fresh provider state, and invokes the same RPC. It never inserts a synthetic retry row.

### 2.2 Pre-tenant diagnostics versus tenant event ledger

`billing_webhook_events` is a tenant ledger, not a platform-wide error sink. Invalid signature/JSON, unsupported topic, provider 400/404/5xx before tenant resolution, malformed provider resources, and missing subscription emit one platform log and create no event or tenant state. Missing subscription returns acknowledged `not_applicable/missing_subscription`; pre-tenant terminal failures are acknowledged according to the provider contract; provider/network 5xx returns 502. After the RPC resolves a real subscription/workshop, `retryable`, `completed`, `stale`, `uncertain`, and tenant-applicable terminal outcomes are durable on the tenant event row.

Slice 3 defines and exclusively unit-tests an allowlisted seam in `supabase/functions/_shared/mercadopago-webhook-processing.ts`:

```ts
type BillingPlatformDiagnosticCode =
  | "invalid_signature"
  | "invalid_payload"
  | "unsupported_topic"
  | "provider_not_found"
  | "provider_rejected"
  | "provider_unavailable"
      | "provider_rate_limited"
      | "provider_client_error"
  | "invalid_provider_resource"
  | "missing_subscription";

interface BillingPlatformDiagnostic {
  schemaVersion: 1;
  component: "mercadopago_webhook";
  correlationId: string;
  code: BillingPlatformDiagnosticCode;
  stage: "entry" | "provider_fetch" | "provider_decode" | "subscription_resolution";
  retryable: boolean;
  httpStatus: number;
  provider: "mercadopago";
  providerHttpStatus?: number;
  resourceKind?: "preapproval" | "payment" | "authorized_payment";
}

interface BillingPlatformLogger {
  emit(entry: BillingPlatformDiagnostic): void;
}
```

`correlationId` is a server-generated UUID created at request entry and returned in a response header; request/provider identifiers are never used as the correlation key. `emitBillingPlatformDiagnostic(logger, diagnostic)` constructs a new object by copying only the fields above, accepts `providerHttpStatus` only as an integer from 400 through 599, validates all other enum/numeric values against the closed response mapping, and never spreads input, serializes `Error`, or accepts free-form detail. The production adapter emits that exact object through the platform console logger. Forbidden fields include raw payload/response, signature/header values, access token, service-role credentials, provider event/resource/preapproval/payment IDs, workshop/subscription/user IDs, URLs/query strings, stack traces, and arbitrary error messages. Provider 400 maps to `provider_rejected`, 404 to `provider_not_found`, 429 to `provider_rate_limited` and retryable 503 (forward only a syntactically safe provider `Retry-After`), other 4xx to `provider_client_error` and retryable 502, and 5xx/network to `provider_unavailable`; malformed resources map to retryable 502 `invalid_provider_resource` with no RPC/event/tenant mutation, and missing subscriptions use their named code.

The logger is injected into the shared processor and webhook entry handler, giving tests an in-memory spy with no external dependency. Slice 3 tests the helper allowlist/sanitization and shared-processor diagnostic classification once. Slice 4 owns entry/HTTP tests and database no-event assertions for invalid signature, invalid payload, unsupported topic, provider 400/404/429/other-4xx/5xx, malformed resource, and missing subscription. Slice 4 asserts the response/header, one sanitized log, no RPC/event insert, and no subscription/commission mutation for each case; these entry/no-event tests are not duplicated in Slice 3 or Slice 5.

`admin-support-diagnostics` never queries, captures, or exposes pre-tenant platform logs. It exposes only tenant-resolved `billing_webhook_events` outcomes and reconciliation context. If an existing tenant event is reconciled, its stored workshop is correlation evidence only: fresh provider state must resolve back to the same workshop before mutation.

## 3. Exact transaction and concurrency algorithm

`public.process_mercadopago_billing_event_v2(jsonb)` is `SECURITY INVOKER` and executes at PostgreSQL's normal `READ COMMITTED` isolation. Its exact order is:

1. Validate contract version `2`, provider `mercadopago`, event/resource identifiers, closed status vocabulary, timestamp normalization result, and optional commission shape. Reject any `workshopId` or `subscriptionId` authority in the input contract.
2. Resolve exactly one subscription from `public.subscriptions.provider = 'mercadopago' AND provider_preapproval_id = input.providerPreapprovalId`. Read its `id` and `workshop_id`. The unique preapproval constraint makes this unambiguous. If none exists, return `not_applicable/missing_subscription` to the Edge mapper without inserting an event. If more than one is possible because the database invariant is broken, fail closed with a sanitized platform diagnostic and no event mutation.
3. Insert the tenant event using only the derived workshop:

   ```sql
   INSERT INTO public.billing_webhook_events (
     provider, provider_event_id, event_type, provider_resource_id,
     provider_preapproval_id, workshop_id, contract_version,
     outcome, processed_at, normalized_payload
   )
   VALUES (
     'mercadopago', v_provider_event_id, v_event_type, v_resource_id,
     v_preapproval_id, v_derived_workshop_id, 2,
     'retryable', clock_timestamp(), v_normalized_payload
   )
   ON CONFLICT (provider, provider_event_id) DO NOTHING;
   ```

4. Immediately acquire the canonical row:

   ```sql
   SELECT * INTO v_event
   FROM public.billing_webhook_events
   WHERE provider = 'mercadopago'
     AND provider_event_id = v_provider_event_id
   FOR UPDATE;
   ```

   PostgreSQL's unique-index conflict handling makes a concurrent `INSERT ... ON CONFLICT DO NOTHING` wait for the transaction owning the same key. If that transaction commits, the losing insert does nothing; the following `SELECT ... FOR UPDATE`, as a new statement under `READ COMMITTED`, sees and locks the committed row. If the winner rolls back, the waiting insert can create the row and then lock it. The function must treat a missing row after this sequence as an invariant failure, not continue unlocked.
5. While holding the event lock, branch by stored contract version:
   - **Contract v2:** require strict equality for immutable `provider`, `provider_event_id`, `event_type`, `provider_resource_id`, `provider_resource_kind`, `provider_preapproval_id`, and `workshop_id` against the normalized fresh-provider identity and derived workshop. A contradiction returns `identity_conflict`, leaves the row unchanged, and applies no billing effect.
   - **Contract v1:** allow one-time enrichment only for an explicit admin reconciliation whose `originalEventId` is the locked row. Fresh fetch must decode to a supported preapproval/payment/authorized-payment resource, yield a non-empty preapproval ID, and resolve exactly one MercadoPago subscription. That subscription's current `workshop_id` must exactly equal the event's existing `workshop_id`. The stored `provider_resource_id` is required legacy identity evidence: the row is eligible only when it is non-NULL, non-empty, and exactly equals the fresh normalized provider resource ID. A NULL or empty stored `provider_resource_id` is ineligible `legacy_uncertain`; it is never populated, guessed, or enriched, and the event row and all billing state remain byte-for-byte unchanged. Existing `provider`, `provider_event_id`, and `event_type` must equal the normalized values. Existing non-NULL `provider_preapproval_id` and `provider_resource_kind` must also equal the normalized values. Only the newly added nullable metadata fields `provider_preapproval_id`, `provider_resource_kind`, `provider_snapshot_at`, and `provider_fetched_at` may receive one-time enrichment after exact workshop and identity proof. Ownership, workshop, provider, event identity, and resource ID are never rewritten. Ineligible, ambiguous, unsupported, mismatched, or cross-workshop input returns `legacy_uncertain` with byte-for-byte no row mutation and no billing effect.
6. For an eligible contract-v1 row, populate only NULL `provider_preapproval_id`, `provider_resource_kind`, `provider_snapshot_at`, and `provider_fetched_at`, then set `contract_version = 2` on the original locked row. Non-NULL immutable identity values were already required to match. Freshness fields are attempt/order evidence rather than tenant authority: initial NULLs may be enriched here and later v2 attempts may advance them only through the normal monotonic freshness rules. The row remains the same event ID and workshop.
7. If the locked row was already v2 `completed`, return `duplicate` without changing attempts, subscription, or commission. Otherwise increment attempt/reconciliation context, lock the already-resolved subscription `FOR UPDATE`, and revalidate provider, preapproval ID, and workshop. If it changed or vanished, apply no billing effect; ordinary v2 handling records the appropriate tenant outcome, while a pre-enrichment v1 mismatch follows the no-mutation `legacy_uncertain` rule.
8. Evaluate freshness while the subscription lock is held. Stale and unorderable snapshots do not enter the mutating block.
9. Enter a nested `BEGIN ... EXCEPTION` block (a PostgreSQL subtransaction). Inside it:
   - update the resolved subscription;
   - derive referral attribution from tenant-bound database relationships;
   - insert an applicable commission with `ON CONFLICT (provider_payment_id) DO NOTHING`, then verify any existing row matches workshop, subscription, attribution, amount, currency, and occurrence facts;
   - mark the original event `completed`, set `completed_at`, update eligible freshness/normalized outcome evidence, and clear error fields.
10. If any nested statement fails, the nested subtransaction rolls back the subscription, commission, and completion writes together. The outer exception handler updates the original locked event to contract-v2 `retryable` with bounded error code/category and SQLSTATE, then returns normally. Safe v1 identity enrichment and the v2 transition intentionally persist outside the nested block. This is safe because fresh provider evidence already proved exact existing-workshop ownership and compatible immutable identity; no subscription or commission effect escaped, and the enriched row gives the next retry strict v2 identity checks instead of repeating permissive legacy eligibility. PostgREST commits that event evidence; the Edge Function returns 500.

All paths lock event first and subscription second after the initial non-locking ownership lookup. Same-event callers serialize on the event row. Different events for one subscription serialize on the subscription row. If the first same-event caller completes, the waiter observes `completed` and returns duplicate. If the first caller records retryable failure, the waiter may perform the next safe attempt; at most one caller is inside the effective subscription/commission section at a time.

## 4. Data model and legacy ownership

### 4.1 `public.billing_webhook_events`

Add:

- `contract_version smallint NOT NULL DEFAULT 1`
- `outcome text NOT NULL DEFAULT 'legacy_uncertain'`, constrained to `legacy_uncertain`, `retryable`, `completed`, `terminal`, `stale`, `uncertain`
- `outcome_reason text`
- `attempt_count integer NOT NULL DEFAULT 0`
- `last_attempted_at timestamptz`
- `completed_at timestamptz`
- bounded/sanitized `last_error_code text` and `last_error_detail text`
- `provider_resource_kind text`
- `provider_preapproval_id text`
- `provider_snapshot_at timestamptz`
- `provider_fetched_at timestamptz`
- `normalized_payload jsonb NOT NULL DEFAULT '{}'::jsonb`
- `reconciliation_count integer NOT NULL DEFAULT 0`
- `last_reconciled_at timestamptz`
- `last_reconciled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL`

Keep `processed_at` for compatibility as first receipt time; only `completed_at` proves v2 completion. `duplicate` and pre-tenant `not_applicable` are response dispositions, not stored event states.

Keep the existing ownership column and foreign key exactly tenant-bound:

- `workshop_id uuid NOT NULL`
- `REFERENCES public.workshops(id) ON DELETE CASCADE`

The migration does not relax nullability or change the existing `ON DELETE CASCADE` behavior. Every legacy event remains bound to its existing workshop. Inspection never strips, nulls, reassigns, or infers ownership. Ineligible legacy rows remain attached to that workshop and visible as `legacy_uncertain`; reconciliation either validates fresh provider linkage back to the same workshop or performs no mutation.

Add a partial operational index for `retryable`, `uncertain`, and `legacy_uncertain`. It is for admin queries, not queue claiming.

### 4.2 `public.subscriptions`

Add `provider_snapshot_at`, `provider_snapshot_resource_kind`, `provider_snapshot_resource_id`, and `provider_fetched_at`.

All pre-v2 events begin contract `1` / `legacy_uncertain`; never infer completion solely from `processed_at`. Inspection alone never enriches a row. Explicit reconciliation may perform the one-time locked transition defined in Section 3 only when fresh provider evidence resolves to the existing workshop, the stored `provider_resource_id` is non-NULL/non-empty and exactly matches the fresh normalized resource ID, and all other stored identity is compatible. NULL or empty legacy resource IDs are never backfilled or inferred. A successful enrichment processes the same original row through the nested atomic subscription/commission/completion path. If that inner path fails, enrichment persists and the original row becomes contract-v2 `retryable`; the next reconciliation/redelivery must pass strict v2 immutable equality and may safely retry. Synthetic `admin.retry`, ambiguous identity, NULL/empty stored resource ID, missing linkage, unsupported resources, identity mismatch, and cross-workshop resolution remain `legacy_uncertain` and byte-for-byte unchanged.

## 5. Provider resource typing and conservative freshness

Current code uses `Record<string, unknown>` plus casts and only directly consumes `date_created`; current TypeScript types do **not** guarantee `last_modified`, `date_last_updated`, or `date_created`. Slice 3 introduces explicit allowlisted decoding instead of asserting that the SDK already typed these fields.

The shared processor defines decoded interfaces:

```ts
interface MercadoPagoPreapprovalResource {
  kind: "preapproval";
  id: string;
  status: string;
  last_modified?: string;
  date_created?: string;
}

interface MercadoPagoPaymentResource {
  kind: "payment";
  id: string;
  status: string;
  preapproval_id?: string;
  preapproval?: { id: string };
  date_last_updated?: string;
  date_created?: string;
}

interface MercadoPagoAuthorizedPaymentResource {
  kind: "authorized_payment";
  id: string;
  status: string;
  preapproval_id?: string;
  preapproval?: { id: string };
  last_modified?: string;
  date_created?: string;
  transaction_amount?: number;
  charge?: number;
  currency_id?: string;
}
```

Runtime guards accept `unknown`, require a plain object plus non-empty string `id` and `status`, allow only the linkage/timestamp/commission fields above, and validate every present timestamp with a strict ISO-8601 parser that yields a finite instant. Present-but-invalid fields make the resource `invalid_provider_resource`; they are never silently skipped in favor of a weaker timestamp. Optional nested `preapproval` must itself be a plain object with a non-empty string `id`. Commission amount must be finite, non-negative, and within ledger precision; currency must be an allowlisted non-empty code.

Freshness extraction is:

- preapproval: valid `last_modified`, otherwise valid `date_created`;
- payment: valid `date_last_updated`, otherwise valid `date_created`;
- authorized payment: valid `last_modified`, otherwise valid `date_created`.

Missing timestamps are represented explicitly as `providerSnapshotAt: null`; invalid timestamps fail decoding. Conservative rules apply under the subscription lock:

1. A valid timestamp newer than stored applies; older is `stale`.
2. Equal timestamp may use later `provider_fetched_at` only for the same resource kind/ID; equal normalized state is a no-op.
3. Equal timestamp with different resource identity is `uncertain/ambiguous_order`.
4. Missing timestamp may order only a fresh read of the same already-bound preapproval resource by fetch time. Missing timestamp for a payment/authorized-payment resource, or across distinct resources, is `uncertain/missing_provider_timestamp` and cannot mutate access.
5. Unknown provider status is `uncertain/unknown_provider_status` and never maps to `past_due` or another application status.

Fixtures include valid primary timestamps, valid fallback timestamps, missing timestamps, malformed timestamps, equal timestamps with same/different resources, and unknown statuses. The signature timestamp is not business freshness, and opaque provider IDs are never lexically ordered.

## 6. RPC contract

### Input (`jsonb`, version 2)

- `contractVersion: 2`
- `provider: "mercadopago"`
- `providerEventId`
- `eventType`
- `resourceKind: "preapproval" | "payment" | "authorized_payment"`
- `providerResourceId`
- `providerPreapprovalId`
- `providerStatus`
- `providerSnapshotAt: ISO timestamp | null`
- `providerFetchedAt: ISO timestamp`
- allowlisted `normalizedPayload`
- optional commission `{ providerPaymentId, paymentAmount, currency, occurredAt }`
- optional reconciliation `{ requestedBy, originalEventId }`

The input is always the normalized v2 processing envelope; `reconciliation.originalEventId` authorizes only lookup of the already locked original row, not tenant identity. It is mandatory for the one-time contract-v1 path and must identify the same row selected by `(provider, provider_event_id)`. There is no `workshopId`, `subscriptionId`, `youtuberId`, `referralCodeId`, commission percentage, application status, or period authority. PostgreSQL derives relationships and status/period effects. For authorized payments, `commission.providerPaymentId` must equal `providerResourceId`.

### Output

- `eventId` when a tenant event exists
- `outcome`
- `reason`
- `retryable`
- `duplicate`
- `applied`
- `subscriptionId` only when resolved
- `commissionDisposition: "recorded" | "existing" | "not_applicable"`
- `attemptCount`
- `completedAt`

HTTP mapping: 200 for completed, duplicate, stale, tenant terminal, and missing-subscription/non-applicable; 409 for unresolved tenant uncertainty/identity conflict; 500 for tenant-resolved local retryable failure; 502 for provider/network retryable failure. No response claims billing completion for a pre-tenant diagnostic.

## 7. Security, grants, and integration proof

Define `public.process_mercadopago_billing_event_v2(jsonb)` as `SECURITY INVOKER`, pin `search_path` to `pg_catalog`, and schema-qualify every application object. Keep RLS enabled and add no anon/authenticated event, subscription, or commission write policy.

Function grants use the exact signature:

```sql
REVOKE ALL ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_mercadopago_billing_event_v2(jsonb) TO service_role;
```

SQL security tests assert:

- `PUBLIC`, `anon`, and `authenticated` lack EXECUTE; `service_role` has EXECUTE;
- `prosecdef = false` and the pinned `proconfig` search path;
- RLS remains enabled and ordinary callers have no billing writes;
- `service_role` has every table privilege required by invoker execution: `SELECT/INSERT/UPDATE` on `billing_webhook_events`, `SELECT/UPDATE` on `subscriptions`, `SELECT` on `workshop_referrals` and `referral_codes`, and `SELECT/INSERT` on `referral_commissions` (plus sequence privileges only if a touched object actually uses a sequence);
- privileges not required by the RPC are not broadened.

Slice 2 separates database proof from client-path proof. The new `supabase/tests/billing_webhook_retryable_rpc.test.sql` is exclusively SQL/pgTAP and proves direct database behavior, catalog/grants/RLS posture, rollback, concurrency, legacy enrichment, and other direct database assertions; it does not construct or execute Supabase-js. `tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` is gated by `RUN_LOCAL_SUPABASE_INTEGRATION=true`: ordinary `npm test` skips it with a clear reason, while `RUN_LOCAL_SUPABASE_INTEGRATION=true npm test -- tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` enables it. When enabled, it fails actionably if `E2E_SUPABASE_URL` or `E2E_SUPABASE_SERVICE_ROLE_KEY` is absent or the URL host is not loopback; there is no remote fallback. It constructs `createClient(localPostgrestUrl, localServiceRoleKey)` and calls the RPC through local PostgREST, proving committed success and durable `retryable` evidence with rolled-back effects. Together with SQL catalog/privilege assertions, this proves PostgREST exposure, EXECUTE, and invoker table privileges.

## 8. Failure semantics

- Invalid signature/payload or unsupported topic: sanitized pre-tenant terminal platform diagnostic, no tenant event/effect, acknowledged per provider contract.
- Provider 400/404 before tenant resolution: sanitized terminal `provider_rejected`/`provider_not_found` diagnostic, no event/effect, 200.
- Provider 429 before tenant resolution: sanitized retryable `provider_rate_limited` diagnostic, no event/effect, 503, forwarding only safe `Retry-After` when available.
- Other provider 4xx before tenant resolution: sanitized retryable `provider_client_error` diagnostic, no event/effect, 502.
- Provider/network 5xx before tenant resolution: sanitized retryable `provider_unavailable` diagnostic, no event/effect, 502.
- Malformed provider resource before tenant resolution: sanitized retryable `invalid_provider_resource` diagnostic, no RPC/event/tenant mutation, 502.
- Missing subscription: sanitized platform `not_applicable/missing_subscription`, no event/effect, 200.
- Unknown status or ambiguous ordering after tenant resolution: durable tenant `uncertain`, no subscription/commission mutation, non-2xx.
- Local SQL failure after tenant resolution: nested effects roll back; tenant event commits `retryable`; 500.
- Completed duplicate: 200, no mutation.
- Stale fresh snapshot: durable tenant `stale`, 200, no mutation.
- Relationship mismatch: no cross-tenant mutation; ownership remains unchanged and the contradiction is sanitized.
- Contract-v1 eligible enrichment: exact existing-workshop and compatible-identity proof enriches NULL metadata on the locked original row, transitions that row to v2, and enters the normal nested atomic effects path.
- Contract-v1 mismatch/ineligibility/cross-workshop resolution: return `legacy_uncertain`; row, ownership, metadata, subscription, and commission remain byte-for-byte unchanged.
- Retryable side-effect failure after safe enrichment: nested subscription/commission/completion writes roll back, while proven identity enrichment and contract-v2 `retryable` evidence persist so the next attempt uses strict v2 equality.

## 9. Exact file and slice ownership

Each planned file belongs to exactly one slice. A later slice does not reopen files owned by an earlier slice. Schema/generated database types are Slice 1; provider runtime interfaces are local implementation types in Slice 3.

### Slice 1 — schema and generated types (<400 changed lines)

- `supabase/migrations/<CLI-generated timestamp>_billing_webhook_retryable_schema.sql`: additive event/subscription columns, constraints, indexes, legacy defaults; preserves event `workshop_id NOT NULL` and `ON DELETE CASCADE`.
- `src/shared/types/database.ts`: regenerated/manual schema types, including `Relationships: []` as required by repository convention.
- Create `supabase/tests/billing_webhook_retryable_schema.test.sql` as a new SQL/pgTAP file, bound to the discovered local runner/config: RED schema defaults, legacy ownership/classification, FK/delete behavior, RLS, and non-null assertions. This is a planned file and does not exist yet.

No RPC or runtime adoption is included.

### Slice 2 — indivisible atomic RPC plus separate local client integration proof (<400 changed lines unless exception approved)

- `supabase/migrations/<CLI-generated timestamp>_process_mercadopago_billing_event_v2.sql`: RPC, exact algorithm, grants, and no handler adoption.
- Create new `supabase/tests/billing_webhook_retryable_rpc.test.sql`: exclusively SQL/pgTAP RED proof for rollback, durable retry, successful retry, same-event concurrency, same-subscription ordering, strict v2 identity validation, commission conflict, catalog/grants, invoker table privileges, and RLS/direct database behavior. Legacy SQL cases assert: (1) successful one-time NULL metadata enrichment on the original row followed by atomic completion; (2) forced nested side-effect failure preserves only safe enrichment plus contract-v2 `retryable`, followed by a successful strict-v2 retry on the same row without duplicate commission; (3) any non-NULL identity mismatch or unsupported/ineligible resource returns `legacy_uncertain` and leaves a before/after row snapshot and all billing tables unchanged; (4) a NULL or empty stored `provider_resource_id` is ineligible `legacy_uncertain`, is not populated or inferred, and leaves the event row and all billing tables byte-for-byte unchanged; and (5) a fresh subscription resolving to another workshop is rejected with the same no-mutation proof. This file performs no Supabase-js or PostgREST client call.
- Create new `tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` (including its absent parent directory): exclusively the real local PostgREST service-role proof. It skips under ordinary `npm test` with a clear reason unless `RUN_LOCAL_SUPABASE_INTEGRATION=true`; the focused opt-in command then requires `E2E_SUPABASE_URL` and `E2E_SUPABASE_SERVICE_ROLE_KEY`, rejects non-loopback URLs, and has no remote fallback. It creates `createClient(localPostgrestUrl, localServiceRoleKey)` and calls the RPC, proving committed success and durable retryable rollback evidence.

Slice 2 verification and changed-line forecasting include the migration, the SQL/pgTAP file, and the TypeScript local PostgREST integration file. Forecast the complete slice below 400 lines first and keep each proof in its owner file. The RPC size exception is **conditional, not assumed** and does not excuse unrelated integration-test growth: only if the RPC plus its minimum rollback/concurrency/security proof cannot fit without splitting the atomic safety boundary may apply request and record an explicit review-size exception before implementation.

### Slice 3 — provider decoder, fixtures, and shared processor (<400 changed lines)

- `supabase/functions/_shared/mercadopago-webhook-processing.ts`: allowlisted resource interfaces/type guards, freshness normalization, provider fetch abstraction, RPC invocation, and result mapping.
- `supabase/functions/_shared/billing.ts`: closed provider-status mapping; remove unknown-to-`past_due` fallback.
- `tests/supabase/functions/billingHelpers.test.ts`: RED closed-status and conservative freshness helper tests.
- Create new `tests/supabase/functions/mercadopagoWebhookProcessing.test.ts`: RED decoder/type-guard, timestamp, linkage, commission-fact, provider error, RPC mapping, mocked fetch/RPC, and the only unit tests for `emitBillingPlatformDiagnostic`. These prove exact allowlisted keys, generated-correlation preservation, forbidden-field dropping, no `Error`/raw-object serialization, and code/retryability mapping for provider 400/404/429/other-4xx/5xx, malformed resource, and missing subscription. They assert RPC suppression where tenant resolution fails but do not duplicate Slice 4 HTTP/database no-event assertions.
- `scripts/e2e/fixtures.ts`: replace the sequential `simulateMercadoPagoWebhook` implementation in this slice, when mocked provider fetch/RPC behavior is introduced. The replacement fixture contract models provider status, preapproval linkage, resource ID and kind, `last_modified`/`date_last_updated`/`date_created`, fetch time, and commission facts (`providerPaymentId`, amount, currency, occurrence time). It must not directly perform the old event-insert-then-subscription-update sequence.

### Slice 4 — webhook HTTP adoption and E2E (<400 changed lines)

- `supabase/functions/mercadopago-webhook/index.ts`: retain validation and atomically cut over accepted events to the shared processor; remove sequential billing writes.
- `supabase/functions/mercadopago-webhook/commissions.ts`: remove runtime database commission writes or retain only pure calculation helpers needed by this slice.
- Create new `tests/supabase/functions/mercadopagoWebhook.test.ts`: RED webhook entry tests proving fresh fetch precedes RPC and retryable results are non-2xx. This slice exclusively owns entry/HTTP cases for invalid signature, invalid payload, unsupported topic, provider 400/404/5xx, malformed resource, and missing subscription: exact status/header, one sanitized allowlisted log, and no RPC call.
- `tests/e2e/integration/mercadopago-webhook.spec.ts`: HTTP/E2E service-role RPC persistence, forced failure then redelivery, completed duplicate, stale snapshot, concurrent at-most-one commission evidence, and database proof that every pre-tenant/missing-subscription case creates no event, subscription, or commission mutation, using the Slice 3 provider fixtures.

### Slice 5 — admin reconciliation and diagnostics (<400 changed lines)

- `supabase/functions/admin-retry-webhook/index.ts`: `requirePlatformAdmin`, eligibility checks, fresh fetch, and real shared-path reconciliation.
- `supabase/functions/admin-support-diagnostics/index.ts`: expose only tenant-resolved event outcomes and reconciliation context. It has no platform-log reader, pre-tenant category source, log-query contract, or external observability integration.
- Create new `tests/supabase/functions/adminRetryWebhook.test.ts`: RED unauthorized no-op plus exact admin reconciliation cases: successful one-time enrichment/completion on the original row; forced post-enrichment side-effect failure followed by successful retry of the enriched row; non-NULL identity mismatch/ineligible resource with before/after no mutation; NULL and empty stored `provider_resource_id` returning `legacy_uncertain` without populating or inferring identity and with byte-for-byte no event or billing-state mutation; and cross-workshop rejection with no mutation.
- Create new `tests/supabase/functions/adminSupportDiagnostics.test.ts`: RED tenant event outcomes and reconciliation context only; assert no pre-tenant platform-log field or query capability is exposed.

No frontend redesign or generic operations table is introduced.

## 10. Strict TDD and verification

Each slice records RED → GREEN → TRIANGULATE → REFACTOR. Required gates are `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`, focused Playwright integration, and the discovered supported Supabase SQL test command. `npm test` skips `tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts` with a clear reason unless `RUN_LOCAL_SUPABASE_INTEGRATION=true`; the focused opt-in command is `RUN_LOCAL_SUPABASE_INTEGRATION=true npm test -- tests/supabase/integration/billingWebhookRetryableRpc.integration.test.ts`. When enabled, missing local prerequisites or a non-loopback URL fail actionably and never substitute remote credentials.

The Supabase CLI was absent at design time, so the exact SQL/pgTAP test command remains intentionally undiscovered. Apply must use the repository-supported launcher and inspect CLI `--help` at each relevant level before recording or running that command; it must not guess a Supabase SQL test subcommand or flags. `schema_paths = []` means imperative migrations. Generate both migration filenames through the discovered CLI command; do not invent timestamps or unsupported `db query`, `db pull`, `db push`, or test flags. Run available database advisors and local verification. Remote mutation requires separate approval and must follow `docs/operations/migration-deployment.md`.

## 11. Rollout and rollback

1. Deploy Slice 1 additive schema while preserving legacy ownership.
2. Deploy Slice 2 RPC and verify function/table privileges, RLS, and a real service-role RPC call before any handler uses it.
3. Deploy Slice 3 decoder/shared processor and provider fixtures without routing production traffic.
4. Deploy Slice 4 as an atomic webhook cutover only after Slices 1–3 are present. There is no rollout flag whose failure branch invokes the unsafe sequential handler.
5. Monitor tenant-resolved outcomes/reasons, attempts, stale/uncertain rates, latency, identity conflicts, and commission conflicts from the event ledger; use ordinary platform runtime logs for pre-tenant operational observation. Then deploy Slice 5 admin reconciliation. This rollout adds no log store or support-log query surface.

Rollback never routes accepted v2 failures or identities to the old sequential handler. If Edge v2 must be stopped, fail closed with retryable non-2xx/maintenance behavior or roll forward; preserve the RPC, columns, tenant event history, ownership, and reconciliation evidence. Do not downgrade v2 rows to legacy semantics or drop data-bearing columns. Remove obsolete sequential code only after the observation window.

## 12. Risks and mitigations

- **Concurrent identity race:** exact `ON CONFLICT DO NOTHING` plus `SELECT ... FOR UPDATE`, identity revalidation, and concurrency tests prevent dual application.
- **Tenant fabrication or crossing:** `workshop_id NOT NULL`, provider-preapproval derivation, unchanged FK ownership, and no pre-tenant ledger inserts preserve isolation.
- **Provider schema drift:** unknown-input type guards, allowlisted interfaces, malformed/missing timestamp fixtures, and conservative uncertainty fail closed.
- **Invoker privilege mismatch:** SQL/pgTAP catalog and table-privilege assertions plus the separate TypeScript local PostgREST service-role RPC integration test prove deployability without `SECURITY DEFINER`.
- **Legacy ambiguity:** ownership is never stripped; the locked one-time transition requires supported fresh provider state, exact existing-workshop linkage, and compatible immutable identity. Proven enrichment may persist across a nested side-effect rollback, after which strict v2 equality governs retries.
- **Unsafe rollback:** no v2-to-sequential fallback exists; retryable failure or forward correction preserves provider redelivery.
- **Review overload:** files/tests have one slice owner, every slice targets <400 lines, and the RPC exception requires an explicit evidence-based decision rather than being presumed.
