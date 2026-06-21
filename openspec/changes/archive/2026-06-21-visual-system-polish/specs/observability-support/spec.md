# Delta for Observability and Support

## MODIFIED Requirements

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
