# Exploration — billing-webhook-retryable-processing

## Result contract

- **status:** `exploration_complete`
- **executive_summary:** The P0 bug is confirmed. `mercadopago-webhook` inserts `billing_webhook_events` and stamps `processed_at` before updating `subscriptions` and, for approved authorized payments, recording `referral_commissions`. Any later failure returns non-2xx, but a MercadoPago redelivery (same `x-request-id`) hits the unique `(provider, provider_event_id)` index and returns 200 `Already processed`, so the failed side effects are permanently suppressed. The existing admin retry endpoint does not reprocess the event; it inserts a synthetic `admin.retry` row only.
- **artifacts:** `openspec/changes/billing-webhook-retryable-processing/exploration.md`; Engram topic `sdd/billing-webhook-retryable-processing/explore`.
- **next_recommended:** `proposal` / `spec`, with a transactional retryable-processing design selected before implementation.
- **risks:** This is a billing hot path and data-recovery issue. The fix must preserve duplicate safety, avoid duplicate commissions, handle concurrent deliveries/crashes, and retain recoverability for already-recorded events. Schema/RPC changes require SQL/integration tests in addition to `npm test`.
- **skill_resolution:** `paths-injected`

## Current flow

1. `supabase/functions/mercadopago-webhook/index.ts` validates method, configured secret, signature headers, JSON, resource ID, and MercadoPago HMAC signature.
2. It classifies the topic (`preapproval`, `payment`, `authorized_payment`), fetches the provider resource, derives `preapprovalId`, and looks up one subscription by `provider_preapproval_id` using a service-role client.
3. Unknown topics, missing provider resources, absent preapproval IDs, and absent subscriptions are acknowledged with HTTP 200. Provider fetch failures other than 400/404 return 502.
4. It inserts `billing_webhook_events` with `processed_at = now()` and payload/context. `provider_event_id` is the request ID (`x-request-id`), not the resource ID.
5. Only after the insert succeeds does it map provider status and update the subscription. Active events also set a new 30-day period from the current time.
6. For `authorized_payment` with provider status `approved`, it looks up workshop referral attribution and inserts a commission. Commission uniqueness is by `provider_payment_id`; a 23505 is treated as already recorded.
7. A successful path returns 200 `OK`; duplicate event insert returns 200 `Already processed`; side-effect failures return 500.

## Bug verification and failure boundaries

The ordering is directly visible in `mercadopago-webhook/index.ts`: event insert precedes both the subscription update and commission recording. The event insert is an independent Supabase request, not a transaction spanning those writes.

Failure windows:

- **Before event insert:** provider fetch, subscription lookup, and validation failures are either retried (provider fetch 502 / lookup 500) or acknowledged without a durable event. No suppression row exists.
- **After event insert / before subscription update:** subscription update failure leaves an apparently processed event and unchanged subscription. Redelivery is suppressed.
- **After subscription update / before commission insert:** commission lookup/insert failure leaves updated subscription but no commission. Redelivery is suppressed.
- **During process crash:** the same partial states are possible without a response; provider retry cannot recover because the event row already exists.
- **Concurrent deliveries:** the unique index serializes duplicate inserts. The winner can fail after insertion; the loser receives 23505 and 200, so concurrency makes the lost-recovery window deterministic rather than safe.

This confirms the suspected bug, not merely a theoretical concern.

## Persistence and idempotency schema

`supabase/migrations/0022_billing_schema.sql` defines:

- `subscriptions`: one row per workshop; provider IDs/status and period fields; unique provider preapproval ID; RLS with authenticated select scoped to the current workshop.
- `billing_webhook_events`: UUID, provider, provider event ID, event type, provider resource ID, workshop ID, `processed_at NOT NULL DEFAULT now()`, payload JSONB, updated timestamp; unique `(provider, provider_event_id)`; RLS enabled and no authenticated write surface is shown.
- `referral_commissions` from `20260615000004_referral_program_commissions.sql`: immutable payment/commission snapshot and unique `provider_payment_id`, RLS enabled with no authenticated policies; service-role Edge Functions are the intended writer.
- Later commission payout migrations add mutable payout metadata/status but do not address webhook processing.

