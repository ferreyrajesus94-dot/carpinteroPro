# SDD-6 Apply Progress — PR A + PR B

## Status

**PR A + PR B implemented / awaiting fresh review**

## Scope Applied

### PR A (already implemented; kept for traceability)

- shared frontend error reporter wrapper
- support contact helper
- React ErrorBoundary and fallback UI
- global browser error/unhandled rejection handler registration helper
- Vite env typings for `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL`
- `.env.example` placeholders for observability/support variables

### PR B (this run)

- TanStack Query `QueryCache`/`MutationCache` `onError` wiring that routes failures through the shared reporter while preserving `defaultOptions` and existing feature hook `toast.error` behavior.
- `src/main.tsx` now calls `initErrorReporter()` before `createRoot` so DSN-gated reporting is active before the app renders.
- `src/app/App.tsx` registers global `error`/`unhandledrejection` handlers via `registerGlobalErrorHandlers()` in a `useEffect` and wraps the tree in `<ErrorBoundary name="app-root">`.
- `src/app/router.tsx` static `errorElement` replaced with the shared `RouteErrorFallback`, which captures the route error through the shared reporter and reuses the `ErrorBoundaryFallback` recovery UI.
- `src/app/layouts/AppLayout.tsx` profile recovery copy now uses the shared support-contact helper to render an actionable `mailto:` link when `VITE_SUPPORT_EMAIL` is configured; copy and retry/logout buttons remain unchanged.
- `src/features/billing/components/BillingBlockedScreen.tsx` keeps the existing WhatsApp support path and uses the shared support-contact helper so the email link is configurable when `VITE_SUPPORT_EMAIL` is set; primary billing CTAs (Empezar/Actualizar/Suscribirse) and logout button behavior are unchanged.
- Tasks reconciliation: PR A checkboxes were already marked `[x]` in a separate docs commit (`a62bdb7` lineage). PR B checkboxes are now marked `[x]` in this run.

Not implemented yet:

- PR C structured billing edge errors (explicitly out of scope for this run).
- SDD7 work remains untouched.

## Strict TDD Evidence (PR B)

| Cycle | RED evidence | GREEN evidence | Notes |
| --- | --- | --- | --- |
| QueryClient query error | `queryClient.test.ts` initially failed because `./queryClient` did not yet export `QueryCache`/`MutationCache` wiring. | Added `QueryCache`/`MutationCache` to `queryClient.ts`; the test asserts `captureException` is called with `source: "react-query.query"` and the original error. | Real `fetchQuery` path; `defaultOptions` (staleTime 5m, retry 1, gcTime 24h) preserved. |
| QueryClient mutation error | Test triggered `MutationObserver.mutate` to assert the mutation cache `onError` is wired. | Implemented `MutationCache.onError` forwarding to `captureException` with `source: "react-query.mutation"`. | Uses real `MutationObserver`; no real network. |
| QueryClient defaultOptions | Test asserted `queryClient.getDefaultOptions().queries` still matches pre-change shape. | Implementation keeps the original `defaultOptions` block unchanged. | Regression guard for cache privacy/defaults. |
| AppLayout support link | `AppLayout.test.tsx` initially failed because the recovery screen had no `mailto:` link. | Added `getSupportMailtoHref` integration; new test asserts a link with `mailto:soporte@carpinteropro.app` and a second test asserts no broken link when the env is empty. | `vi.stubEnv("VITE_SUPPORT_EMAIL", ...)` is used; the existing "shows profile error recovery screen" test still passes. |
| BillingBlockedScreen support links | Existing test asserted the hardcoded `mailto:hola@carpinteropro.app` link. | Replaced email implementation with `getSupportMailtoHref`; kept the WhatsApp path because the user confirmed Email + WhatsApp; tests cover configured email, absent email, WhatsApp presence, and primary CTA preservation. | Email is configurable; WhatsApp remains available as an existing support channel. |

## Wiring Test Approach (B3)

The SDD-6 design allows keeping global-handler/`ErrorBoundary`/init wiring covered by helper tests when app-level tests would be brittle. Helper coverage used for this slice:

- `src/shared/lib/registerGlobalErrorHandlers.test.ts` proves window listener registration, `error`/`unhandledrejection` capture, and cleanup.
- `src/shared/lib/errorReporter.test.ts` proves `initErrorReporter` DSN-gated initialization and capture sanitization.
- `src/shared/components/ErrorBoundary.test.tsx` proves render crashes are caught and reported.
- `src/shared/components/RouteErrorFallback.test.tsx` proves the route error composition reports `useRouteError()` output with `source: "react-router.error-element"` and wires retry to page reload.

A new top-level `App.test.tsx` was intentionally **not** added to avoid brittle router/QueryClient bootstrap tests; the route-error composition itself is covered by the focused component test.

## Privacy & Security Audit

