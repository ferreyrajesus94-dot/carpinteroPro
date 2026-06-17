# SDD9 Admin Dashboard Specification

## Purpose

Provide a secure super-admin dashboard for the platform owner to inspect and operate CarpinteroPro across all workshops while preserving tenant RLS for normal users.

## Out of scope

- Impersonation.
- Destructive admin actions.
- Subscription mutation/remediation actions.
- Admin audit-log persistence.
- Separate admin frontend app/repo.
- Direct frontend access with a service-role key.
- Broad client-side RLS policies that let admin users query all tenant data directly.
- Public admin signup or self-promotion.

## Requirements

### Requirement: Platform admin identity

The system MUST identify platform admins without creating a new platform-global table that violates the project rule requiring `workshop_id` on new tables.

#### Scenario: Admin flag exists on profile

- GIVEN the existing `profiles` table links each authenticated user to a `workshop_id`
- WHEN the SDD9 migration is applied
- THEN `profiles` has `is_platform_admin boolean NOT NULL DEFAULT false`
- AND manually maintained database types include the new column
- AND existing profile rows default to non-admin

#### Scenario: Normal users remain non-admin

- GIVEN a user signs up normally
- WHEN their profile is created
- THEN `is_platform_admin` is false by default
- AND the user cannot access `/admin/*`

#### Scenario: First admin is bootstrapped manually

- GIVEN the platform owner has a known authenticated user id
- WHEN an operator runs the documented bootstrap SQL in a trusted Supabase context
- THEN only that profile has `is_platform_admin = true`
- AND no public UI can grant platform-admin status in the MVP

#### Scenario: Users cannot self-promote through profile updates

- GIVEN the existing profile update policy lets authenticated users update safe profile fields on their own profile
- WHEN a non-trusted authenticated client attempts to change `profiles.is_platform_admin`
- THEN the database rejects the update
- AND platform-admin changes remain limited to trusted SQL/service-role maintenance contexts

### Requirement: Admin route guard

The system MUST prevent non-admin access to admin screens.

#### Scenario: Unauthenticated visitor reaches admin route

- GIVEN no active session
- WHEN the visitor opens `/admin`
- THEN the app redirects to login or shows the existing unauthenticated flow
- AND no admin data request is sent

#### Scenario: Authenticated non-admin reaches admin route

- GIVEN an authenticated user with `is_platform_admin = false`
- WHEN the user opens `/admin`
- THEN the app renders a forbidden/admin-not-available state
- AND the admin navigation entry is not visible in the normal app shell
- AND no successful admin data response is available to the client

#### Scenario: Platform admin reaches admin route

- GIVEN an authenticated user with `is_platform_admin = true`
- WHEN the user opens `/admin`
- THEN the admin dashboard loads after auth/admin status resolves
- AND the admin navigation entry is visible or the direct admin route is accessible

### Requirement: Admin Edge Function authorization

Admin data APIs MUST run through Edge Functions that verify the caller before using service-role access.

#### Scenario: Missing or invalid JWT is rejected

- GIVEN an admin Edge Function request without a valid Supabase JWT
- WHEN the function receives the request
- THEN it returns 401
- AND does not perform service-role data queries

#### Scenario: Non-admin JWT is rejected

- GIVEN a valid JWT for a user whose profile has `is_platform_admin = false`
- WHEN the function receives the request
- THEN it returns 403
- AND does not return cross-tenant data

#### Scenario: Admin JWT is accepted

- GIVEN a valid JWT for a user whose profile has `is_platform_admin = true`
- WHEN the function receives the request
- THEN it may use the server-side service client
- AND returns only the endpoint's documented DTO shape

#### Scenario: Service role stays server-side

- GIVEN the admin dashboard frontend bundle is built
- WHEN source and environment usage are reviewed
- THEN `SUPABASE_SERVICE_ROLE_KEY` is referenced only in Supabase Edge Function/server code
- AND frontend code uses the typed anon Supabase client or function invocation APIs only

### Requirement: Platform overview

The admin dashboard MUST show a high-level operational overview.

#### Scenario: Admin sees overview metrics

