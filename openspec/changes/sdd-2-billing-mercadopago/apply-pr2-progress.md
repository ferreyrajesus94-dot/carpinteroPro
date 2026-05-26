# SDD 2 PR 2a Apply Progress — Create/Cancel Edge Functions + Shared Helpers

## Status

`apply_pr2a_ready_for_review` — original PR 2 was split after fresh review because full create/cancel/webhook exceeded the 400-line budget and webhook correctness needed deeper work. This slice keeps only shared helpers plus create/cancel subscription functions, env docs, and pure helper tests. Webhook implementation/checklist moved to PR 2b.

## Scope Delivered

- `supabase/functions/_shared/auth.ts`
  - Verifies Supabase JWT using service-role client.
  - Derives `workshopId` from `profiles`, never request body.
  - Returns authenticated user email for MercadoPago payer data.
  - Raises `AuthError` so function handlers return 401 for auth failures.
- `supabase/functions/_shared/mercadopago.ts`
  - MercadoPago preapproval create/get/cancel request helpers.
- `supabase/functions/_shared/billing.ts`
  - Pure helpers for provider status mapping, HMAC signature verification, and period date calculation. Signature helper is prepared for PR 2b webhook work.
- `supabase/functions/_shared/response.ts`
  - JSON/CORS/preflight helpers.
- `supabase/functions/create-subscription/index.ts`
  - POST-only authenticated function.
  - Derives workshop from JWT/profile.
  - Loads or creates the workshop subscription row via service role.
  - Creates MercadoPago preapproval for ARS 4,990/month.
  - Uses authenticated user email as `payer_email`.
  - Idempotently returns an existing non-cancelled provider preapproval.
- `supabase/functions/cancel-subscription/index.ts`
  - POST-only authenticated function.
  - Derives workshop from JWT/profile.
  - Calls MercadoPago provider cancellation, then updates local subscription to `cancelled`.
  - Period-end cancellation was removed from this slice because provider support must be confirmed before implementation.
- `.env.example`
  - Documents server-only MercadoPago/Supabase function secrets and `APP_ORIGIN`.
- `eslint.config.js`
  - Adds narrow Deno globals override for `supabase/functions/**/*.ts`; does not ignore function files.
- `tests/supabase/functions/billingHelpers.test.ts`
  - 14 pure helper tests.

## Review Fixes Applied From Initial PR 2 Review

- Split over-budget PR 2 into PR 2a and future PR 2b.
- Removed incomplete webhook handler from PR 2a.
- Removed webhook checklist from PR 2a; it belongs with PR 2b.
- Removed local-only period-end cancellation path; current cancellation always notifies MercadoPago provider.
- Create/cancel now return 401 for auth failures via `AuthError`.
- `create-subscription` checks Supabase select/upsert errors and uses authenticated email instead of empty `payer_email`.
- Restored `database.ts` and `eslint.config.js` formatting churn; diffs are minimal.

## TDD Evidence

### RED

Pure helper tests were added before helper implementation and initially failed because `supabase/functions/_shared/billing` did not exist.

### GREEN

Implemented pure billing helpers. Helper tests passed.

### TRIANGULATE

Added edge-case tests:

- End-of-month 30-day interval.
- Empty provider status maps fail-safe to `past_due`.
- Uppercase `ACTIVE` maps to `active`.

### REFACTOR

After reviewer feedback, split webhook out of PR 2a and tightened create/cancel/auth behavior without broad formatting churn.

## Verification Results

| Command | Result |
|---------|--------|
| `npm test` | ✅ 22 files passed, 156 tests passed |
| `npm run lint` | ✅ 0 errors, 6 pre-existing RHF `watch()` warnings |
| `npm run build` | ✅ built successfully |
| `git diff --check` | ✅ no whitespace errors |
| `grep -r "MERCADOPAGO_ACCESS_TOKEN\|SUPABASE_SERVICE_ROLE_KEY\|MERCADOPAGO_WEBHOOK_SECRET" dist/` | ✅ no secrets in bundle |

## Review Workload

PR 2a code/docs diff excluding PR 1 and OpenSpec docs:

| Area | Lines |
|------|-------|
| `.env.example` | +8 |
| `eslint.config.js` | +9 |
| `supabase/functions/_shared/*` | +150 |
| `supabase/functions/create-subscription/index.ts` | +59 |
| `supabase/functions/cancel-subscription/index.ts` | +34 |
| `tests/supabase/functions/billingHelpers.test.ts` | +99 |
| **Total PR 2a** | **~359 lines** |

Under the 400-line review budget.

## Deferred to PR 2b

