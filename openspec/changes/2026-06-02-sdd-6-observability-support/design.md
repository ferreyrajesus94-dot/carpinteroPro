# SDD-6 Design — Observability & Support

## Status

**design_complete**

## Technical Approach

Implement SDD-6 as a thin shared observability layer plus small UI/support wiring. The design keeps feature-sliced boundaries intact: shared infrastructure lives under `src/shared/`, feature components may import shared support helpers, and edge-function response helpers stay under `supabase/functions/_shared/`.

## Architecture

```text
src/main.tsx
  └─ initReporter()

src/app/App.tsx
  ├─ registerGlobalErrorHandlers() in lifecycle
  ├─ <ErrorBoundary>
  ├─ <QueryClientProvider client={queryClient}>
  └─ <RouterProvider router={router} />

src/shared/lib/errorReporter.ts
  ├─ initErrorReporter(config)
  ├─ captureException(error, context)
  └─ allowlisted safe context only

src/shared/lib/queryClient.ts
  ├─ QueryCache.onError → captureException(...)
  └─ MutationCache.onError → captureException(...)

src/shared/components/ErrorBoundary.tsx
  ├─ componentDidCatch → captureException(...)
  └─ fallback UI: retry/reload + support link

src/shared/lib/supportContact.ts
  └─ reads VITE_SUPPORT_EMAIL and builds safe mailto links

supabase/functions/_shared/response.ts
  ├─ json(...)
  ├─ err(...) existing compatibility
  └─ structuredErr(code, message, status)
```

## Work Units

### Unit 1 — Reporter foundation

Create `src/shared/lib/errorReporter.ts` with:

- `initErrorReporter()` env-gated initialization.
- `captureException(error: unknown, context?: ErrorReportContext)`.
- safe context sanitization/allowlist.
- no-op behavior when DSN is absent or tests run.

Add tests first in `src/shared/lib/errorReporter.test.ts`.

Implementation note: avoid a hard dependency explosion until apply verifies the package. If Sentry is introduced, use the smallest browser package path and keep it behind the wrapper. If dependency install is not desired in the first PR, implement the wrapper as a no-op adapter with documented integration seam and complete the ErrorBoundary/global capture behavior locally.

### Unit 2 — Support contact primitive

Create `src/shared/lib/supportContact.ts` with:

- `getSupportEmail()` / `getSupportHref()` or equivalent.
- no broken link when env is absent.
- encoded `mailto:` subject/body helpers.

Add tests first in `src/shared/lib/supportContact.test.ts`.

Update `.env.example` with `VITE_SUPPORT_EMAIL` and `VITE_SENTRY_DSN` placeholders.

### Unit 3 — ErrorBoundary and global handlers

Create:

- `src/shared/components/ErrorBoundary.tsx`
- `src/shared/lib/registerGlobalErrorHandlers.ts`

Tests:

- `src/shared/components/ErrorBoundary.test.tsx`
- `src/shared/lib/registerGlobalErrorHandlers.test.ts`

Wire:

- `src/main.tsx` initializes reporter.
- `src/app/App.tsx` registers handlers and wraps app in ErrorBoundary.
- `src/app/router.tsx` replaces the static error fallback with the shared recovery UI where appropriate.

### Unit 4 — TanStack Query integration

Modify `src/shared/lib/queryClient.ts` to add `QueryCache` and `MutationCache` `onError` callbacks that call the shared reporter. Preserve existing feature hook `toast.error` behavior.

Add or update `src/shared/lib/queryClient.test.ts` to prove query/mutation errors are reported through the shared reporter.

### Unit 5 — Support UI wiring

Modify:

- `src/app/layouts/AppLayout.tsx`
- `src/features/billing/components/BillingBlockedScreen.tsx`

Tests:

- update `src/app/layouts/AppLayout.test.tsx`
- update `src/features/billing/components/BillingBlockedScreen.test.tsx`

Goal: current copy that says "contactá a soporte" gets a real link when `VITE_SUPPORT_EMAIL` exists, and no broken link when absent.

### Unit 6 — Structured billing edge errors

Modify:

- `supabase/functions/_shared/response.ts`
- `supabase/functions/create-subscription/index.ts`
- `supabase/functions/cancel-subscription/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`

Design:

- keep `err(message, status)` backward-compatible if existing callers rely on `{ error }`.
- add `structuredErr(code, message, status)` returning `{ code, message }` or `{ error: { code, message } }` after apply confirms frontend expectations.
- replace known billing failure paths with stable codes.
- do not expose raw provider payloads, stack traces, signing secrets, or service-role details.

Testing note: the repo has `npm test`/Vitest but no clear Deno edge-function test command. If Deno tests are not already available, verify this unit with focused pure helper tests where possible and document any structural test exception in apply progress.

## TypeScript and Environment Notes

- Add `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL` to Vite env typing if `src/vite-env.d.ts` exists or create it if needed.
- Use `unknown`, `Record<string, unknown>`, and explicit interfaces; no `any`.
- Avoid cross-feature imports. Shared helpers must not import from features.
- Avoid direct DOM manipulation in React components; global `window.addEventListener` belongs in shared initialization helpers, not component internals except lifecycle registration.

## Rollback Plan

- Frontend reporter can be disabled by removing `VITE_SENTRY_DSN` without redeploying code changes that depend on it.
- Support contact can be disabled by unsetting `VITE_SUPPORT_EMAIL`; UI must remain safe.
- ErrorBoundary/global handler changes can be reverted independently from structured edge errors.
- Structured edge error helper is additive if `err()` remains backward-compatible.

## Review Workload Forecast

Estimated changed lines: **450–650** including tests.

Recommended PR split if the budget is exceeded:

1. **PR A:** shared reporter, support contact, ErrorBoundary/global handlers, tests.
2. **PR B:** QueryClient integration + app/router/support UI wiring, tests, env/docs.
3. **PR C:** structured billing edge errors and tests/verification notes.

Given session preflight selected `auto-forecast` with a 400-line budget, implementation should pause before apply if tasks forecast still exceeds budget and user approval is needed for a single larger diff.

## Next Recommended Phase

Proceed to **tasks**.
