# Billing Webhook Recovery Specification

## Purpose

Ensure that MercadoPago webhook delivery is duplicate-safe and retryable: an accepted event either applies all required local billing effects atomically or is not acknowledged as complete. Preserve paid-access correctness, commission integrity, tenant security, operational diagnosis, and safe recovery of legacy uncertainty.

## Requirements

### Requirement: Atomic billing completion

The system MUST treat the normalized event record, the target subscription mutation, and any applicable referral commission as one completion unit. Completion MUST be observable only after every required local effect succeeds; a failure MUST NOT leave an event marked completed while a required effect is absent.

#### Scenario: Subscription failure rolls back completion

- GIVEN a valid event with a resolvable subscription
- WHEN the subscription mutation fails
- THEN the HTTP response is non-2xx and retryable
- AND the database contains no newly completed event for that attempt
- AND no subscription or commission effect from that attempt is committed

#### Scenario: Commission failure rolls back subscription and completion

- GIVEN an approved authorized payment requiring a referral commission
- WHEN commission recording fails after subscription processing has been attempted
- THEN the HTTP response is non-2xx and retryable
- AND the event is not completed
- AND the subscription mutation and commission effect are rolled back together

#### Scenario: Successful completion commits all effects

- GIVEN valid normalized provider state and all required local relationships
- WHEN processing succeeds
- THEN the event is recorded as completed
- AND the subscription reflects the applicable state and period
- AND the required commission is present when eligible
- AND these effects are visible together in the committed database state

### Requirement: Retryable failure and recovery

The system MUST classify transient provider/network failures, database failures, and incomplete local processing as retryable. Retryable processing MUST return non-2xx and MUST remain eligible for a subsequent provider delivery or authorized reconciliation.

#### Scenario: Redelivery completes an earlier failed attempt

- GIVEN an event whose prior attempt was retryable or incomplete
- WHEN MercadoPago redelivers the same stable event identity with fresh provider state
- THEN processing is attempted again
- AND a successful retry completes the missing local effects atomically
- AND the response is 200

#### Scenario: Retry does not duplicate a commission

- GIVEN a retry for an approved payment whose commission already exists
- WHEN the event is successfully retried
- THEN at most one commission row exists for that provider payment ID
- AND the event can complete without treating the existing commission as a new side effect

### Requirement: Duplicate and concurrency semantics

The system MUST preserve event idempotency by `(provider, provider_event_id)`. A completed duplicate MUST be acknowledged without mutation. An incomplete duplicate MUST remain retryable. Concurrent deliveries of the same event MUST produce exactly one effective application.

#### Scenario: Completed duplicate

- GIVEN the stable event identity is already completed
- WHEN the same event is delivered again
- THEN the HTTP response is 200
- AND the response identifies the delivery as already completed or duplicate
- AND subscription, event, and commission data are unchanged

#### Scenario: Incomplete duplicate

- GIVEN the stable event identity exists but is not completed
- WHEN the same event is delivered again
- THEN it is not acknowledged as a completed duplicate
- AND it either completes the pending work or returns non-2xx with a retryable classification

#### Scenario: Concurrent same-event delivery

- GIVEN two requests for the same stable event identity arrive concurrently
- WHEN both are processed
- THEN exactly one effective subscription transition occurs
- AND at most one commission row exists
- AND the losing request observes completion or receives a retryable non-2xx result if the effective attempt fails
- AND neither request reports successful completion while required effects are incomplete

### Requirement: Fresh provider state and monotonic ordering

Before transactional local processing for redelivery or reconciliation, the system MUST obtain and normalize fresh provider state. The system MUST apply an explicit staleness rule so an older or stale snapshot cannot regress a subscription that already reflects newer provider state. Provider network calls MUST occur outside the local database completion boundary.

#### Scenario: Stale notification cannot regress access

- GIVEN a subscription reflects a newer provider state
- WHEN an older notification snapshot is delivered or reconciled
- THEN the system does not regress the subscription to the older state
- AND the event outcome and diagnostic identify it as stale/ignored or otherwise non-mutating
- AND the newer subscription state remains unchanged

#### Scenario: Fresh state governs retry

- GIVEN a stored event payload is stale or incomplete
- WHEN the event is retried or reconciled
- THEN the processor uses the fresh provider response rather than blindly replaying the stored snapshot
- AND the resulting local mutation follows the current ordering rule

### Requirement: Unknown, missing, and terminal outcomes

