# SDD-6 Tasks — Observability & Support

## Status

**tasks_complete**

## Delivery Strategy

**Recommended:** chained PRs / staged apply.

Forecast: **450–650 changed lines** with strict TDD tests. This exceeds the 400-line review budget selected for the session. Keep work split into the review units below unless the user explicitly approves one larger apply.

## Strict TDD Contract

`openspec/config.yaml` declares strict TDD and test command `npm test`.

For every runtime behavior task:

1. RED — add/adjust a failing test first.
2. GREEN — implement the minimum code.
3. TRIANGULATE — add edge case coverage where needed.
4. REFACTOR — clean with tests green.

Record evidence in `apply-progress.md`.

---

## PR A — Shared frontend observability foundation

Estimated changed lines: **230–320**

### A1. Reporter tests RED

- [x] Create `src/shared/lib/errorReporter.test.ts`.
- [x] Test DSN-present initialization behavior.
- [x] Test DSN-absent no-op behavior.
- [x] Test `captureException` does not throw for `unknown` inputs.
- [x] Test context allowlist excludes arbitrary PII/business payload keys.

### A2. Reporter implementation GREEN

- [x] Create `src/shared/lib/errorReporter.ts`.
- [x] Define explicit types for report context; no `any`.
- [x] Implement env-gated initialization.
- [x] Implement safe context allowlist.
- [x] Keep external reporting no-op unless configured.
- [x] Add/adjust Vite env typing for `VITE_SENTRY_DSN`.

### A3. Support contact tests RED

- [x] Create `src/shared/lib/supportContact.test.ts`.
- [x] Test configured `VITE_SUPPORT_EMAIL` produces a safe `mailto:` href.
- [x] Test missing support email returns no broken link.
- [x] Test subject/body encoding if helper supports it.

### A4. Support contact implementation GREEN

- [x] Create `src/shared/lib/supportContact.ts`.
- [x] Add/adjust Vite env typing for `VITE_SUPPORT_EMAIL`.
- [x] Update `.env.example` with placeholder/comment for `VITE_SUPPORT_EMAIL` and `VITE_SENTRY_DSN`.

### A5. ErrorBoundary tests RED

- [x] Create `src/shared/components/ErrorBoundary.test.tsx`.
- [x] Test render crash is caught and fallback appears.
- [x] Test reporter is called when child render fails.
- [x] Test recovery action resets/reloads according to implementation.
- [x] Test support link is shown only when configured.

### A6. ErrorBoundary implementation GREEN

- [x] Create `src/shared/components/ErrorBoundary.tsx`.
- [x] Use a functional exported fallback component if useful, but ErrorBoundary itself may be class-based because React error boundaries require lifecycle methods.
- [x] Report errors through shared reporter.
- [x] Render accessible fallback UI with recovery action and optional support link.

### A7. Global handler tests RED

- [x] Create `src/shared/lib/registerGlobalErrorHandlers.test.ts`.
- [x] Test browser `error` event reports via reporter.
- [x] Test `unhandledrejection` reports via reporter.
- [x] Test cleanup removes handlers and prevents duplicate reporting.

### A8. Global handler implementation GREEN

- [x] Create `src/shared/lib/registerGlobalErrorHandlers.ts`.
- [x] Register `window.addEventListener('error', ...)`.
- [x] Register `window.addEventListener('unhandledrejection', ...)`.
- [x] Return cleanup function.

---

## PR B — App/query/support wiring

Estimated changed lines: **170–250**

### B1. QueryClient tests RED

- [x] Create or update `src/shared/lib/queryClient.test.ts`.
- [x] Test QueryCache `onError` routes query errors through the reporter.
- [x] Test MutationCache `onError` routes mutation errors through the reporter.
- [x] Ensure tests do not require real network/Supabase calls.

### B2. QueryClient implementation GREEN

- [x] Modify `src/shared/lib/queryClient.ts` to add `QueryCache` and `MutationCache` global `onError` handlers.
- [x] Preserve existing `defaultOptions` and cache privacy behavior.
- [x] Avoid import cycles; reporter imports must stay shared-only.

### B3. App/router wiring tests RED

- [x] Add focused tests if existing app/router tests can cover the wrapper behavior.
- [x] Prove global handlers are registered and cleaned up by the app shell, or keep this covered by helper tests if App-level tests would be brittle.

### B4. App/router wiring GREEN

- [x] Modify `src/main.tsx` to call reporter initialization before render.
- [x] Modify `src/app/App.tsx` to register global handlers and wrap app content in ErrorBoundary.
- [x] Modify `src/app/router.tsx` to replace static route fallback with shared recovery UI or shared fallback component.

### B5. Auth/app-shell support tests RED

- [x] Update `src/app/layouts/AppLayout.test.tsx` to assert actionable support link when configured.
- [x] Assert no broken support link when support email is absent.

### B6. Auth/app-shell support implementation GREEN

- [x] Modify `src/app/layouts/AppLayout.tsx` profile recovery copy to use shared support-contact helper.
- [x] Keep retry/logout actions unchanged.

### B7. Billing support tests RED

- [x] Update `src/features/billing/components/BillingBlockedScreen.test.tsx` to use env-configurable support link.
- [x] Preserve current billing CTA expectations.

### B8. Billing support implementation GREEN

- [x] Modify `src/features/billing/components/BillingBlockedScreen.tsx` to use shared support-contact helper instead of hardcoded email.
- [x] Keep WhatsApp link only if product wants it and it does not conflict with configured support email.

### B9. Docs/env update

- [x] Update production operations docs or README section with observability/support env configuration.
- [x] Audit `.env.example` for no real DSNs/secrets.

---

## PR C — Structured billing edge errors

Estimated changed lines: **80–140**

### C1. Response helper tests RED

- [x] Determine whether Deno tests already run in project tooling.
- [x] If feasible, add tests for `supabase/functions/_shared/response.ts` structured error helper.
- [x] If Deno tests are not available, add a documented structural exception in `apply-progress.md` and verify with code review plus `npm test` for frontend changes.

### C2. Response helper implementation GREEN

- [x] Modify `supabase/functions/_shared/response.ts` to add `structuredErr(code, message, status)`.
- [x] Keep existing `err(message, status)` backward-compatible unless all callers are migrated.

### C3. Edge function structured errors

- [x] Update `supabase/functions/create-subscription/index.ts` known failure paths with stable codes.
- [x] Update `supabase/functions/cancel-subscription/index.ts` known failure paths with stable codes.
- [x] Update `supabase/functions/mercadopago-webhook/index.ts` validation/provider failure paths with stable codes.
- [x] Ensure responses do not include secrets, raw provider payloads, stack traces, or raw headers.

---

## Verification Tasks

- [x] Run `npm test`.
- [x] Run `npm run lint` and document any pre-existing warnings.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Audit changed files for secrets/DSNs/PII leakage.
- [x] Confirm no cross-feature imports were introduced.
- [x] Record TDD evidence and command output in `apply-progress.md`.

## Review Workload Decision

Because the forecast exceeds 400 changed lines, **do not apply all tasks as one diff without explicit user approval**.

Recommended next action: apply **PR A only** first, then verify and review before continuing to PR B/C.