- `mercadopago-webhook` Edge Function.
- Atomic webhook idempotency via `billing_webhook_events` insert-first handling.
- Payment-event resource handling and unknown provider ID 200/no-mutation behavior.
- Manual MercadoPago sandbox webhook checklist.
- Webhook-specific tests for invalid/missing signature, duplicate event, unknown resource, and payment events.

## Risks

- Edge Functions are not Deno integration-tested in this repo; only pure helper tests run under Vitest.
- `create-subscription` assumes MercadoPago preapproval accepts the authenticated email and configured app origin.
- Immediate cancellation is implemented; period-end cancellation remains a PR 2b/PR 4 legal-copy decision after provider capability is confirmed.

---

# SDD 2 PR 2b Apply Progress — MercadoPago Webhook Edge Function

## Status

`apply_pr2b_ready_for_review`

## Scope Delivered

- `supabase/functions/mercadopago-webhook/index.ts`
  - POST-only webhook handler with CORS preflight support.
  - **Fail-closed signature verification**: reads `MERCADOPAGO_WEBHOOK_SECRET` from Deno env; returns HTTP 401 if secret is missing or empty. Returns HTTP 401 if `x-signature`, `x-request-id`, or timestamp components are missing. Returns HTTP 403 if HMAC-SHA256 signature does not match.
  - **Payment event handling**: branches on `event.type` between `preapproval.*` and `payment.*`. For preapproval events, fetches the preapproval resource directly. For payment events, fetches the payment via new `getPayment` helper, then extracts `preapproval_id` from the payment response. Never trusts the payload alone for status.
  - **Unknown provider/resource IDs**: if MercadoPago API returns 404, or if no `preapproval_id` is found in the payment response, or if no local subscription row matches the `provider_preapproval_id`, the function logs a warning and returns HTTP 200 with no DB mutation (prevents retry storms).
  - **Atomic idempotency**: after verifying signature and locating the subscription, attempts to insert into `billing_webhook_events` using the unique `(provider, provider_event_id)` constraint. If insert fails with PG code `23505` (unique violation), returns HTTP 200 with `{ message: "Already processed" }`. Only if the insert succeeds does the function proceed to update the `subscriptions` row.
  - **Supabase error handling**: all `select`, `insert`, and `update` operations check for errors and return appropriate HTTP 500/502 responses without leaking internals.
- `supabase/functions/_shared/mercadopago.ts`
  - Added `getPayment(id: string)` helper for fetching payment details from MercadoPago `/v1/payments/:id`.
- `supabase/functions/_shared/billing.ts`
  - Hardened `isValidSignature` to explicitly return `false` when `secret` or `signatureHeader` is empty/falsy, preventing `crypto.subtle.importKey` from throwing on zero-length keys.
- `tests/supabase/functions/billingHelpers.test.ts`
  - Added 2 new webhook-specific pure-helper tests:
    - `rejects when secret is empty`
    - `rejects when signature header is empty`
- `docs/mercadopago-webhook-checklist.md`
  - New manual sandbox checklist covering webhook URL configuration, invalid signature rejection, missing secret fail-closed, valid preapproval/payment events, duplicate idempotency, payment failure, unknown resource 200 behavior, and cross-tenant safety.

## Review Blockers Fixed From Original PR 2 Review

1. **Fail-closed signature verification**: webhook now returns 401 if secret is missing/empty, and 401/403 if signature headers are missing or invalid. No mutation occurs without passing verification.
2. **Payment event handling**: webhook now branches on event type. For `payment.*` events it calls `getPayment(dataId)` and extracts `preapproval_id`, instead of incorrectly calling `getPreapproval(dataId)`.
3. **Unknown provider/resource IDs**: provider API 404s and missing local subscriptions both return HTTP 200 with no mutation, preventing MercadoPago retry loops.
4. **Atomic idempotency**: deduplication is now done by inserting into `billing_webhook_events` first. The unique constraint on `(provider, provider_event_id)` guarantees only the first concurrent request succeeds; duplicates get HTTP 200. Subscription mutation only happens after a successful insert.
5. **Supabase insert/update/select errors checked**: all DB operations in the webhook handler check for errors and return safe HTTP 500/502 responses.

## TDD Evidence

### RED

Added two new pure-helper tests before modifying production code:
- `rejects when secret is empty` → failed with `DataError: Zero-length key is not supported` because `isValidSignature` did not guard against empty secrets.
- `rejects when signature header is empty` → passed immediately because the existing `match` regex returned null, but was kept as regression protection.

### GREEN

- Added explicit `if (!secret || !signatureHeader) return false;` guard to `isValidSignature`.
- Implemented `mercadopago-webhook` Edge Function and `getPayment` helper.
- All 16 pure-helper tests pass (14 existing + 2 new).

