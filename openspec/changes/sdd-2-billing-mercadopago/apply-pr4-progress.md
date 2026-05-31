# SDD 2 PR4 — Settings Billing + Legal Alignment Apply Progress

## Status
`apply_sandbox_webhook_validated` — focused PR4 code/tests are implemented. MercadoPago MCP webhook configuration was updated, the webhook handler was patched/deployed for actual subscription topic names and MercadoPago's documented signature manifest behavior, and a MercadoPago dashboard simulation delivered a signed `subscription_preapproval` webhook that returned HTTP 200 and mutated staging DB state as expected.

## Scope
- In: billing settings card, settings composition, blocked-screen billing-management reuse, pricing constant, legal/privacy alignment.
- Out originally: backend/schema/RLS, Edge Functions, webhook logic, manual staging MercadoPago run.
- Added during sandbox validation: minimal webhook topic compatibility fix for MercadoPago MCP/documented subscription topics (`subscription_preapproval`, `subscription_authorized_payment`).

## TDD / Review-Fix Evidence
- RED: `npm test -- src/features/billing/components/BillingSettingsCard.test.tsx` initially failed because the card did not exist.
- GREEN/TRIANGULATE: billing card tests cover trial, active, blocked, scheduled-cancel, checkout redirect, cancellation, loading, and errors.
- Review fix: reverted wholesale TSX reformatting and reapplied only semantic legal/settings edits.
- Review fix: `BillingBlockedScreen` now renders `BillingSettingsCard` for the blocked billing-management path.
- Review fix: pricing display/amount moved to `src/shared/constants/billingPricing.ts` and reused by billing + touched landing/ROI code.
- Settings verification: source-level manual check confirms `WorkshopSettings` renders `BillingSettingsCard` immediately after the settings header and before appearance settings, using `useAuth().onboardedAt` + `useSubscription()`.
- Webhook RED: `npm test -- tests/supabase/functions/billingHelpers.test.ts` failed when `classifyMercadoPagoWebhookType` was missing, then failed again for `subscription_authorized_payment` classification.
- Webhook GREEN: `classifyMercadoPagoWebhookType` now maps `subscription_preapproval` to preapproval fetches and `subscription_authorized_payment` to authorized-payment fetches while keeping legacy `preapproval*` and `payment*` support.
- Webhook signature RED/GREEN: MercadoPago panel simulation returned HTTP 403 until `isValidSignature` used `data.id` from URL query params and omitted `id:` from the signed manifest when the query param is absent, matching MercadoPago docs.

## TDD Cycle Evidence

| Cycle | RED evidence | GREEN evidence | Triangulation / refactor |
| --- | --- | --- | --- |
| Billing settings card | `npm test -- src/features/billing/components/BillingSettingsCard.test.tsx` failed before the component existed. | Implemented `BillingSettingsCard`; targeted billing card tests passed. | Expanded coverage across trial, active, blocked, scheduled-cancel, checkout redirect, cancellation confirmation, pending state, and mutation error display. |
| Billing gate / blocked-screen integration | Billing-management reuse was absent from the blocked state; focused tests covered blocked and access-boundary behavior. | `BillingBlockedScreen` renders `BillingSettingsCard`; `BillingGate` and `AppLayout` integration tests pass. | Loading assertions were refactored from `.animate-spin` CSS implementation details to accessible `role="status"` assertions. |
| Pricing constant reuse | Pricing value/copy was duplicated across touched billing and landing code. | Added `src/shared/constants/billingPricing.ts` and reused it from billing + landing/ROI code. | Kept the shared constant small and reviewable instead of introducing a broader pricing abstraction. |
| MercadoPago topic classification | `npm test -- tests/supabase/functions/billingHelpers.test.ts` failed when `classifyMercadoPagoWebhookType` was missing, then failed again for `subscription_authorized_payment`. | Added classification for `subscription_preapproval`, `subscription_authorized_payment`, legacy `preapproval*`, and `payment*`; helper tests passed. | Routed authorized-payment webhooks through `getAuthorizedPayment` to preserve preapproval lookup. |
| MercadoPago signature manifest | MercadoPago panel simulation returned HTTP 403 for a signed `subscription_preapproval` delivery. | `isValidSignature` now signs URL query `data.id` and omits `id:` when the query param is absent; panel simulation returned HTTP 200 after deploy/secret sync. | Added a simulator-signature unit test for the no-query-`data.id` manifest and verified DB mutation in staging. |

