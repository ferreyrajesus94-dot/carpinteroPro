# Observability and Support Specification

## Purpose

Define the minimum production observability and user-support capabilities required for CarpinteroPro to detect unexpected failures, recover gracefully in the UI, and help users report issues without leaking PII or business data.

## Requirements

### Requirement: Environment-Gated Error Reporter

The application MUST provide a shared error reporting abstraction for frontend runtime errors. External reporting MUST be disabled unless a reporting DSN is configured through a public frontend environment variable. Test and development environments MUST be safe no-op paths by default.

#### Scenario: Production DSN configured

- GIVEN `VITE_SENTRY_DSN` is set in the frontend environment
- WHEN the app initializes
- THEN the configured error reporting client is initialized exactly once
- AND subsequent captured exceptions are forwarded through the shared reporter

#### Scenario: DSN absent

- GIVEN `VITE_SENTRY_DSN` is missing or empty
- WHEN the app initializes and errors are captured
- THEN no external reporting client is initialized
- AND capture calls do not throw

#### Scenario: Test environment safety

- GIVEN tests import the shared reporter
- WHEN reporter functions are called
- THEN no network reporting is attempted
- AND tests can assert captured behavior through mocks or dependency injection

### Requirement: Privacy-Safe Error Context

Error reports MUST include only allowlisted diagnostic context and MUST NOT include PII or business payloads. Allowed context includes app version, route/pathname, error boundary/source, workshop id when already present in auth context, and a non-PII user/session identifier when available.

#### Scenario: Business payload excluded

- GIVEN an application error includes arbitrary metadata containing customer names, emails, quote details, or material data
- WHEN the error is reported
- THEN those payload fields are not forwarded to the external reporter
- AND only allowlisted context keys are included

#### Scenario: Route context included

- GIVEN the browser is on an application route
- WHEN an unexpected error is reported
- THEN the report includes the current route/pathname without query-string secrets

### Requirement: Global Frontend Error Capture

The application MUST capture unexpected browser-level exceptions and unhandled promise rejections through the shared reporter.

#### Scenario: Browser error event

- GIVEN global error handlers are registered
- WHEN `window` receives an `error` event
- THEN the underlying error or message is passed to the shared reporter

#### Scenario: Unhandled rejection event

- GIVEN global error handlers are registered
- WHEN `window` receives an `unhandledrejection` event
- THEN the rejection reason is passed to the shared reporter

#### Scenario: Handler cleanup

- GIVEN global handlers are registered by an initialization helper
- WHEN cleanup is invoked in tests or during reinitialization
- THEN the handlers are removed and duplicate reporting does not occur

### Requirement: React Error Boundary

The app MUST provide a shared ErrorBoundary component that catches React render errors, reports them, and renders a user-friendly recovery UI. The fallback UI MUST be rendered through the shared `ErrorState` feedback wrapper from `src/shared/ui/feedback-state` and MUST consume the Sawdust design tokens (palette-aware, light/dark ready). Token usage and tone MUST match the per-feature `ErrorState` so route-level errors, render-level errors, and per-feature errors are visually consistent.
(Previously: Fallback UI used raw `border-red-200 bg-white text-red-700` and a hardcoded slate-900 button, bypassing the design tokens.)

#### Scenario: Render crash caught

- GIVEN a child component throws during render
- WHEN it is wrapped by the shared ErrorBoundary
- THEN the app renders fallback UI instead of a blank screen
- AND the thrown error is captured through the shared reporter

#### Scenario: Recovery action

- GIVEN the ErrorBoundary fallback UI is visible
- WHEN the user activates the recovery action
- THEN the boundary attempts to recover by resetting its state or reloading/navigating as configured

#### Scenario: Support contact available

- GIVEN `VITE_SUPPORT_EMAIL` is configured
- WHEN the ErrorBoundary fallback UI is visible
- THEN the UI includes an actionable support contact link

#### Scenario: Fallback uses shared feedback wrapper

- GIVEN the ErrorBoundary fallback UI renders
- WHEN assistive tech or a screenshot test inspects the page
- THEN the fallback is rendered via the shared `ErrorState` wrapper using Sawdust tokens
- AND its visual treatment matches the per-feature `ErrorState` in tone, spacing, and contrast
- AND the same fallback renders correctly under `sawdust`, `workshop`, and `graphite` palettes in light and dark modes

### Requirement: Actionable Support Contact

Support references in app-shell/profile/billing/error states MUST provide an actionable support channel when configured. The channel MUST be frontend-safe and documented in `.env.example`.

#### Scenario: Support email configured

- GIVEN `VITE_SUPPORT_EMAIL` is configured
- WHEN auth/profile failure or error fallback UI tells the user to contact support
- THEN the UI provides a `mailto:` link using that configured address

#### Scenario: Support email absent

- GIVEN `VITE_SUPPORT_EMAIL` is not configured
- WHEN support UI renders
- THEN the app does not render a broken link
- AND the copy remains user-safe with a retry/logout/reload path

### Requirement: TanStack Query Error Reporting

The shared QueryClient MUST report unexpected query and mutation errors through the shared reporter while preserving existing local toast behavior in feature hooks.

#### Scenario: Query failure

- GIVEN a query fails and reaches the global QueryCache error handler
- WHEN the error is processed
- THEN the shared reporter captures the error with query-level safe context
- AND feature hook `onError` toast behavior remains unchanged where present

#### Scenario: Mutation failure

- GIVEN a mutation fails and reaches the global MutationCache error handler
- WHEN the error is processed
- THEN the shared reporter captures the error with mutation-level safe context

### Requirement: Structured Billing Edge Errors

Billing edge functions MUST return structured, supportable error responses for known failure paths. User-facing responses MUST include a stable `code` and safe `message`; internal details and secrets MUST NOT be exposed.

#### Scenario: MercadoPago checkout failure

- GIVEN checkout preference creation fails
- WHEN the billing checkout edge function responds
- THEN the response body includes a stable error `code`
- AND includes a user-safe `message`
- AND does not include provider secrets, stack traces, or raw provider payloads

#### Scenario: Webhook validation failure

- GIVEN a MercadoPago webhook request fails validation
- WHEN the billing webhook edge function responds
- THEN the response body includes a stable error `code`
- AND does not leak signing secrets or raw headers

### Requirement: Documentation and Environment Examples

The repository MUST document the new observability/support configuration without including real secrets.

#### Scenario: Environment example updated

- GIVEN `.env.example`
- WHEN reviewed after SDD-6
- THEN it contains placeholders/comments for `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL`
- AND contains no real DSNs, email credentials, or secrets

#### Scenario: Operations docs updated

- GIVEN the production operations docs
- WHEN reviewed after SDD-6
- THEN they explain how to configure frontend error reporting and support contact variables for production

## Verification

### Strict TDD Requirements

Because SDD-6 changes runtime behavior, implementation MUST follow strict TDD from `openspec/config.yaml`:

1. Write failing tests for reporter initialization/no-op behavior, ErrorBoundary fallback/reporting, support-link behavior, QueryClient global error reporting, and structured billing errors.
2. Implement the minimum code to pass.
3. Refactor with tests green.

### Required Commands

Before verification can pass:

- `npm test` MUST pass.
- `npm run lint` MUST pass or document only pre-existing warnings.
- `npm run build` MUST pass.
- `git diff --check` MUST pass.

### Privacy Audit

Changed files MUST be reviewed to confirm:

- No real DSNs, credentials, API keys, or service-role secrets are committed.
- Error reporting context uses an allowlist rather than forwarding arbitrary metadata.
- Error fallback/support UI does not expose user email, customer names, quote data, or material details.