### TRIANGULATE

- The new signature tests cover the exact failure modes that caused the original PR 2 review blockers (missing secret and missing signature header).
- `mapMercadoPagoStatusToAppStatus` already covers `failure → unpaid`, which is the critical path for payment-failure webhook events.

### REFACTOR

- `isValidSignature` now has a single early-return guard for both missing secret and missing signature header, keeping the rest of the function unchanged.
- Webhook handler uses the existing shared helpers (`response.ts`, `billing.ts`, `mercadopago.ts`) without duplicating logic.
- No formatting churn in unrelated files.

## Fresh Review Fix

- Fresh review found one blocker: the manual checklist expected rejected payments to become `past_due`, while the implemented/tested mapping uses `rejected → unpaid`.
- Fixed `docs/mercadopago-webhook-checklist.md` step 7 to expect `status → unpaid`, aligning the checklist with `mapMercadoPagoStatusToAppStatus` tests and implementation.

## Staging Connection Fixes

- Applied migration `0022_billing_schema.sql` to Supabase staging project `revbbzqjglqnphjrasvv`.
- Remote apply initially exposed migration assertion portability issues: direct `SET LOCAL ROLE authenticated` DML checks failed on remote table privileges. The migration assertions were adjusted to keep the meaningful RLS/privilege checks while applying cleanly locally and remotely.
- Deployed `create-subscription`, `cancel-subscription`, and `mercadopago-webhook` Edge Functions to staging.
- Fixed `mercadopago-webhook` to call `Deno.serve(...)`; the prior default export bundled but did not respond correctly in Supabase Edge Runtime.
- MercadoPago returns `400 Subscription bad request` for some unknown preapproval IDs rather than `404`; the webhook now treats provider `400`/`404` as `200 { message: "Resource not found" }` with no DB mutation.
- MercadoPago Dashboard webhook simulation succeeded with `200 OK` for the configured staging URL.

## Verification Results

| Command | Result |
|---------|--------|
| `supabase db reset` | ✅ local migrations pass after assertion fixes |
| `supabase db push --linked --include-all --yes` | ✅ remote migration `0022` applied |
| `supabase functions list --project-ref revbbzqjglqnphjrasvv` | ✅ create/cancel/webhook active |
| Invalid webhook signature curl | ✅ HTTP 403 `Invalid signature` |
| Valid signature + unknown preapproval curl | ✅ HTTP 200 `Resource not found` |
| MercadoPago Dashboard simulation | ✅ HTTP 200 OK |
| `npm test` | ✅ 22 files passed, 158 tests passed (156 existing + 2 new) |
| `npm run lint` | ✅ 0 errors, 6 pre-existing RHF `watch()` warnings |
| `npm run build` | ✅ TypeScript + Vite production build completed |
| `git diff --check` | ✅ no whitespace errors |
| `grep -r "MERCADOPAGO_ACCESS_TOKEN\|SUPABASE_SERVICE_ROLE_KEY\|MERCADOPAGO_WEBHOOK_SECRET" dist/` | ✅ no secrets in bundle |

## Review Workload

PR 2b code/docs diff excluding PR 1, PR 2a, and OpenSpec docs:

| Area | Lines |
|------|-------|
| `supabase/functions/mercadopago-webhook/index.ts` | +119 |
| `supabase/functions/_shared/mercadopago.ts` | +7 |
| `supabase/functions/_shared/billing.ts` | +1 |
| `tests/supabase/functions/billingHelpers.test.ts` | +16 |
| `docs/mercadopago-webhook-checklist.md` | +77 |
| **Total PR 2b** | **~220 lines** |

Well under the 400-line review budget.

## Risks

- Edge Functions are not Deno integration-tested in this repo; only pure helper tests run under Vitest. The manual sandbox checklist in `docs/mercadopago-webhook-checklist.md` must be executed in staging to confirm end-to-end behavior.
- `getPayment` assumes the MercadoPago API returns `preapproval_id` in the payment JSON. If the field name differs, payment events will not link to subscriptions.
- `providerEventId` uses `x-request-id` from headers. If MercadoPago reuses request IDs across retries, duplicate detection may be affected. Using `x-request-id` is the best available unique identifier from MercadoPago headers.
- The webhook handler returns 200 for unknown resources, which is correct for preventing retries, but it means legitimate misconfigurations (e.g., wrong preapproval ID in DB) will silently succeed without alerting MercadoPago. Logs are the only signal.

## Next Recommended

Fresh review PR 2b. If accepted, proceed to PR 3 frontend billing gate (`BillingGate`, `BillingBlockedScreen`, `AppLayout` integration).