## Validation
```bash
npm test -- src/features/billing/components/BillingSettingsCard.test.tsx src/features/billing/components/BillingBlockedScreen.test.tsx src/features/billing/components/BillingGate.test.tsx src/app/layouts/AppLayout.test.tsx # 4 files | 23 passed
npm test        # 28 files | 205 passed
npm run lint    # 0 errors, 6 pre-existing React Compiler warnings
npm run build   # success
npm test -- tests/supabase/functions/billingHelpers.test.ts # 20 passed after webhook topic fix
npm run lint    # 0 errors, 6 pre-existing React Compiler warnings
npm test -- tests/supabase/functions/billingHelpers.test.ts # 21 passed after MercadoPago simulator signature fix
npm test -- src/features/billing/components/BillingGate.test.tsx src/app/layouts/AppLayout.test.tsx # 2 files | 11 passed after accessible loading-status refactor
npm ci && npm audit --audit-level=moderate && npm test && npm run lint && npm run build # CI-equivalent local run passed; audit found 0 vulnerabilities after npm audit fix
```

## Manual Checklist
Partial sandbox evidence recorded on 2026-05-31:
- MercadoPago MCP connected and listed application `2610468449004978` / `CarpinteroPro Staging`.
- MCP `save_webhook` configured production and sandbox URLs to `https://revbbzqjglqnphjrasvv.supabase.co/functions/v1/mercadopago-webhook` with subscribed topics reported as `subscription_authorized_payment`, `subscription_preapproval_plan`, `subscription_preapproval`, and `payment`.
- Initial MCP save attempt with explicit subscription topics returned a false/contradictory invalid-topic error; retry with `payment` succeeded and reported subscription topics as configured.
- MCP `notifications_history` still reports 0 notifications/no deliveries after configuration; no MCP simulate tool is exposed in the current server tool list.
- Supabase secrets list confirms `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_URL` are configured.
- Supabase function list confirmed `mercadopago-webhook` active; deployed version 19 with `--no-verify-jwt` after a temporary version 17 deploy accidentally re-enabled JWT verification and returned `UNAUTHORIZED_NO_AUTH_HEADER`.
- Invalid-signature smoke tests for `subscription_preapproval` and `subscription_authorized_payment` both returned HTTP 403 `{ "error": "Invalid signature" }` with no JWT auth challenge.
- MercadoPago panel simulation initially returned HTTP 403 for `subscription_preapproval` because the handler signed with payload `data.id`; MercadoPago docs say the signature manifest uses URL query param `data.id` and omits `id:` when absent.
- Patched/deployed `mercadopago-webhook` with query-param signature handling and synced the full MercadoPago panel webhook secret into Supabase `MERCADOPAGO_WEBHOOK_SECRET` without printing the secret.
- MercadoPago panel simulation then returned HTTP 200 for `subscription_preapproval` with `data.id = 0e99b66f36614ee8913dd4e37d955e5c`.
- DB verification after the successful simulation:
  - `billing_webhook_events` count: `1`.
  - Inserted event: `provider = mercadopago`, `provider_event_id = 9e6e7dd5-99e1-4829-a289-97979f830e5b`, `event_type = subscription_preapproval`, `provider_resource_id = 0e99b66f36614ee8913dd4e37d955e5c`, `workshop_id = 00000000-0000-0000-0000-000000000001`, `processed_at = 2026-05-31 02:36:21.186+00`.
  - Updated subscription `8ac176e9-2f42-4703-8c4b-7c604dab098c`: `status = active`, `provider_status = authorized`, `current_period_starts_at = 2026-05-31 02:36:21.328+00`, `current_period_ends_at = 2026-06-30 02:36:21.328+00`.
- Supabase function list after secret sync reported `mercadopago-webhook` active at version 21.

Full signed dashboard simulation and DB mutation for `subscription_preapproval` are validated. Remaining optional checklist gaps: duplicate idempotency, rejected payment/authorized-payment failure path, unknown resource, provider 400/404, and cross-tenant safety are not yet manually exercised in the MercadoPago panel.

## Review Workload Forecast
Actual diff after final verification is above the 400-line budget:
- Tracked diff before final spinner refactor: 985 additions / 559 deletions across 16 files.
- Untracked new files/artifacts: `BillingSettingsCard.tsx`, `BillingSettingsCard.test.tsx`, `src/shared/constants/billingPricing.ts`, and OpenSpec progress/verify artifacts.
- PR-relevant changed lines are roughly ~1.9k excluding OpenSpec progress, mostly because legal/settings files were already large touched surfaces.

No `size:exception` is recorded here because the user's preflight preference was "single PR if it fits" with a 400-line budget. Recommended safe path if preserving the budget: split into review slices (CI/audit baseline, billing card + pricing, settings/blocked integration, legal copy, MercadoPago webhook fix/evidence).

## Skill Resolution
`paths-injected` — loaded `work-unit-commits` and `chained-pr`.
