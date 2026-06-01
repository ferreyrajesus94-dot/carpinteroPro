# SDD 4 Specification — Cache/PWA Privacy

## Purpose

Prevent sensitive CarpinteroPro tenant and business data from surviving logout, session removal, authenticated user switch, or PWA service-worker updates through TanStack Query persistence, `localStorage`, or Workbox Cache Storage, while preserving harmless UI/convenience preferences.

## Scope Assumption

The SDD 4 proposal has no `Capabilities` section. This spec treats `cache-pwa-privacy` as a single affected domain inferred from the proposal and source inspection.

## Requirements

### Requirement: Deny-by-default query persistence

The system MUST NOT persist authenticated, tenant-scoped, or business-sensitive TanStack Query results to durable browser storage by default. If query persistence remains enabled, it MUST use an explicit non-sensitive allowlist and MUST exclude every query key that may contain tenant, user, workshop, customer, quote, task, inventory, price, stock movement, settings, template, billing, or subscription data.

At minimum, the following currently observed query families MUST be treated as sensitive and non-persistable: `quotes`, `clients`, `tasks`, `materials`, `stock_movements`, `price_history`, `price_history_all`, `subscription`, workshop settings, furniture/recipe templates, contract templates, and any key containing a `workshopId`, user id, customer id, material id, quote id, or subscription id.

#### Scenario: Sensitive query is excluded from persistence

- GIVEN a successful query whose key is `['quotes', workshopId]`, `['clients', workshopId]`, `['tasks', workshopId]`, `['materials', workshopId]`, `['stock_movements', materialId]`, `['price_history', materialId]`, `['price_history_all', workshopId, days]`, or `['subscription', workshopId]`
- WHEN the query persistence layer dehydrates or writes durable state
- THEN that query's data MUST NOT be written to `localStorage`, IndexedDB, or any other durable query persistence store.

#### Scenario: New query keys fail closed

- GIVEN a newly added authenticated query key that has not been added to a non-sensitive persistence allowlist
- WHEN the query persistence layer evaluates that query
- THEN the query MUST NOT be persisted.

#### Scenario: Allowed persistence contains only non-sensitive data

- GIVEN a query key explicitly approved as non-sensitive
- WHEN that query is persisted
- THEN the persisted value MUST NOT include tenant-scoped business data, authentication tokens, profile data, email addresses, customer data, quote data, task data, inventory data, price history, stock movements, workshop settings, templates, or billing/subscription data.

### Requirement: Central cache purge on logout and session removal

The system MUST provide a single shared cache-privacy purge path that is invoked when the active Supabase session becomes unauthenticated and when sign-out is requested. The purge MUST clear in-memory TanStack Query state, persisted TanStack Query state, sensitive CarpinteroPro business storage, and legacy Workbox/Supabase API Cache Storage entries without deleting preserved non-sensitive keys.

#### Scenario: Logout removes sensitive query data

- GIVEN an authenticated user has loaded sensitive protected data into TanStack Query
- WHEN the user signs out from the profile page or any auth recovery/failure path
- THEN the in-memory query cache MUST be cleared before protected UI can render again
- AND persisted query cache data MUST be removed from durable browser storage
- AND a later login in the same browser MUST NOT display the previous user's cached business data.

#### Scenario: Session removal removes sensitive data

- GIVEN Supabase auth emits a session change with `session = null`
- WHEN the auth provider transitions to unauthenticated state
- THEN the shared cache purge MUST run
- AND auth/profile state MUST clear as before
- AND preserved non-sensitive preferences MUST remain available.

#### Scenario: Purge failure does not leave the app authenticated

- GIVEN cache cleanup attempts to clear a storage area that is unavailable or throws
- WHEN logout or session removal continues
- THEN the app MUST still transition to unauthenticated state
- AND the failure MUST NOT expose previous protected UI as authenticated content.

### Requirement: Authenticated user switch purge

The system MUST treat a change from one authenticated Supabase user id to a different authenticated Supabase user id as a privacy boundary. Before the new user's profile/workshop-protected UI is considered ready, the shared cache purge MUST clear the previous user's in-memory and durable sensitive data.

#### Scenario: User A to user B clears before B is ready

- GIVEN user A is authenticated and has loaded quotes, clients, tasks, inventory, or billing subscription data
- WHEN Supabase auth reports a new authenticated session for user B with a different user id
- THEN user A's in-memory query cache MUST be cleared before user B reaches the ready/protected state
- AND persisted sensitive cache data from user A MUST be removed
- AND protected UI for user B MUST NOT render user A's cached data while user B's profile is loading.

#### Scenario: Token refresh for same user does not create false switch

- GIVEN an authenticated session for user A
- WHEN Supabase auth emits a refreshed session for the same user id
- THEN the system MAY keep normal in-memory state
- BUT it MUST still comply with the deny-by-default durable persistence policy.

### Requirement: Workbox Supabase REST cache safety

The PWA/service-worker configuration MUST NOT cache authenticated Supabase REST or auth responses in a reusable runtime cache. Static application asset caching MAY remain enabled. Any retained runtime API cache MUST be proven not to store authenticated tenant/business data and MUST NOT replay one user's response to another user.

