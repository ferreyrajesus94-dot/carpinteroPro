# SDD 3 Specification — Auth/Profile Hardening

## Purpose

Make auth/profile failures explicit, recoverable, and fail-closed so authenticated users are never left in ambiguous UI states or routed incorrectly.

## Non-Goals

- Full cache/PWA privacy hardening (SDD 4 scope).
- OAuth-specific profile/legal edge cases while OAuth is not enabled.
- Multi-device/session concurrency semantics.
- Database schema or RLS redesign.

## Requirements

### Requirement: Explicit Auth/Profile State Contract

The system MUST expose an explicit auth/profile status contract from `AuthProvider` that distinguishes initialization, unauthenticated state, profile loading, profile ready, profile missing, and profile error.

The system MUST preserve compatibility with existing auth context fields (`session`, `workshopId`, `onboardedAt`, `loading`, `signOut`, `refreshProfile`) during this change.

#### Scenario: Auth state is representable without ambiguity

- GIVEN an app session lifecycle across startup, login, and profile load
- WHEN the auth context is consumed by `AppLayout`
- THEN the consumer can distinguish `initializing`, `unauthenticated`, `profile_loading`, `ready`, `profile_missing`, and `profile_error` without inferring from null fields alone

#### Scenario: Existing consumers remain compatible

- GIVEN a consumer reading current auth context fields
- WHEN SDD 3 changes are applied
- THEN existing fields remain available and functional while the new status contract is added

### Requirement: Profile Query Error Handling

The system MUST treat profile query failures (including network errors, provider errors, and RLS denial responses) as explicit profile error states.

The system MUST NOT silently treat a profile query failure as healthy empty profile data.

#### Scenario: Query error transitions to error flow

- GIVEN an authenticated session
- AND the profile query returns an error
- WHEN profile loading executes
- THEN the system enters retry flow and, if unrecovered, transitions to `profile_error`

### Requirement: Missing Profile Handling

The system MUST treat authenticated session + missing profile row as `profile_missing`.

The system MUST NOT route missing-profile users to onboarding as if they were valid not-onboarded users.

#### Scenario: Missing row shows recovery path

- GIVEN an authenticated session
- AND profile lookup returns no row
- WHEN auth/profile state is resolved
- THEN the app shows recovery UX and blocks protected content
- AND the app does not redirect to onboarding from this state

### Requirement: Valid Not-Onboarded Profile Behavior

The system MUST preserve current onboarding routing for valid profile rows where onboarding is not completed.

#### Scenario: Valid profile with onboarding pending still routes to onboarding

- GIVEN an authenticated session
- AND a valid profile row exists
- AND `onboarded_at` is null
- WHEN `AppLayout` evaluates access
- THEN the user is redirected to onboarding
- AND this state is not classified as `profile_missing` or `profile_error`

### Requirement: Retry Rules

The system MUST perform exactly one automatic retry after an initial profile query error during a load cycle.

The system MUST provide a manual retry action that re-runs profile loading.

The system MUST bound automatic retries to prevent infinite retry loops.

#### Scenario: One automatic retry only

- GIVEN an authenticated session
- AND the first profile query attempt fails
- WHEN retry logic executes
- THEN one automatic retry occurs
- AND no additional automatic retries occur in the same load cycle after the second failure

#### Scenario: Manual retry recovers state

- GIVEN the app is in `profile_error` or `profile_missing`
- WHEN the user triggers manual retry and the profile becomes available
- THEN auth/profile state transitions to `ready`
- AND normal onboarding/billing/app gates resume

### Requirement: Fail-Closed AppLayout and Recovery UX

`AppLayout` MUST fail closed for `profile_error` and `profile_missing` states.

When failed closed, protected workshop content MUST NOT render.

Recovery UX MUST present at least: retry action, logout action, and support guidance.

#### Scenario: Protected routes are blocked on inconsistent profile state

- GIVEN an authenticated user
- AND auth/profile status is `profile_error` or `profile_missing`
- WHEN `AppLayout` renders
- THEN protected app sections are not rendered
- AND a recovery screen is shown with retry, logout, and support guidance

### Requirement: Workshop ID Safety During Errors

The system MUST avoid representing profile failures as healthy-ready states with only empty workshop IDs.

The system SHOULD ensure downstream data hooks can distinguish profile inconsistency from normal ready state.

#### Scenario: Empty workshop id is not treated as healthy-ready profile

- GIVEN profile load has failed or profile is missing
- WHEN auth context is consumed by workshop-dependent hooks
- THEN the state is represented as profile inconsistency (not `ready`)
- AND the app uses recovery/fail-closed behavior instead of silently empty data views

### Requirement: Tests and Validation

The system MUST add test coverage for the new auth/profile contract and failure handling behaviors.

The system MUST include tests covering:
- profile query error handling;
- missing profile handling;
- valid not-onboarded behavior;
- one automatic retry limit;
- manual retry recovery;
- fail-closed `AppLayout` recovery rendering;
- compatibility of existing context fields.

The system MUST pass project verification commands used by SDD verify (`npm test`, `npm run lint`, `npm run build`) before archive.

#### Scenario: Failure-path tests prevent regression

- GIVEN the new SDD 3 tests are in place
- WHEN a change reintroduces silent null-profile handling
- THEN at least one auth/profile or AppLayout test fails

## Success Criteria

- Auth/profile inconsistency is explicit and testable.
- Missing profile rows no longer send users into onboarding loops.
- Query failures are recoverable via bounded retry + manual retry.
- Protected content is fail-closed for inconsistent profile states.
- Existing happy paths remain valid (unauthenticated redirect, valid onboarding redirect, ready app rendering).