The current event schema has no processing state, attempt count, error, lease, or completion timestamp distinct from insertion. `processed_at` semantically conflates accepted/persisted with all side effects completed.

## Subscription and referral behavior

Status mapping is centralized in `supabase/functions/_shared/billing.ts`: authorized/active → active, pending/paused → past_due, rejected/failure → unpaid, cancelled → cancelled, unknown → past_due. Active period dates are calculated as now + 30 days rather than from provider dates.

Commission logic in `mercadopago-webhook/commissions.ts` is separately unit-tested. It reads `workshop_referrals` and referral-code commission percentage, calculates a rounded amount, and inserts a ledger row. It correctly treats 23505 as a duplicate, but that protection only covers duplicate commission rows; it does not make the event plus subscription plus commission atomic. A failure in attribution lookup or insert is returned to the webhook as a 500 after the event row already exists.

## Admin retry and diagnostics

`supabase/functions/admin-retry-webhook/index.ts` requires a platform admin, reads the original event, then inserts a new synthetic event with an ID like `${original}_retry_${Date.now()}` and `event_type = 'admin.retry'`. It does not invoke MercadoPago, reconstruct provider state, call the webhook processor, or update the original event. Therefore the UI retry action is an audit/diagnostic marker, not recovery. `admin-support-diagnostics` lists recent event rows, and the admin UI exposes retry from that list. There is no observed processing-state or failed-event queue in the current admin flow.

## Existing tests and migrations

Relevant coverage exists in:

- `tests/e2e/integration/mercadopago-webhook.spec.ts`: successful subscription activation/event persistence, failed charge status, duplicate unique-provider-event behavior, and signature checks.
- `tests/supabase/functions/billingHelpers.test.ts`: mapping, signature, and topic classification.
- `tests/supabase/functions/mercadopagoWebhookCommissions.test.ts`: commission computation, attribution, successful insert, duplicate 23505, and lookup/insert failures.
- `supabase/migrations/0022_billing_schema.sql`: schema/RLS/idempotency assertions.

The E2E duplicate test currently codifies the old behavior (duplicate insertion fails and the original `updated_at` remains unchanged); it does not simulate a side-effect failure followed by redelivery. New RED tests should explicitly force subscription-update failure and commission failure after event acceptance, assert a retryable state, then prove the second delivery/admin retry completes the missing work without duplicate commission.

## Design comparison

### A. Single transactional database RPC (preferred core invariant)

Create an internal RPC that claims/records the event and applies the subscription update plus commission insert in one PostgreSQL transaction. The Edge Function should fetch/normalize provider data, then call the RPC with a stable event identity and complete side-effect inputs. Use a unique event key and row locking/upsert semantics so concurrent deliveries wait or observe a completed result. On any side-effect error the transaction rolls back the event claim and all side effects; MercadoPago receives non-2xx and can retry naturally. Commission uniqueness remains a defense-in-depth constraint.

Pros: smallest crash window, atomic database state, naturally retryable, strong concurrency behavior, easy RED/GREEN SQL tests. Cons: provider fetch remains outside the transaction; RPC contract must carefully encode stale/out-of-order rules and must not hold locks across network calls; migration and Edge Function deployment must be coordinated.

### B. Explicit event state + outbox/reconciliation worker

Add states such as `received`, `processing`, `completed`, `failed`, attempts, last error, and lease timestamps. Persist first, then process asynchronously; retries/admin action claim failed or stale work. Side effects need idempotent operations and a durable outbox/reconciliation loop.

Pros: excellent observability, bounded provider request latency, independent admin retry, recovery for historical partial events, scalable backpressure. Cons: larger change, more states and lease races, and cannot provide atomicity across multiple tables unless the worker uses a transaction/RPC anyway. A state column alone is insufficient.

### C. Edge Function sequential writes with completion state

Insert or upsert an event as `received`, perform side effects, then mark `completed`; duplicates inspect state and retry incomplete rows.

Pros: lower initial migration complexity and backward-compatible with current function structure. Cons: crash windows remain, so the implementation must make every side effect idempotent and use leases/concurrency controls. It is safer than the current code but weaker than RPC atomicity and can still leave partial subscription/commission work.

### Recommendation

