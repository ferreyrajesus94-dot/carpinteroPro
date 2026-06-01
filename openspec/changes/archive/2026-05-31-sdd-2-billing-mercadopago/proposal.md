# SDD 2 Proposal — Billing + MercadoPago

## Intent

Implement the minimum production-safe billing system required to sell CarpinteroPro: workshop-scoped trial/subscription state, MercadoPago-backed recurring payment flow, verified server-side webhook updates, and an app billing gate that prevents indefinite unpaid access after the approved trial/grace policy.

SDD 1 is complete, so billing can rely on trusted server-derived `workshop_id` via RLS. This proposal is for scope approval only; no implementation should begin until the decisions below are confirmed.

## Proposed Scope

1. **Billing data model**
   - Add a separate `subscriptions` table scoped by `workshop_id uuid NOT NULL` with RLS enabled.
   - Track plan, status, trial dates, provider identifiers, cancellation dates, current period, and timestamps.
   - Enforce/represent one active billing record per workshop where practical.
   - Add SQL/RLS tests for tenant isolation and expected access rules.

2. **Trial lifecycle**
   - Start the 14-day trial when onboarding is completed (`profiles.onboarded_at` is set), not merely at signup.
   - Persist trial start/end in billing state so gates are deterministic and auditable.

3. **MercadoPago integration**
   - Use MercadoPago **Subscriptions / preapproval API** for recurring monthly billing.
   - Create subscription/preapproval requests only from a Supabase Edge Function using backend secrets.
   - Store provider IDs/status in the subscription record; do not expose access tokens to the frontend.

4. **Webhook processing**
   - Add a Supabase Edge Function webhook endpoint for MercadoPago events.
   - Verify webhook authenticity as supported by MercadoPago, fetch/confirm provider state server-side, handle retries/idempotency, and update subscription status.

5. **Billing gate**
   - Add an app-shell gate after auth + onboarding checks.
   - Allow access for active trial/paid states.
   - Apply a hard gate when the trial expires or the subscription becomes unpaid/cancelled, subject to the grace-period decision below.

6. **Settings MVP**
   - Add a billing section in settings showing subscription/trial status and renewal/expiration dates.
   - Provide actions to start payment and request/cancel subscription according to MercadoPago/API capability.
   - Link to MercadoPago-hosted flows where appropriate rather than building full invoice management.

7. **Legal/pricing alignment**
   - Keep `ARS 4,990/mes` and 14-day trial copy aligned with actual behavior.
   - Update terms/privacy only if implementation semantics differ from current copy.

8. **Configuration and tests**
   - Document required env vars in `.env.example` / setup docs: MercadoPago public key if needed, access token, webhook secret/signature material, Supabase function secrets/service role requirements.
   - Add frontend tests for gate/status UI and backend/migration-level tests for billing RLS. Add a manual webhook verification checklist if local automated webhook tests are impractical.

## Non-Goals

- Multiple paid tiers, coupons, promotions, metered billing, seat billing, or annual plans.
- Full invoice/payment-history UI inside CarpinteroPro; MercadoPago dashboard/receipts may be relied on for MVP.
- Multi-user/team billing UX beyond workshop-level subscription ownership.
- Production observability/alerting beyond minimal logs/checklists; that belongs primarily to SDD 5/6.
- Large architecture cleanup unrelated to billing.

## Affected Areas

- `supabase/migrations/` — new numeric migration beginning at `0022`, plus RLS/test artifacts as appropriate.
- `supabase/functions/` — new Edge Functions for subscription creation and webhooks.
- `src/shared/types/database.ts` — billing table/types, preserving `Relationships: []` convention.
- `src/app/layouts/AppLayout.tsx` — billing gate after auth/onboarding.
- `src/features/settings/` — billing status/actions MVP.
- `src/features/landing/data/pricing.ts`, legal pages, and ROI copy only as needed for semantic alignment.
- `.env.example` / docs for MercadoPago and Supabase function secrets.

## Acceptance Criteria

