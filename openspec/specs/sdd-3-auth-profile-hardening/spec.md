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


### Requirement: Referral Code Accepted at Signup

The `signUpWithEmail` API MUST accept an optional `referral_code` in the metadata object. The `handle_new_user` trigger MUST read `raw_user_meta_data->>'referral_code'`, look up the active `referral_codes` row case-insensitively, validate the code's `is_active = true`, block self-referral by comparing `auth.users.email` against `youtubers.contact_email`, and INSERT a `workshop_referrals` row on success. Unknown / inactive / self-referral codes MUST be silently ignored (no error to the user) and MUST log a structured warning.

#### Scenario: Valid active code stamps attribution
- GIVEN `referral_codes` row `code = 'PROMO20'`, `is_active = true`, `youtuber_id = Y1`
- WHEN a new user signs up with `metadata = { referral_code: 'promo20' }`
- THEN `handle_new_user` MUST insert one row into `workshop_referrals` with `referral_code_id`, `youtuber_id = Y1`, and the new `workshop_id`

#### Scenario: Case-insensitive match
- GIVEN the stored code is `PROMO20`
- WHEN a user signs up with `referral_code = 'promo20'` or `'ProMo20'`
- THEN the lookup MUST resolve to the same code

#### Scenario: Unknown code silently ignored
- GIVEN no row in `referral_codes` matches `INVALIDX`
- WHEN a user signs up with `referral_code = 'INVALIDX'`
- THEN no row is inserted into `workshop_referrals`
- AND the trigger MUST log a warning with `reason = unknown_code`
- AND the signup MUST complete normally (workshop + profile created)

#### Scenario: Inactive code silently ignored
- GIVEN a `referral_codes` row with `is_active = false`
- WHEN a user signs up with that code
- THEN no row is inserted into `workshop_referrals`
- AND the trigger MUST log `reason = inactive`

#### Scenario: Self-referral blocked
- GIVEN a YouTuber with `contact_email = 'a@b.com'` and an active code
- WHEN a new user signs up with `email = 'A@B.COM'` and the matching code
- THEN no row is inserted into `workshop_referrals`
- AND the trigger MUST log `reason = self_referral`
- AND the user MUST be created normally

#### Scenario: Missing referral_code key is a no-op
- GIVEN the metadata object does NOT include `referral_code`
- WHEN the user signs up
- THEN the trigger MUST NOT touch `referral_codes` or `workshop_referrals`
- AND the existing profile/workshop creation MUST behave exactly as before

### Requirement: LoginPage Captures URL Referral Code

The `LoginPage` component MUST read the `?ref=CODE` query param via `useSearchParams` and pass it as `referral_code` in the metadata object passed to `signUpWithEmail`. When no `?ref` is present, the metadata MUST NOT include `referral_code`.

#### Scenario: URL with ref populates metadata
- GIVEN the user visits `/login?ref=PROMO20`
- WHEN the registration form is submitted
- THEN the metadata passed to `signUpWithEmail` MUST include `referral_code: 'PROMO20'`

#### Scenario: URL without ref leaves metadata clean
- GIVEN the user visits `/login` (no query string)
- WHEN the registration form is submitted
- THEN the metadata MUST NOT include a `referral_code` key

#### Scenario: Existing auth flow unchanged
- GIVEN no `?ref` is present
- WHEN the user signs up
- THEN the existing `workshop_name`, `terms_accepted_at`, `privacy_accepted_at` metadata MUST be passed exactly as before
- AND no other behavior MUST change

### Requirement: Auth State Preserved With Attribution

The system MUST NOT expose the YouTuber identity, email, or commission to the tenant auth context. The tenant `AuthProvider` MUST NOT add any new fields related to referral attribution. The `workshops` row MUST NOT receive new columns for YouTuber identity (it gets attribution via the separate `workshop_referrals` table, admin-only).

#### Scenario: Auth context remains unchanged
- GIVEN a tenant with an active attribution
- WHEN `useAuth()` is consumed
- THEN the returned object MUST contain only the existing fields (`session`, `workshopId`, `onboardedAt`, `loading`, `signOut`, `refreshProfile`)
- AND no new `referral`, `youtuber`, or `commission` fields MUST be added

#### Scenario: Workshops table receives no new YouTuber columns
- GIVEN the SDD-3 migration that adds referral tables
- WHEN inspected
- THEN the `workshops` table MUST NOT gain columns for YouTuber identity, channel URL, or contact_email
- AND the join happens via `workshop_referrals.referral_code_id` (admin-only) and `subscriptions.referred_by_referral_code_id` (tenant-visible as nullable FK)


## Success Criteria

- Auth/profile inconsistency is explicit and testable.
- Missing profile rows no longer send users into onboarding loops.
- Query failures are recoverable via bounded retry + manual retry.
- Protected content is fail-closed for inconsistent profile states.
- Existing happy paths remain valid (unauthenticated redirect, valid onboarding redirect, ready app rendering).