#### Scenario: Supabase REST runtime caching is absent or safe

- GIVEN the production PWA build configuration is evaluated
- WHEN Workbox runtime caching rules are inspected
- THEN there MUST NOT be a `supabase-api` or equivalent runtime cache that stores `https://*.supabase.co/rest/*` authenticated responses with a reusable `NetworkFirst`, `CacheFirst`, or similar handler
- OR any remaining API runtime caching MUST be restricted to non-authenticated, non-tenant, non-business responses with tests documenting that restriction.

#### Scenario: Legacy service-worker API cache is removed

- GIVEN a browser already contains a legacy Workbox cache such as `supabase-api`
- WHEN the updated app starts, logs out, or processes an auth user switch
- THEN that legacy cache MUST be deleted or otherwise made unable to replay authenticated Supabase REST responses.

### Requirement: Preserved non-sensitive localStorage keys

The system MUST preserve harmless UI/convenience keys during privacy cleanup unless a future spec explicitly reclassifies them. The preserved keys are exactly `theme`, `cp.palette`, `cp.density`, keys matching `cp.howto.*`, and `carpinteroPro.rememberedEmail`.

#### Scenario: Preferences survive logout cleanup

- GIVEN `localStorage` contains `theme`, `cp.palette`, `cp.density`, `cp.howto.dashboard`, and `carpinteroPro.rememberedEmail`
- AND it also contains sensitive or legacy cache entries
- WHEN the shared cache purge runs
- THEN the preserved keys and their values MUST remain
- AND sensitive cache entries MUST be removed.

#### Scenario: Unknown CarpinteroPro business key is not preserved by accident

- GIVEN `localStorage` contains an unapproved CarpinteroPro key with cached business data
- WHEN the shared cache purge runs
- THEN that key MUST be removed unless it is explicitly classified as preserved non-sensitive in this spec or a later accepted spec.

### Requirement: Startup cleanup for legacy persisted sensitive data

The system MUST perform a startup or auth-initialization cleanup sufficient to remove legacy sensitive persisted query data and legacy Supabase REST Cache Storage entries created before SDD 4, before stale protected data can be displayed after a reload, logout, or user switch.

#### Scenario: Legacy persisted query data is removed on startup

- GIVEN the browser contains pre-SDD-4 TanStack Query persisted cache data from a previous session
- WHEN the app initializes auth/cache privacy handling
- THEN legacy persisted sensitive query data MUST be removed or ignored before protected UI can render it.

#### Scenario: Legacy cleanup preserves convenience keys

- GIVEN the browser contains legacy persisted sensitive query data and the preserved non-sensitive localStorage keys
- WHEN startup cleanup runs
- THEN the sensitive legacy data MUST be removed or ignored
- AND the preserved non-sensitive keys MUST remain.

### Requirement: Strict TDD validation evidence

The change MUST include failing tests before implementation and passing tests after implementation for query persistence policy, logout/session-removal cleanup, authenticated user-switch cleanup, Workbox/Supabase REST cache safety, preserved non-sensitive keys, and legacy startup cleanup. The full validation command MUST be `npm test`.

#### Scenario: Tests demonstrate current privacy gap before implementation

- GIVEN the current broad query persistence and missing purge behavior
- WHEN the SDD 4 tests are first added
- THEN at least one targeted test MUST fail because sensitive query data can persist or cleanup is not invoked.

#### Scenario: Tests pass after privacy hardening

- GIVEN the implementation satisfies this spec
- WHEN `npm test` is run
- THEN all SDD 4 targeted tests and the existing test suite MUST pass.

## Expected Affected Files and Test Evidence

The implementation is expected to affect these files or nearby focused test files, while preserving feature-sliced boundaries:

- `src/shared/lib/queryClient.ts` — query persistence policy and/or exported cleanup contract.
- `src/shared/providers/AuthProvider.tsx` — invocation of cleanup on logout, session removal, and authenticated user-id switch.
- `src/features/auth/components/ProfilePage.tsx` — sign-out path compatibility if needed.
- `vite.config.ts` — Workbox runtime caching removal/hardening and cache-name compatibility.
- `src/shared/providers/AuthProvider.test.tsx` — logout, session removal, and authenticated user switch cleanup tests.
- `src/app/layouts/AppLayout.test.tsx` or focused cache/privacy tests — protected UI must not show stale cached data across logout/user switch.
- Focused tests for query persistence filtering and localStorage/Cache Storage cleanup.
- Focused test or configuration assertion that Supabase REST authenticated runtime caching is absent or explicitly safe.

Expected test cases include:

1. Sensitive query keys are not persisted; new unallowlisted keys are not persisted.
2. Logout clears in-memory and persisted query cache and preserves only approved convenience keys.
3. Supabase `session = null` events invoke the same cleanup path.
4. Authenticated user id changes clear old user data before the new user reaches ready/protected UI.
5. Same-user token refresh does not unnecessarily break auth state while durable persistence remains privacy-safe.
6. Legacy TanStack Query persisted cache entries and legacy `supabase-api` Cache Storage are removed or ignored on startup/cleanup.
7. Workbox config no longer caches authenticated Supabase REST responses, or retained caching is proven non-sensitive.
8. `npm test` passes.