- `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL` are public browser env vars only; no service role, access tokens, or signing secrets were added.
- `ErrorBoundary` and `RouteErrorFallback` only forward allowlisted context (`source`, `route` with query strings stripped, optional `workshopId`/`userId`) via the existing shared reporter; no raw error stacks or component state are forwarded.
- `BillingBlockedScreen` no longer hardcodes `hola@carpinteropro.app`; the email link is generated only when `VITE_SUPPORT_EMAIL` resolves to a valid email, and the existing WhatsApp support path remains available.
- `queryClient` does not move DB queries or TanStack Query wrappers into `src/shared`; it only wires the existing `QueryCache`/`MutationCache` `onError` callbacks to the shared reporter.

## Fresh Review Fixes (PR B)

Fresh review found three issues: missing focused coverage for `RouteErrorFallback`, missing operations docs for the new frontend env vars, and excessive `AppLayout.tsx` formatting churn. The fixes added `RouteErrorFallback.test.tsx`, documented `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL` in `docs/operations/environment-setup.md`, and restored `AppLayout.tsx` to a minimal semantic diff. The user also confirmed **Email + WhatsApp** for billing support, so WhatsApp remains and the email link is now configurable.

## Validation (PR B)

| Command | Result |
| --- | --- |
| `npm test -- src/shared/lib/queryClient.test.ts src/shared/components/RouteErrorFallback.test.tsx src/app/layouts/AppLayout.test.tsx src/features/billing/components/BillingBlockedScreen.test.tsx` | PASS — 4 files / 30 tests |
| `npm test` | PASS on rerun — 40 files / 261 tests. First full run after review fixes had one transient timeout in `LandingPage.test.tsx`; targeted rerun passed before the full rerun passed. |
| `npm test -- src/features/landing/components/LandingPage.test.tsx` | PASS — 1 file / 24 tests |
| `npm run lint` | PASS (0 errors, 6 pre-existing React Compiler/RHF `watch()` warnings, unchanged from PR A baseline) |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Cross-feature / Secrets Check

- No new cross-feature imports introduced; shared reporter/support contact helpers continue to live under `src/shared/**` and are only consumed by `src/app/**` and `src/features/billing/**` (the latter was already importing shared primitives).
- No real DSNs, no PII, no secret material committed. `.env.example` continues to expose only empty placeholders for `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL`.

## Changed Files for PR B

- `src/shared/lib/queryClient.ts` (modified: add `QueryCache`/`MutationCache` `onError` wiring; keep `defaultOptions`)
- `src/shared/lib/queryClient.test.ts` (new: 3 tests)
- `src/shared/components/RouteErrorFallback.tsx` (new: route error → shared reporter + shared recovery UI)
- `src/shared/components/RouteErrorFallback.test.tsx` (new: focused route error reporting/retry coverage)
- `src/main.tsx` (modified: call `initErrorReporter()` before `createRoot`)
- `src/app/App.tsx` (modified: `useEffect` registers global handlers; wrap tree in `ErrorBoundary`)
- `src/app/router.tsx` (modified: `errorElement` uses `RouteErrorFallback`)
- `src/app/layouts/AppLayout.tsx` (modified: profile recovery screen uses shared support-contact helper)
- `src/app/layouts/AppLayout.test.tsx` (modified: 2 new tests for actionable / no-broken support link)
- `src/features/billing/components/BillingBlockedScreen.tsx` (modified: keep WhatsApp and replace hardcoded email with shared helper)
- `src/features/billing/components/BillingBlockedScreen.test.tsx` (modified: replace "renders support links" test with focused Email + WhatsApp tests)
- `docs/operations/environment-setup.md` (modified: document optional `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL`)
- `openspec/changes/2026-06-02-sdd-6-observability-support/tasks.md` (modified: mark PR B checkboxes `[x]`)

## Next

Run fresh review before deciding whether to apply PR C (structured billing edge errors). PR C remains explicitly out of scope for this run.

---

# SDD-6 Apply Progress — PR C

## Status

**PR C implemented / awaiting fresh review**

## Scope Applied

PR C only — structured billing edge errors. PR A/PR B already committed. SDD7 and SDD9 untouched.

- `supabase/functions/_shared/response.ts` now exports `structuredErr(code, message, status)` while keeping the existing `err(message, status)` helper backward-compatible for any future caller that still needs the legacy `{ error: message }` shape.
- The three billing edge functions now return stable, non-secret error codes for every known failure path:
  - `create-subscription`: `method_not_allowed`, `auth_failed`, `subscription_lookup_failed`, `subscription_upsert_failed`, `checkout_unavailable`.
  - `cancel-subscription`: `method_not_allowed`, `auth_failed`, `subscription_lookup_failed`, `no_provider_subscription`, `subscription_update_failed`, `cancel_failed`.
  - `mercadopago-webhook`: `method_not_allowed`, `webhook_not_configured`, `missing_signature_headers`, `invalid_json`, `missing_data_id`, `invalid_signature`, `provider_fetch_failed`, `subscription_lookup_failed`, `event_record_failed`, `subscription_update_failed`.
