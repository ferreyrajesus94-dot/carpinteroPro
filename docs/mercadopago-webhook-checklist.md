# MercadoPago Webhook — Manual Sandbox Checklist

This checklist must be executed in staging before PR 2b is marked complete.

## Prerequisites

- [ ] MercadoPago sandbox account is active and `MERCADOPAGO_ACCESS_TOKEN` is configured in Supabase Function secrets.
- [ ] `MERCADOPAGO_WEBHOOK_SECRET` is configured in Supabase Function secrets.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` are configured in Supabase Function secrets.
- [ ] Staging Edge Function `mercadopago-webhook` is deployed.

## Checklist

### 1. Configure webhook URL

- [ ] In the MercadoPago sandbox dashboard, set the webhook URL to the staging function endpoint:
  `https://<project-ref>.supabase.co/functions/v1/mercadopago-webhook`
- [ ] Subscribe to `preapproval` and `payment` event topics.

### 2. Test event receipt

- [ ] Trigger a test event from the MercadoPago dashboard (e.g., a `preapproval.updated` event).
- [ ] Verify in Supabase Edge Function logs that the function received the request and returned HTTP 200.
- [ ] Verify a row was inserted into `billing_webhook_events` with the correct `provider_event_id`, `event_type`, and `provider_resource_id`.

### 3. Invalid signature must be rejected

- [ ] Send a POST request to the webhook endpoint with a valid payload but an invalid `x-signature` header.
  ```bash
  curl -X POST <webhook-url> \
    -H "x-signature: ts=123,v1=badhash" \
    -H "x-request-id: test-req-1" \
    -d '{"data":{"id":"preapproval_123"},"type":"preapproval.updated"}'
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

### 5. Valid `preapproval.updated` event

- [ ] Ensure a workshop has a subscription row with a known `provider_preapproval_id`.
- [ ] Send a valid webhook event for that preapproval ID with status `authorized`.
- [ ] Expect HTTP 200.
- [ ] Verify `billing_webhook_events` has a new row for this event.
- [ ] Verify the `subscriptions` row updated:
  - `status` → `active`
  - `provider_status` → `authorized`
  - `current_period_starts_at` and `current_period_ends_at` are set.

### 6. Duplicate event idempotency

- [ ] Re-send the exact same valid event (same `x-request-id` and payload) as in step 5.
- [ ] Expect HTTP 200 with body `{ "message": "Already processed" }`.
- [ ] Verify no additional row is inserted into `billing_webhook_events`.
- [ ] Verify the `subscriptions` row was **not** updated a second time (check `updated_at` timestamp).

### 7. Simulated payment failure

- [ ] Send a valid `payment` event for a payment associated with the workshop's preapproval, where the payment status is `rejected`.
- [ ] Expect HTTP 200.
- [ ] Verify `billing_webhook_events` has a new row.
- [ ] Verify the `subscriptions` row updated:
  - `status` → `unpaid` (current app mapping for a rejected MercadoPago payment)
  - `provider_status` → `rejected`.

### 8. Unknown provider resource returns 200 with no mutation

- [ ] Send a valid `preapproval.updated` event for a `provider_preapproval_id` that does **not** exist in the `subscriptions` table.
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

```