- A workshop receives a deterministic 14-day trial beginning at onboarding completion.
- Unpaid access is blocked after trial/grace expiration; active paid/trial workshops can use the app.
- Subscription state is stored server-side by `workshop_id`, protected by RLS, and cannot be changed cross-tenant from the client.
- MercadoPago subscription/preapproval creation happens server-side; no secret token is exposed in frontend code.
- MercadoPago webhook updates are verified/idempotent enough for retries and stale/duplicate events.
- Settings displays current billing state and supports start/cancel/status MVP behavior.
- Pricing/legal copy matches actual implemented trial, price, cancellation, and processor behavior.
- Tests cover billing status/gate behavior and SQL/RLS isolation; lint/test/build pass before archive.

## Decisions Needed Before Spec/Design/Tasks

1. **Grace policy:** hard block immediately at trial end/payment failure, or allow a short grace period? Recommendation: hard block after a small configurable grace only if business wants payment-retry tolerance; otherwise immediate hard gate for MVP simplicity.
2. **Cancellation semantics:** cancel immediately or at period end? Recommendation: period-end cancellation if MercadoPago supports it cleanly; otherwise clearly state immediate cancellation in UI/legal copy.
3. **MercadoPago credentials/environment:** confirm sandbox/production account readiness and exact webhook signature/secret mechanism to use.
4. **Price authority:** keep ARS 4,990 fixed in app copy for MVP, with MercadoPago plan/preapproval as the operational source for charges.
5. **Blocked-state UX:** decide whether expired users can access settings/billing only, or read-only app data. Recommendation: billing-only access plus logout/support.

## Approved Decisions

Approved after proposal review:

- Proceed from proposal to `spec` / `design` / `tasks` for the MVP scope; do not implement yet.
- Grace policy: **immediate gate** at trial end or unpaid/payment-failed state.
- Cancellation semantics: **period-end cancellation** when MercadoPago supports it cleanly.
- Blocked-state UX: **billing-only access** plus logout/support; no full app or read-only app access for unpaid workshops.

## Risks and Mitigations

- **Critical: payment trust boundary.** Mitigate by using Edge Functions and verified provider lookups/webhooks only; never client-side secret use.
- **High: legal copy ahead of implementation.** Mitigate by aligning terms/privacy/pricing in the same SDD package.
- **High: webhook complexity.** Mitigate with idempotency keys/provider event IDs, provider state fetches, and explicit manual verification checklist.
- **High: RLS/data isolation.** Mitigate with `workshop_id`, RLS enabled, and SQL tests following SDD 1 patterns.
- **Medium: MercadoPago API ambiguity.** Mitigate by confirming preapproval API details before implementation.
- **Medium: review workload.** Full billing likely exceeds the 400 changed-line review budget. Plan stacked work units/PRs: schema+RLS, Edge Functions, app gate, settings/legal/tests.

## Rollback Direction

- Revert frontend billing gate first to restore app access if billing blocks users incorrectly.
- Disable or remove Edge Function routes/secrets if provider integration misbehaves.
- Preserve subscription records for audit unless a migration rollback is explicitly required before production data exists.
- If migration rollback is needed pre-production, drop billing tables/functions from the SDD migration stack and re-run verification.

## Success Criteria

SDD 2 succeeds when a newly onboarded workshop can enter a 14-day trial, start a MercadoPago recurring subscription through server-created provider flow, have provider events update billing state through verified webhooks, see/manage billing status in settings, and be gated correctly when unpaid—while all new billing data remains tenant-isolated and tested.

## Phase Result Envelope

| Field | Value |
|---|---|
| **status** | `proposal_complete` |
| **executive_summary** | Recommend an MVP recurring-billing scope using MercadoPago Subscriptions/preapproval, Supabase Edge Functions for creation/webhooks, a separate RLS-protected `subscriptions` table, trial start at onboarding completion, an app billing gate, and settings status/cancellation MVP. |
| **artifacts** | `openspec/changes/sdd-2-billing-mercadopago/proposal.md` |
| **next_recommended** | Seek approval for the decisions above, then continue to spec/design/tasks before implementation. |
| **risks** | Payment trust boundary, webhook idempotency/verification, legal-copy alignment, tenant isolation, MercadoPago API ambiguity, and review workload exceeding 400 changed lines. |
| **skill_resolution** | `none` |