- Responses never echo `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, raw provider payloads, raw headers, or stack traces. Provider fetch errors are sanitized into a stable user-safe message; provider debug details stay on the server `console.error` log.
- New test file `tests/supabase-functions/response.test.ts` covers the response helper (json, err backward compat, structuredErr shape, structuredErr default status, leak guard, preflight) plus source-text contract guards that verify the three edge functions call `structuredErr()` with the promised codes and no longer call legacy `err()`.

Not implemented yet:

- SDD7 work remains untouched.
- SDD9 implementation remains untouched.

## Strict TDD Evidence (PR C)

| Cycle | RED evidence | GREEN evidence | Notes |
| --- | --- | --- | --- |
| `structuredErr` shape | `tests/supabase-functions/response.test.ts` initially failed with `TypeError: structuredErr is not a function`. | Added `structuredErr(code, message, status = 500)` to `supabase/functions/_shared/response.ts`; tests now assert `{ error: { code, message } }` and the provided status. | Default status verified separately to 500. |
| Leak guard | Test asserted that `stack`, `headers`, `provider`, and `x-signature` keys are NOT in the response body for a `provider_invalid_response` error. | Implementation never propagates those keys; the test passes without code changes beyond adding `structuredErr`. | Catches accidental future regressions that forward raw provider payloads. |
| `err` backward compatibility | Test asserted `err("Boom", 500)` still returns `{ error: "Boom" }` with status 500. | `err()` remains unchanged; test passes. | No call site was using `{ error }`; the helper is preserved for compatibility only. |
| Code contract | Source-text contract tests inspect the three handler files for promised `structuredErr()` codes and no legacy `err()` calls. | Implementation uses exactly those codes. | Future renames or accidental `err()` reintroduction break the contract test loudly. |

## Deno Test Tooling Exception (C1)

- The repo configures `npm test` / `vitest` for the frontend, but no Deno test runner is configured. The Deno-only handler bodies (`Deno.serve`, `Deno.env.get`, Supabase service client bootstrap) cannot run under Vitest without substantial stubbing of the Deno globals and the Supabase SDK.
- The response helper is the only piece of PR C with a stable, dependency-free public surface, so it is the only piece covered by a focused unit test. The handler bodies are covered by:
  - A grep-driven code review of the codes wired into each handler.
  - A code review for absent `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, raw provider payloads, raw headers, and stack traces in response bodies.
  - A code review confirming every `err()` call in the three handlers has been replaced with `structuredErr()` and that the status codes match the original `err()` calls.
- This structural exception is documented here and in the test file comment so reviewers know what is and is not covered.

## Privacy & Security Audit (PR C)

- The new codes are stable, user-safe Spanish-language messages. The internal `e.message` from a thrown error is no longer echoed back to the user; the server still logs the original message to `console.error` for support/observability.
- No request body, raw provider payload, or stack trace is included in any `structuredErr` response.
- Signing secret (`MERCADOPAGO_WEBHOOK_SECRET`) and service role key are read via `Deno.env.get` and never returned in a response body.
- Headers like `x-signature` and `x-request-id` are read for validation only; only `provider_status` (an external provider enum value) is stored on the subscription row, never the signature itself.

## Validation (PR C)

| Command | Result |
| --- | --- |
| `npm test -- tests/supabase-functions/response.test.ts` | PASS — 1 file / 10 tests |
| `npm test` | PASS — 41 files / 271 tests |
| `npm run lint` | PASS (0 errors, 6 pre-existing React Compiler/RHF `watch()` warnings, unchanged from PR A baseline) |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Cross-feature / Secrets Check (PR C)

- No cross-feature imports introduced; all changes live under `supabase/functions/**` plus a new Vitest test file under `tests/supabase-functions/**`.
- No new dependencies added; the helper reuses the existing `Response` and `Headers` globals available in Deno.
- No real DSNs, secrets, PII, or provider payloads in the diff. Only stable, user-safe Spanish-language messages appear in `structuredErr(...)` arguments.

## Changed Files for PR C

- `supabase/functions/_shared/response.ts` (modified: add `structuredErr(code, message, status)`)
- `supabase/functions/create-subscription/index.ts` (modified: replace known failure paths with stable codes)
- `supabase/functions/cancel-subscription/index.ts` (modified: replace known failure paths with stable codes)
- `supabase/functions/mercadopago-webhook/index.ts` (modified: replace validation/provider failure paths with stable codes)
- `tests/supabase-functions/response.test.ts` (new: 10 focused tests + source-text code contract guards)
- `openspec/changes/2026-06-02-sdd-6-observability-support/tasks.md` (modified: mark PR C checkboxes `[x]`)
- `openspec/changes/2026-06-02-sdd-6-observability-support/apply-progress.md` (modified: append PR C section)

## Next

Run fresh review before deciding whether to advance to SDD7 or archive SDD-6.