- GIVEN the user is a platform admin
- WHEN the admin overview loads successfully
- THEN it shows total workshops, recent workshops/signups, subscription status counts, and billing health indicators

#### Scenario: Overview handles loading/empty/error states

- GIVEN overview data is loading, empty, or unavailable
- WHEN the overview screen renders
- THEN it shows an accessible loading, empty, or error state instead of broken cards or misleading zeroes

### Requirement: Workshops management

The dashboard MUST let a platform admin inspect workshops across tenants.

#### Scenario: Admin lists workshops

- GIVEN the user is a platform admin
- WHEN the workshops screen loads
- THEN it displays a searchable table with workshop name/id, owner or user count when available, onboarding/profile status, subscription status, and created date

#### Scenario: Admin opens workshop detail

- GIVEN the workshops table has at least one workshop
- WHEN the admin selects a workshop
- THEN the detail view shows safe support context: workshop metadata, subscription summary, related profile count, and recent relevant events where available

#### Scenario: Non-admin cannot list workshops

- GIVEN the user is not a platform admin
- WHEN they invoke the workshops admin endpoint
- THEN the endpoint returns 403 and no workshop rows

### Requirement: Billing/subscription overview

The dashboard MUST provide read-only billing visibility across workshops.

#### Scenario: Admin filters subscriptions by status

- GIVEN the user is a platform admin
- WHEN the billing screen loads
- THEN it lists subscriptions across workshops
- AND supports filtering by status such as active, trialing, past_due, cancelled, or unknown according to existing subscription types, matching the database status spelling

#### Scenario: Billing screen is read-only

- GIVEN the MVP scope excludes subscription mutations
- WHEN the admin views a subscription
- THEN the UI does not expose cancel, retry, refund, or plan-change actions

### Requirement: Support diagnostics

The dashboard MUST provide safe troubleshooting information without impersonation.

#### Scenario: Admin views diagnostics

- GIVEN the user is a platform admin
- WHEN they open support diagnostics for a workshop
- THEN the screen can show recent billing webhook events, relevant timestamps, and configuration/status summaries
- AND it does not allow impersonation or destructive actions

### Requirement: Feature-sliced implementation

The implementation MUST preserve project architecture rules.

#### Scenario: Admin feature is self-contained

- GIVEN admin dashboard code is added
- WHEN imports are reviewed
- THEN `src/features/admin/**` imports only admin-local modules and `src/shared/**`
- AND `src/app/**` owns route composition and may import the admin public API

#### Scenario: Admin queries use feature api/hooks folders

- GIVEN admin client-side queries are added
- WHEN code is reviewed
- THEN function invocation/client data access lives in `src/features/admin/api/`
- AND TanStack Query wrappers live in `src/features/admin/hooks/`

## TDD and validation expectations

Strict TDD is active. Behavior-changing work MUST include RED/GREEN/REFACTOR evidence.

Expected tests:

- Migration/type validation for `profiles.is_platform_admin` where project tooling supports it.
- Edge Function authorization tests or focused unit tests for the admin authorization helper.
- React tests for admin guard loading/forbidden/allowed states.
- React tests for overview/workshops/billing empty/error states.
- Pure mapping helpers tested separately from UI.

Validation commands:

```bash
npm test
npm run lint
```

If Supabase local function tests are not available, verification MUST document the gap and include a manual curl/checklist for 401, 403, and admin success cases.

## Validation checklist

- [ ] `profiles.is_platform_admin` exists with default false and is reflected in `src/shared/types/database.ts`.
- [ ] No new table violates the `workshop_id uuid NOT NULL` project rule.
- [ ] `/admin/*` is lazy-loaded and guarded.
- [ ] Non-admin users cannot see admin navigation or admin data.
- [ ] Admin Edge Functions reject missing JWTs with 401.
- [ ] Admin Edge Functions reject non-admin JWTs with 403.
- [ ] Service-role key usage is server-only.
- [ ] Overview, workshops, billing, and support screens handle loading/empty/error states.
- [ ] Feature-sliced import boundaries are preserved.
- [ ] `npm test` and `npm run lint` pass before merge.
