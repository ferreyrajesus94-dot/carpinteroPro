# Proposal: Retryable Billing Webhook Processing

## Intent

Fix a P0 billing integrity failure in MercadoPago webhook processing. Today, an event is marked processed before subscription and referral-commission writes finish. If a later write fails, provider redelivery is acknowledged as a duplicate and the missing side effect may never run, leaving paid access or commission state permanently inconsistent.

The target outcome is a retry-safe, duplicate-safe processing boundary in which each accepted MercadoPago event either completes all required local billing effects or remains safely retryable. A short transactional PostgreSQL RPC is the correctness boundary. MercadoPago network calls and provider-state normalization remain outside database transactions.

## Scope

- Make event persistence, subscription mutation, and applicable referral-commission recording atomic for one normalized webhook event.
- Preserve stable event idempotency by `(provider, provider_event_id)` and commission idempotency by provider payment ID.
- Define outcomes for completed duplicates, failed attempts, concurrent deliveries, transient failures, and terminal/non-retryable events.
- Prevent stale or out-of-order events from regressing subscription state.
- Replace the current synthetic admin retry behavior with bounded reconciliation that performs real processing for eligible failed or uncertain legacy events.
- Add only the operational state and diagnostics needed to support retries, monitoring, and legacy reconciliation.
- Preserve restrictive RLS and service-role-only write access; any privileged RPC must be inaccessible to `PUBLIC`, `anon`, and ordinary authenticated callers.
- Deliver with strict TDD and reviewable slices that remain within the 400 changed-line review budget, or explicitly split the work before apply.

## Non-goals

- Generic billing architecture or UI redesign.
- Changes to MercadoPago subscription creation, pricing, payout execution, or unrelated admin workflows.
- Holding database locks while calling MercadoPago.
- Blind replay of all historical events or broad relaxation of RLS/service-role controls.

## Business Rules

1. **Retry timing:** Retry occurs on the next MercadoPago redelivery or through on-demand admin reconciliation. This change adds no background worker or retry-latency SLA.
2. **Retryable outcomes:** Provider/network 5xx failures, database errors, and incomplete local transactions return non-2xx and remain retryable; incomplete local processing must never be acknowledged as completed.
3. **Terminal outcomes:** Invalid signatures or payloads and unsupported topics are acknowledged terminally with diagnostics. Provider 400/404 missing resources are terminal and non-retryable.
4. **Duplicates:** A completed duplicate returns 200 without mutation. An incomplete duplicate remains eligible for safe retry.
5. **Missing and unknown state:** A missing subscription is acknowledged and diagnosed but must not create tenant state. Unknown provider statuses are recorded for explicit diagnosis/reconciliation and must not silently regress access.
6. **Concurrency:** Concurrent deliveries of the same event produce exactly one effective application. Events affecting the same subscription follow deterministic locking and staleness rules.
7. **Ordering:** Redelivery and reconciliation fetch fresh provider state before the database RPC. A stale notification payload alone cannot overwrite newer state.
8. **Atomicity:** Subscription state and any required commission are committed together with event completion or rolled back together. Commission uniqueness remains defense in depth.
9. **Legacy reconciliation:** Only existing platform administrators authorized through the established `requirePlatformAdmin` guard may request reconciliation. Eligible failed or uncertain events use fresh provider state, current eligibility/staleness rules, retained auditability, and duplicate-safe commission handling.
10. **Security:** Provider calls occur before the RPC. Tenant relationships are validated server-side, the service-role key remains backend-only, and existing restrictive table RLS remains intact.

## Acceptance Criteria / Success Measures

- A forced subscription or commission failure leaves no falsely completed event, returns non-2xx where provider retry is appropriate, and succeeds on a later delivery without duplicate effects.
- Concurrent identical deliveries result in one subscription transition and at most one commission row.
- Completed duplicates return 200 without changing billing state.
- Stale/out-of-order snapshots cannot regress a newer subscription state.
- Eligible legacy partial events can be reconciled through the real processing path; ineligible or ambiguous events remain visible and unchanged rather than being blindly replayed.
- SQL/integration tests prove transaction rollback, concurrency/idempotency, RPC grants, RLS posture, and reconciliation rules; HTTP tests prove response semantics. Work follows RED → GREEN → REFACTOR and passes the project quality gates.
- Operational evidence distinguishes completed, retryable, terminal, and legacy-uncertain outcomes sufficiently for support to diagnose failures.

## Affected Areas and Dependencies

Affected areas are the MercadoPago webhook Edge Function, billing event/subscription/commission database contract, admin retry/reconciliation flow, migrations/RLS grants, and billing SQL/integration/E2E tests. Delivery depends on coordinated additive database and Edge Function rollout, stable provider event/payment identifiers, and retained access to MercadoPago for fresh reconciliation data.

## Rollout and Rollback

Ship additive schema/RPC support first, then enable the new processing path through a server-controlled switch or versioned contract. Backfill only safe metadata; uncertain legacy rows require explicit reconciliation. Monitor retryable, terminal, completed, stale, and duplicate outcomes before full enablement.

Rollback disables new processing claims or restores the prior handler only when doing so cannot create new suppressed failures. Preserve event history, operational state, and the RPC during rollback; do not drop data-bearing columns or erase reconciliation evidence. Forward recovery is preferred once events use the new contract.

## Risks and Mitigations

- **Incorrect ordering policy:** could regress paid access; require explicit stale-event rules and tests.
- **Locking/contention:** could delay webhook responses; keep the RPC short, deterministic, and free of network calls.
- **Privilege exposure:** could permit unauthorized billing writes; revoke default execution and grant only the intended service role.
- **Legacy ambiguity:** could duplicate or misapply effects; reconcile selectively with fresh provider state and immutable audit evidence.
- **Oversized hot-path change:** could exceed review capacity; split schema/RPC, handler adoption, and reconciliation into independently reviewable slices without weakening the atomic boundary.

## Resolved Product Decisions

The proposal adopts the existing project authority and current behavior as its defaults: paid-access correctness takes priority over immediate acknowledgement; retries occur only through MercadoPago redelivery or on-demand reconciliation; reconciliation is restricted to existing platform administrators through `requirePlatformAdmin`; terminal, retryable, duplicate, missing-subscription, and unknown-status outcomes follow the classifications above; and every replay fetches fresh provider state before the transactional RPC. The first slice provides only the diagnostics needed for these outcomes, not a generic billing operations platform. Altering any of these defaults later requires explicit product review.
