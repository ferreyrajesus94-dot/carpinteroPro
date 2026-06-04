# SDD8 Specification — Architecture Cleanup

## Purpose

Keep CarpinteroPro's feature-sliced architecture enforceable and reviewable: feature code imports only its own feature and shared code, while `src/app/**` owns cross-feature composition.

## Requirements

### Requirement: Shared utilities and contracts have neutral ownership

Cross-feature utilities and read contracts MUST live in `src/shared/**` instead of a feature that is not their true owner.

#### Scenario: Currency formatting is shared

- GIVEN multiple features render monetary values
- WHEN code imports `formatCurrency`
- THEN the import source is `@/shared/lib/formatters`.

#### Scenario: Workshop settings read type is shared

- GIVEN quotes, recipes, and settings need the workshop settings read shape
- WHEN code imports the canonical `WorkshopSettings` read type
- THEN the import source is a shared settings type/API module, not `src/features/quotes/**` or another unrelated feature.

### Requirement: Feature import boundaries are enforced

Feature modules MUST NOT import from other feature modules unless a narrow, documented temporary exception exists for a deferred architecture change.

#### Scenario: Cleaned feature tries to import another feature

- GIVEN a cleaned feature such as dashboard, settings, or onboarding
- WHEN a developer adds a direct import from another feature
- THEN `npm run lint` fails through the feature boundary guardrail.

#### Scenario: App composes features

- GIVEN a route or page workflow needs multiple features
- WHEN cross-feature hooks/components must be wired together
- THEN the composition belongs in `src/app/**` and feature components receive data, callbacks, actions, or slots through props.

### Requirement: Dashboard composition is app-owned

Dashboard feature code MUST receive quote/material data through dashboard-local or shared contracts and MUST NOT import quotes or inventory feature modules directly.

#### Scenario: Dashboard renders cross-domain data

- GIVEN the dashboard displays quote and inventory information
- WHEN the dashboard route is rendered
- THEN `src/app/pages/DashboardPage.tsx` gathers cross-feature data and passes plain props to dashboard components.

### Requirement: Settings and onboarding composition is app-owned

Settings and onboarding feature code MUST receive cross-domain UI/actions through props or callbacks instead of importing unrelated features directly.

#### Scenario: Settings renders billing and reset actions

- GIVEN settings displays billing state and onboarding reset
- WHEN the settings route is rendered
- THEN `src/app/pages/SettingsPage.tsx` wires billing/onboarding dependencies and passes a billing slot plus reset action to `WorkshopSettings`.

#### Scenario: Onboarding creates settings and materials

- GIVEN onboarding saves workshop settings and optional seed materials
- WHEN the onboarding route is rendered
- THEN `src/app/pages/OnboardingPage.tsx` wires settings/inventory mutations and passes callbacks to `OnboardingWizard`.

### Requirement: Core coupling is deferred and explicit

Remaining quotes/CRM/recipes/inventory/settings coupling MUST stay behind narrow lint exceptions until a separate SDD decides the domain workflow architecture.

#### Scenario: Remaining exception is reviewed

- GIVEN an import boundary exception remains in `eslint.config.js`
- WHEN reviewers inspect it
- THEN the exception is narrow, documented as an SDD8 temporary exception, and listed in the SDD8 core coupling follow-up decision.

#### Scenario: Follow-up implementation begins

- GIVEN a future change proposes to remove remaining core coupling
- WHEN implementation is considered
- THEN the team first chooses between app-level orchestration, shared domain contracts, or dedicated workflow modules, and rejects event-bus/global-state shortcuts unless separately justified.
