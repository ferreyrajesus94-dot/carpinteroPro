## Review

I did **not** write `review-pr2.md` because the task also says **“Do not edit files”**; review-only/no-edit wins.

### verdict
Not ready. PR2 has useful structure, but Edge Function correctness/security has blockers before completion.

### blockers
1. **Webhook accepts unsigned requests if secret is missing**  
   `supabase/functions/mercadopago-webhook/index.ts:14,22` only validates when `secret` is truthy. Missing `MERCADOPAGO_WEBHOOK_SECRET` means unsigned payloads can mutate billing state. Must fail closed.

2. **Webhook cannot correctly handle `payment` events**  
   Spec requires `preapproval.updated` or `payment`; current code always calls `getPreapproval(dataId)` (`mercadopago-webhook/index.ts:39`). For payment event IDs, this is likely wrong and can return 500/retry instead of reconciling safely.

3. **Unknown provider/resource IDs can return 500 instead of 200**  
   If MercadoPago returns 404 in `getPreapproval(dataId)`, `getPreapproval` throws (`_shared/mercadopago.ts:14-18`) before DB lookup, and webhook returns 500 (`mercadopago-webhook/index.ts:77-80`). Spec requires unknown provider IDs to log and return 200 without touching rows.

4. **Webhook idempotency is non-atomic and DB errors are ignored**  
   Code checks duplicate first (`mercadopago-webhook/index.ts:31-37`), then inserts event (`:53-59`), but ignores insert/update errors. Concurrent duplicate deliveries can both pass the check; one insert can fail, yet update still runs (`:74`). Must insert/dedup atomically and only mutate after confirmed first processing.

5. **Cancel period-end path does not notify provider**  
   If `MP_SUPPORTS_PERIOD_END_CANCEL=true`, code only updates local DB (`cancel-subscription/index.ts:28-32`). Spec says period-end cancellation must notify provider.

### concerns
- Auth correctly derives `workshopId` from JWT/profile (`_shared/auth.ts:18-32`), but function errors become 500 instead of 401/403 (`create-subscription/index.ts:60-62`, `cancel-subscription/index.ts:45-47`).
- `create-subscription` ignores `.single()` errors and can create a provider preapproval without successfully linking DB state if no subscription row exists (`create-subscription/index.ts:15-19,43-51`).
- `payer_email: ""` is suspicious for MercadoPago preapproval creation (`create-subscription/index.ts:39`).
- Existing preapproval handling returns any stored `provider_preapproval_id`, including cancelled/stale ones (`create-subscription/index.ts:21-25`).
- Helper tests are meaningful for pure mapping/signature basics, but they do **not** cover webhook dedup, unknown IDs, payment events, DB errors, or create/cancel behavior.

### required_fixes
- Fail closed when webhook secret/signature headers are absent.
- Implement correct event/resource handling for both preapproval and payment notifications.
- Make webhook idempotency atomic: insert event first with unique constraint handling, then mutate only on first successful insert.
- Check and handle all Supabase insert/update/select errors.
- Return 200 without mutation for unknown provider IDs, including provider API 404s.
- Provider notification required for period-end cancellation, or remove that path until supported.
- Return proper 401/403 for auth failures.

### suggested_split_if_any
Yes. Current PR2 target files are ~493 changed/new LOC, above the 400-line budget. Split:
- **PR2a:** shared helpers, auth, create-subscription, cancel-subscription, env docs.
- **PR2b:** webhook verification/idempotency/reconciliation + checklist/tests.

### verification_to_rerun
Already run:
- `npm test -- tests/supabase/functions/billingHelpers.test.ts --run` — passed.
- `npm run lint` — 0 errors, 6 pre-existing warnings.
- `npm run build` — passed.
- dist secret grep — no MercadoPago/service-role secret strings found.

Rerun after fixes:
- helper tests plus new webhook tests for invalid signature, duplicate event, unknown resource, payment event.
- `npm run lint`
- `npm run build`
- dist secret grep
- staging MercadoPago webhook checklist.

### review_workload
Over budget: ~493 changed/new LOC for PR2-relevant files. Recommend split before marking complete.

### scope_check
Scope is mostly correct: Edge Functions, helper tests, `.env.example`, webhook checklist, and ESLint Deno globals only. No frontend gate/settings/legal implementation was added. `.env.example` does not expose browser secrets via `VITE_*`.