The system MUST distinguish retryable, completed, terminal, and uncertain outcomes. Once a tenant is resolved, durable diagnostics for the normalized event MUST be recorded on `billing_webhook_events`. Before tenant resolution, invalid signatures, invalid payloads, unsupported topics, provider responses, and malformed provider resources MUST produce a tested response and a structured, sanitized, correlation-safe platform log without creating a durable event or tenant state. A missing subscription MUST produce a tested response and structured sanitized log without creating an event or tenant state. Provider 400/404 outcomes are terminal acknowledgements; 429 is retryable and returns 503 while preserving safe `Retry-After` when available; provider 5xx and all other 4xx are retryable and return 502. Diagnostics MUST use allowlisted codes only and never raw provider data. Unknown provider status MUST NOT silently grant, revoke, or regress access.

#### Scenario: Invalid or unsupported request is logged without an event

- GIVEN an invalid signature, invalid payload, or unsupported topic prevents tenant resolution
- WHEN the webhook is received
- THEN the response is terminally acknowledged according to the provider contract
- AND a structured platform log records the correlation-safe outcome and allowlisted diagnostic fields
- AND the log contains no secret, raw payload, signature, credential, or other sensitive provider data
- AND no `billing_webhook_events` row, tenant state, or billing side effect is created

#### Scenario: Provider failure before tenant resolution is logged without an event

- GIVEN a provider 400, 404, 429, other 4xx, or 5xx response occurs before tenant resolution
- WHEN the webhook is processed
- THEN 400/404 are terminal acknowledgements, 429 is retryable 503 with safe `Retry-After` when available, and other 4xx/5xx are retryable 502
- AND a structured platform log records an allowlisted correlation-safe diagnostic code and fields
- AND the log contains no raw provider response, raw payload, secret, credential, or sensitive identifier
- AND no `billing_webhook_events` row, tenant state, or billing side effect is created

#### Scenario: Malformed provider resource is logged without an event

- GIVEN the provider response is malformed or cannot yield a safe tenant/subscription identity
- WHEN the webhook is processed
- THEN the response is retryable 502 with diagnostic code `invalid_provider_resource`
- AND a structured, sanitized, correlation-safe pre-tenant platform log is emitted with only allowlisted fields
- AND no raw response, raw payload, secret, or credential is logged
- AND no RPC call, `billing_webhook_events` row, tenant state, or billing side effect is created

#### Scenario: Missing subscription

- GIVEN provider state is valid but no matching subscription exists
- WHEN the webhook is processed
- THEN the response is acknowledged as a diagnosed non-applicable outcome
- AND a structured, sanitized log records the correlation-safe missing-subscription outcome with allowlisted fields
- AND no `billing_webhook_events` row, tenant, subscription, or commission row is created
- AND the outcome remains distinguishable from completed billing processing

#### Scenario: Unknown provider status

- GIVEN provider state contains an unrecognized status after tenant resolution
- WHEN it is normalized
- THEN no silent access-regressing mutation occurs
- AND the event is recorded as explicitly unknown/uncertain for diagnosis or reconciliation
- AND the response classification is observable and does not claim successful billing completion

### Requirement: Real platform-admin reconciliation

The system MUST provide bounded reconciliation for eligible failed or uncertain events through the established `requirePlatformAdmin` authorization guard. Reconciliation MUST invoke the real processing/recovery path, fetch fresh provider state, apply the same idempotency and ordering rules, and retain an auditable result. It MUST NOT create only a synthetic retry marker.

#### Scenario: Authorized eligible reconciliation

- GIVEN an existing failed or uncertain event and a caller authorized as a platform administrator
- WHEN reconciliation is requested
- THEN the system fetches fresh provider state and attempts real processing
- AND the original event's operational outcome is updated consistently with the result
- AND successful reconciliation applies effects atomically and duplicate-safely
- AND the response exposes whether processing completed, remains retryable, or remains uncertain

#### Scenario: Unauthorized reconciliation

- GIVEN a caller who is not authorized by `requirePlatformAdmin`
- WHEN reconciliation is requested
- THEN the request is rejected
- AND no event, subscription, commission, or reconciliation evidence is mutated

#### Scenario: Ineligible or ambiguous legacy event

- GIVEN a legacy event has insufficient evidence, ambiguous identity, or fails current eligibility/staleness rules
- WHEN reconciliation is requested
- THEN it is not blindly replayed
- AND it remains visible with an explicit legacy-uncertain or ineligible diagnostic
- AND no billing side effect is applied

### Requirement: Legacy uncertainty and compatibility

