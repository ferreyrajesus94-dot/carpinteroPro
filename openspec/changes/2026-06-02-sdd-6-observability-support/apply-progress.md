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
