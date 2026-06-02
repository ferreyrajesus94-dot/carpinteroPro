# SDD-6 Proposal — Observability & Support

## Status

**proposal_complete**

## Problem

CarpinteroPro can now be deployed and operated after SDD-5, but production failures are still hard to detect, diagnose, and support. Current behavior mostly shows local toast messages or static fallback screens. Unexpected frontend crashes, unhandled promise rejections, and billing edge failures do not produce a supportable error trail. Some UI copy asks users to contact support without providing an actionable channel.

## Goals

- Detect unexpected frontend failures in production without leaking PII or business data.
- Keep the app usable when React render errors happen by adding a user-friendly ErrorBoundary.
- Centralize unexpected error reporting while preserving existing feature-specific toast UX.
- Make support contact paths actionable from auth/profile/billing/error fallback states.
- Make billing edge-function failures easier to correlate and support through structured error responses.

## Scope

### Included

1. **Shared error reporting wrapper**
   - Add a shared reporter abstraction under `src/shared/lib/`.
   - Use Sentry-compatible browser reporting by default, initialized only when `VITE_SENTRY_DSN` is configured.
   - Provide a no-op test/dev path so local and test runs do not send external reports.
   - Allow safe context only: route, app version, workshop id, and non-PII user/session identifiers when already available.

2. **Global frontend error capture**
   - Register `window.error` and `window.unhandledrejection` handlers in the app entry path.
   - Add central TanStack `QueryCache` / `MutationCache` `onError` reporting for unexpected query/mutation failures.
   - Do not remove existing per-hook `toast.error` calls.

3. **React ErrorBoundary**
   - Add a reusable shared ErrorBoundary component.
   - Wrap the app/router at a coarse level.
   - Replace static route error fallback with a recovery UI that offers retry/reload and support contact.

4. **Actionable support contact**
   - Add a small shared support-contact primitive or constants.
   - Use `VITE_SUPPORT_EMAIL` as the minimum viable support channel, defaulting only to display-safe fallback copy when absent.
   - Update profile/auth and app-shell failure states that currently say "contactá a soporte" without a link.

5. **Structured billing edge errors**
   - Normalize billing edge-function error responses with stable `code`, user-safe `message`, and optional support/debug identifier.
   - Keep external Deno/Sentry reporting out of this SDD unless it remains small and testable.

### Excluded

- Product analytics, usage telemetry, and funnel tracking.
- Core Web Vitals/performance monitoring.
- In-app ticketing system or support inbox.
- Status page/uptime monitoring.
- Database monitoring beyond Supabase-native operational tooling.
- Broad refactors of feature hooks solely to remove existing toast patterns.

## Acceptance Criteria

- [ ] Production error reporting is initialized only when `VITE_SENTRY_DSN` is present.
- [ ] Tests prove dev/test paths are no-op and do not call external reporting.
- [ ] Unhandled browser errors and promise rejections route through the shared reporter.
- [ ] React render errors are caught by a shared ErrorBoundary with recovery UI.
- [ ] Error fallback UI includes actionable support contact when `VITE_SUPPORT_EMAIL` is configured.
- [ ] TanStack Query global errors are reportable without removing per-hook toast behavior.
- [ ] Error context excludes PII and business payloads by default.
- [ ] Billing edge functions return structured supportable error bodies for known failure paths.
- [ ] `.env.example` and docs include `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL` placeholders without real secrets.
- [ ] `npm test` passes with focused unit tests for reporter, ErrorBoundary, support link, and structured edge errors.

## Review Strategy

The expected change spans shared frontend infrastructure, app-shell fallback UI, support copy, tests, and a small edge-function response normalization. Forecast: **350–550 changed lines** depending on test size and edge-function scope.

Delivery strategy: **auto-forecast**.

- Keep one PR if tasks remain below the 400-line review budget.
- Split into chained PRs if implementation exceeds 400 changed lines:
  1. Frontend reporter + ErrorBoundary + tests.
  2. Support-contact wiring + docs/env.
  3. Billing edge structured errors + tests.

## Risks

| Risk | Mitigation |
| --- | --- |
| Privacy leak through error payloads | Central wrapper with allowlisted context only; tests assert PII-like payloads are not forwarded. |
| Noise from expected user errors | Report global/unexpected errors and query failures centrally; keep validation/user-flow errors as toasts. |
| SDK bundle overhead | Use a thin wrapper and initialize external SDK only when DSN exists. |
| Support email not final | Make channel env-configurable through `VITE_SUPPORT_EMAIL`; no hardcoded real mailbox required. |
| Edge-function scope grows into logging platform | Only structured error bodies are required; external Deno reporting is a follow-up. |

## Next Recommended Phase

Proceed to **spec**.