Existing event rows MUST remain readable during rollout. New provider-preapproval, provider-resource-kind, and freshness metadata columns MAY initially be NULL on contract-v1 rows. The system MUST NOT infer that every legacy row is fully completed solely because it was inserted under the previous contract. A one-time transition MAY populate those metadata columns only after a fresh provider fetch resolves a subscription whose existing `workshop_id` exactly equals the legacy event's existing `workshop_id` and whose stored provider/resource identity is compatible. Existing non-NULL immutable metadata MUST match the fresh provider identity and resource kind. Any mismatch or ineligible/ambiguous case MUST remain `legacy_uncertain` with no mutation. Ownership MUST never be changed. Safe metadata MAY be backfilled only under these rules; uncertain legacy rows MUST require explicit evidence or reconciliation before being treated as complete.

#### Scenario: Legacy row without partial-failure evidence

- GIVEN a legacy event has sufficient evidence that its required effects were completed
- WHEN it is inspected or encountered as a duplicate
- THEN it remains readable and is not mutated merely by inspection
- AND its compatibility classification is distinguishable from a newly processed completed event

#### Scenario: Safe legacy metadata enrichment

- GIVEN a contract-v1 event has NULL new metadata columns
- AND a fresh provider fetch resolves a subscription
- AND the resolved subscription's existing `workshop_id` exactly equals the legacy event's existing `workshop_id`
- AND the stored provider/resource identity is compatible with the fresh provider identity and resource kind
- WHEN the one-time transition enriches the legacy row
- THEN it MAY populate provider preapproval ID, resource kind, and freshness metadata
- AND it MUST NOT change ownership or the existing workshop ID

#### Scenario: Legacy enrichment rejects mismatch or ineligibility

- GIVEN a legacy event has an existing non-NULL immutable metadata value that mismatches fresh provider identity/resource kind, or the fresh subscription is ineligible or ambiguous
- WHEN the one-time transition evaluates enrichment
- THEN the row remains `legacy_uncertain`
- AND no metadata, workshop ownership, subscription, tenant, or commission state is mutated

#### Scenario: Legacy row with uncertainty

- GIVEN a legacy event may have been recorded before one or more effects completed
- WHEN it is inspected or reconciled
- THEN it is classified as legacy-uncertain
- AND it is not falsely acknowledged as safely complete without reconciliation evidence

#### Scenario: Rollout compatibility and rollback

- GIVEN additive schema/RPC support is deployed before the new handler is enabled
- WHEN the server-controlled switch or versioned contract is disabled
- THEN existing event history and recovery metadata remain readable
- AND no data-bearing state or reconciliation evidence is dropped
- AND rollback does not introduce new suppressed failures for events using the new contract

### Requirement: Restrictive database security

The system MUST preserve restrictive RLS and service-role-only write behavior for billing tables. Any privileged processing RPC MUST be inaccessible to `PUBLIC`, `anon`, and ordinary authenticated callers, and MUST validate event, subscription, workshop, and payment relationships server-side rather than trusting caller-supplied tenant authority.

#### Scenario: RPC grants are restricted

- GIVEN database privileges are inspected for the processing RPC
- WHEN access is evaluated for `PUBLIC`, `anon`, and `authenticated`
- THEN those principals cannot execute the privileged operation
- AND only the intended backend execution principal can invoke it

#### Scenario: RLS posture remains restrictive

- GIVEN an anonymous or ordinary authenticated caller attempts billing writes or cross-tenant access
- WHEN the request is evaluated
- THEN RLS/privilege enforcement rejects the operation
- AND service-role/backend processing remains the only supported write path

#### Scenario: Relationship validation rejects mismatched inputs

- GIVEN a processing request supplies identifiers that do not resolve to the same authorized billing relationship
- WHEN the local completion operation is evaluated
- THEN it fails without committing billing effects
- AND the failure is retryable or terminal according to its cause, never silently applied to another tenant

### Requirement: Operational diagnostics

The system MUST retain enough durable and externally observable diagnostics to distinguish completed, retryable, terminal, duplicate, stale, missing-subscription, unknown-status, and legacy-uncertain outcomes, including the latest failure reason and attempt/reconciliation context where applicable. Durable event diagnostics MUST apply only after tenant resolution and MUST be stored with the tenant-resolved `billing_webhook_events` record. Pre-tenant failures MUST use structured, sanitized, correlation-safe platform logs with allowlisted fields; this change MUST NOT add a pre-tenant database diagnostics table, global-tenant exception, fake workshop, nullable `workshop_id` workaround, or external observability dependency. Log retention and alert infrastructure are outside this SDD and belong to production observability. No diagnostic channel MUST expose secrets, service-role credentials, raw payloads, raw provider responses, signatures, or other sensitive data.

