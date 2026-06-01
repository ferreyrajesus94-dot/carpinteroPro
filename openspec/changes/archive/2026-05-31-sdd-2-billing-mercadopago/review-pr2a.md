# SDD 2 PR 2a Review — Create/Cancel Edge Functions

Verdict: accepted for PR 2a.

Fresh review found no blockers.

Confirmed:

- PR 2a split is coherent and under the 400-line budget (~359 lines excluding PR1/OpenSpec docs).
- Auth validates Bearer JWT through Supabase and derives `workshop_id` from `profiles`, never request body.
- Create/cancel functions are POST-only and handle OPTIONS preflight.
- Auth failures return 401 through `AuthError` handling.
- Service role and MercadoPago secrets remain server-side only.
- Provider cancellation is notified before local cancellation update.
- Supabase select/upsert/update errors are checked.
- ESLint config adds Deno globals narrowly for `supabase/functions/**/*.ts`; it does not ignore function files.
- Webhook endpoint and checklist are absent from PR 2a and deferred to PR 2b.

Concerns, non-blocking:

- Edge Functions are not Deno integration-tested in this repo; PR 2b/staging checklist must cover provider behavior before production.
- Non-auth errors currently return raw `Error.message`; consider generic 500 messages later.

Deferred to PR 2b:

- `mercadopago-webhook`
- webhook signature fail-closed behavior
- payment event handling
- unknown provider/resource 200/no-mutation handling
- atomic webhook idempotency
- sandbox webhook checklist/tests