Use **A as the correctness boundary**, optionally retaining the event state/error/attempt columns from B for operational visibility and historical reconciliation. Keep provider API fetch outside the DB transaction. The RPC should be short, receive a normalized provider snapshot, lock the target subscription/event row in a deterministic order, and make the event `completed` only after all local side effects succeed. A failed transaction must leave an event that is either absent (new events) or explicitly retryable (if the rollout chooses durable receipt first); do not return 200 for incomplete work.

For existing rows, treat current rows as legacy-completed only when no evidence of a partial failure exists. Add a reconciliation/admin path that can re-run known legacy event IDs using the stored payload plus a fresh provider fetch, with commission uniqueness and status transition rules preventing duplication. Do not blindly replay all historical events: stale or out-of-order provider state needs a monotonic/version/timestamp policy or fresh provider-state fetch.

## Concurrency, provider retries, and ordering requirements

- Stable identity must remain `(provider, provider_event_id)` for MercadoPago redelivery; resource ID is not a substitute because multiple provider notifications can describe one resource.
- Concurrent same-event requests must have exactly one effective side-effect application; losers must wait/observe completion or receive a retryable response if the winner failed.
- Different events for the same subscription need deterministic locking and an ordering/staleness rule. A later provider state must not be overwritten by an older notification.
- Never hold a database lock while calling MercadoPago.
- Approved authorized payments must remain commission-idempotent by provider payment ID; a completed subscription update must not make a failed commission unrecoverable.
- Provider 400/404 and unknown/mismatched events need an explicit terminal/non-retryable classification with diagnostics; transient provider/network/database failures must be retryable.

## RLS, service role, and RPC security

The webhook already uses `SUPABASE_SERVICE_ROLE_KEY`; target tables intentionally have restrictive RLS/no authenticated write policies. An internal RPC should not be exposed as a public unrestricted function. Prefer a non-exposed schema and explicit `REVOKE EXECUTE FROM PUBLIC`, granting only the service role or a narrowly controlled Edge Function role. If `SECURITY DEFINER` is necessary to perform service-side writes, pin `search_path`, validate all workshop/subscription/event relationships inside the function, and do not accept caller-supplied tenant authority. Preserve the existing subscription SELECT policy and commission/event RLS posture.

## Rollout and rollback

1. Add additive schema/state fields and indexes, plus RPC in a backward-compatible migration; deploy code that can detect the new contract.
2. Backfill only safe metadata for existing events; do not mark uncertain partial events as complete without reconciliation evidence.
3. Ship RED tests first, then RPC/function GREEN implementation and SQL/integration coverage.
4. Enable the new path behind a server-side flag or versioned function contract; monitor failed/claimed/stale/completed counts and duplicate outcomes.
5. Rollback code to the old handler only if the old path remains safe for new rows; do not drop state columns/RPC immediately. If a migration rollback is needed, preserve data and disable new claims rather than deleting event history.

## Test plan (strict TDD)

RED first, then GREEN:

- Event insert/claim plus subscription update is atomic: forced update failure leaves no completed event and allows a subsequent retry.
- Commission insert failure is retryable; the next attempt records commission exactly once and reaches completed.
- Concurrent duplicate deliveries result in one subscription transition and one commission row.
- A completed duplicate returns 200 without mutation.
- A failed/in-progress/stale event can be retried by MercadoPago and by the admin endpoint; admin retry calls the real processor/reconciliation path, not a synthetic audit insert.
- Crash-window simulation between each local side effect proves recovery.
- Existing legacy event rows remain readable and can be reconciled safely.
- Out-of-order/stale provider snapshots do not regress subscription state.
- SQL tests assert constraints, indexes, RLS, function grants/search path, and RPC behavior; TypeScript tests cover classification/result mapping; E2E tests cover HTTP status and persistence.

Primary command: `npm test`; SQL/integration tests are required whenever schema/RPC behavior changes.

## Scope boundary

This exploration is limited to recoverable MercadoPago billing webhook processing: event persistence/idempotency, subscription side effects, referral commission recording, administrative retry/reconciliation, migrations, tests, failure boundaries, and rollout recovery. It excludes unrelated billing UI redesign, provider subscription creation, payout execution, and non-billing admin workflows.