#### Scenario: Retryable tenant-resolved failure is diagnosable

- GIVEN a local or provider failure occurs after tenant resolution
- WHEN support inspects the tenant-resolved event diagnostics
- THEN the event identity, outcome class, failure category, correlation-safe attempt context, and latest failure reason are available on `billing_webhook_events`
- AND the event is distinguishable from a completed event

#### Scenario: Pre-tenant log fields are sanitized and allowlisted

- GIVEN a signature, payload, topic, provider resource, or provider response fails validation before tenant resolution
- WHEN the platform log is emitted
- THEN it contains only allowlisted structured fields needed for correlation and outcome diagnosis
- AND it excludes raw payload/response content, secrets, credentials, signatures, and sensitive identifiers
- AND it does not create or require durable tenant/event state

#### Scenario: Diagnostic listing reflects real reconciliation

- GIVEN an admin reconciles an event
- WHEN the support diagnostics are read
- THEN the result and reconciliation context are visible against the original event
- AND a synthetic audit row alone is insufficient to represent recovery

### Requirement: Strict TDD and acceptance evidence

Changes to runtime behavior MUST be developed with RED → GREEN → REFACTOR evidence. Schema, RLS, grant, or RPC changes MUST include SQL/pgTAP or migration-level assertions; HTTP behavior MUST include HTTP/integration coverage; the primary project test command MUST pass.

#### Scenario: Required evidence is present

- GIVEN this change modifies webhook, database, RPC, RLS, or reconciliation behavior
- WHEN the change is verified
- THEN tests prove rollback, retry, duplicate/concurrency, ordering, outcome classification, reconciliation authorization, grants, and RLS posture
- AND strict TDD HTTP tests prove pre-tenant invalid signature/payload/topic, provider 400/404/429/other-4xx/5xx, malformed-resource, and missing-subscription responses and sanitized no-event platform logging
- AND strict TDD reconciliation tests prove safe legacy enrichment only for exact workshop ownership and compatible immutable metadata, with mismatch/ineligible cases remaining `legacy_uncertain` and unmutated
- AND `npm test`, coverage, lint, and build pass according to project gates
- AND no schema/RPC change is accepted without its SQL assertions

## Non-goals

- Generic billing architecture or UI redesign.
- MercadoPago subscription creation, pricing, payout execution, or unrelated admin workflows.
- Holding database locks while calling MercadoPago.
- A background worker, retry-latency SLA, or blind replay of all historical events.
- A pre-tenant diagnostics table, global tenant exception, fake workshop, nullable `workshop_id` workaround, or external observability dependency in this change.
- Log retention policy, alerting, dashboards, and production observability infrastructure; these are outside this SDD.
- Relaxing RLS/service-role controls or exposing privileged processing to client callers.

## Acceptance Traceability

- **Atomicity and retry safety:** Proposal Intent, Business Rules 2 and 8, Acceptance Criteria 1.
- **Duplicates and concurrency:** Business Rules 3 and 6, Acceptance Criteria 2–3.
- **Fresh ordering:** Business Rule 7, Acceptance Criterion 4.
- **Outcome classification and diagnostics:** Business Rules 4–5, Acceptance Criterion 7; tenant-resolved durability is covered by the Unknown, Missing, and Terminal Outcomes and Operational Diagnostics requirements.
- **Pre-tenant safety and observability:** Business Rules 4–5, Acceptance Criterion 7; structured sanitized logging, no-event/no-tenant-state behavior, and explicit observability non-goals are covered by the Unknown, Missing, and Terminal Outcomes, Operational Diagnostics, and Strict TDD requirements.
- **Real reconciliation and legacy uncertainty:** Business Rule 9, Acceptance Criterion 5; safe exact-workshop, compatible-identity enrichment and immutable ownership are covered by the Legacy Uncertainty and Compatibility requirement.
- **Security:** Business Rule 10, Non-goals, and Acceptance Criterion 6.
- **Rollout/rollback compatibility:** Proposal Rollout and Rollback, plus legacy compatibility requirement.
- **Strict TDD evidence and reviewability:** Proposal Acceptance Criteria 6 and review-budget risk mitigation; HTTP sanitization/no-event and legacy enrichment scenarios are explicit evidence obligations.
