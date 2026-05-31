# MercadoPago Webhook — Manual Sandbox Checklist

This checklist must be executed in staging before PR 2b is marked complete.

## Prerequisites

- [x] MercadoPago sandbox account is active and `MERCADOPAGO_ACCESS_TOKEN` is configured in Supabase Function secrets.
- [x] `MERCADOPAGO_WEBHOOK_SECRET` is configured in Supabase Function secrets and synced from the MercadoPago panel secret without printing it.
- [x] `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are configured in Supabase Function secrets.
- [x] Staging Edge Function `mercadopago-webhook` is deployed.

## Checklist

### 1. Configure webhook URL

- [x] In the MercadoPago sandbox dashboard, set the webhook URL to the staging function endpoint:
  `https://revbbzqjglqnphjrasvv.supabase.co/functions/v1/mercadopago-webhook`
- [x] Subscribe to MercadoPago subscription/payment topics:
  - `subscription_preapproval` for subscription preapproval updates.
  - `subscription_authorized_payment` for recurring authorized-payment updates.
  - `payment` for payment updates.

### 2. Test event receipt

- [x] Trigger a test event from the MercadoPago dashboard (e.g., a `subscription_preapproval` event).
- [x] Verify in Supabase Edge Function logs/panel response that the function received the request and returned HTTP 200.
- [x] Verify a row was inserted into `billing_webhook_events` with the correct `provider_event_id`, `event_type`, and `provider_resource_id`.

Evidence, 2026-05-31:
- MercadoPago panel simulation returned `200 - OK` for `subscription_preapproval` with `data.id = 0e99b66f36614ee8913dd4e37d955e5c`.
- `billing_webhook_events` row inserted with `provider_event_id = 9e6e7dd5-99e1-4829-a289-97979f830e5b`, `event_type = subscription_preapproval`, `provider_resource_id = 0e99b66f36614ee8913dd4e37d955e5c`.

### 3. Invalid signature must be rejected

- [ ] Send a POST request to the webhook endpoint with a valid payload but an invalid `x-signature` header.
  ```bash
  curl -X POST <webhook-url> \
    -H "content-type: application/json" \
    -H "x-signature: ts=123,v1=badhash" \
    -H "x-request-id: test-req-1" \
    -d '{"data":{"id":"preapproval_123"},"type":"subscription_preapproval"}'
  ```
- [ ] Expect HTTP 401 or 403.
- [ ] Verify no new row is inserted into `billing_webhook_events`.
- [ ] Verify no `subscriptions` row is mutated.

### 4. Missing secret must fail closed

- [ ] Temporarily remove `MERCADOPAGO_WEBHOOK_SECRET` from Supabase Function secrets (or set it to an empty string).
- [ ] Send any valid-looking request.
- [ ] Expect HTTP 401 with message "Webhook not configured".
- [ ] Verify no DB mutations occurred.
- [ ] **Restore the secret immediately after this test.**

### 5. Valid `subscription_preapproval` event

- [x] Ensure a workshop has a subscription row with a known `provider_preapproval_id`.
- [x] Send a valid webhook event for that preapproval ID with provider status `authorized`.
- [x] Expect HTTP 200.
- [x] Verify `billing_webhook_events` has a new row for this event.
- [x] Verify the `subscriptions` row updated:
  - `status` → `active`
  - `provider_status` → `authorized`
  - `current_period_starts_at` and `current_period_ends_at` are set.

Evidence, 2026-05-31:
- Subscription `8ac176e9-2f42-4703-8c4b-7c604dab098c` (`workshop_id = 00000000-0000-0000-0000-000000000001`) updated to `status = active`, `provider_status = authorized`, `current_period_starts_at = 2026-05-31 02:36:21.328+00`, `current_period_ends_at = 2026-06-30 02:36:21.328+00`.

### 6. Duplicate event idempotency

- [ ] Re-send the exact same valid event (same `x-request-id` and payload) as in step 5.
- [ ] Expect HTTP 200 with body `{ "message": "Already processed" }`.
- [ ] Verify no additional row is inserted into `billing_webhook_events`.
- [ ] Verify the `subscriptions` row was **not** updated a second time (check `updated_at` timestamp).

### 7. Simulated payment failure

- [ ] Send a valid `payment` or `subscription_authorized_payment` event for a payment associated with the workshop's preapproval, where the provider status is `rejected`.
- [ ] Expect HTTP 200.
- [ ] Verify `billing_webhook_events` has a new row.
- [ ] Verify the `subscriptions` row updated:
  - `status` → `unpaid` (current app mapping for a rejected MercadoPago payment)
  - `provider_status` → `rejected`.

### 8. Unknown provider resource returns 200 with no mutation

- [ ] Send a valid `subscription_preapproval` event for a `provider_preapproval_id` that does **not** exist in the `subscriptions` table.
- [ ] Expect HTTP 200 with body `{ "message": "No subscription found" }`.
- [ ] Verify no `billing_webhook_events` row is inserted (or if inserted, no subscription is mutated).
- [ ] Verify no `subscriptions` row is mutated.

### 9. Provider API 400/404 returns 200 with no mutation

- [ ] Send a valid webhook event for a `data.id` that does not exist in MercadoPago (e.g., an unknown UUID preapproval ID).
- [ ] Expect HTTP 200 with body `{ "message": "Resource not found" }`.
- [ ] Verify no DB mutations occurred.

### 10. Cross-tenant safety

- [ ] Ensure Workshop A and Workshop B both have subscriptions with different `provider_preapproval_id`s.
- [ ] Send a webhook event for Workshop A's preapproval ID.
- [ ] Verify only Workshop A's subscription is updated.
- [ ] Verify Workshop B's subscription is untouched.

## Sign-off

- Tester: ___________________
- Date: ___________________
- All items passed? [ ] Yes  [ ] No — if No, list blockers below:

```
Blockers / Notes:
2026-05-31: Signed MercadoPago panel simulation for `subscription_preapproval` passed and DB mutation was verified. Remaining manual scenarios not yet exercised here: duplicate idempotency, rejected payment/authorized-payment failure path, unknown resource, provider 400/404, and cross-tenant safety.

```
