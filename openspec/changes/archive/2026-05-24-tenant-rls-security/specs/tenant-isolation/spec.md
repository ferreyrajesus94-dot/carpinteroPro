# Tenant Isolation Specification

## Purpose

Ensure that every authenticated user can only access data belonging to their own workshop. The tenant isolation boundary MUST be derived from trusted server-side identity (`auth.uid()` → `profiles.workshop_id`) and MUST NOT rely on client-supplied headers, URL parameters, or any other mutable request state for authorization decisions.

## Requirements

### Requirement: Trusted Workshop Resolver

The system MUST derive the current workshop identifier exclusively from the authenticated user's profile record.

#### Scenario: Authenticated user with valid profile

- GIVEN an authenticated Supabase session exists for user U
- AND user U has a profile row with `workshop_id = W`
- WHEN the database evaluates any RLS policy that depends on the current workshop
- THEN the resolver MUST return `W`

#### Scenario: Authenticated user without a profile

- GIVEN an authenticated Supabase session exists for user U
- AND user U has NO profile row
- WHEN the database evaluates any RLS policy that depends on the current workshop
- THEN the resolver MUST return `NULL`
- AND all RLS comparisons against `NULL` MUST evaluate to deny (fail-closed)

#### Scenario: Anonymous or unauthenticated request

- GIVEN no authenticated Supabase session exists
- WHEN the database evaluates any RLS policy that depends on the current workshop
- THEN `auth.uid()` MUST return `NULL`
- AND the resolver MUST return `NULL`
- AND RLS MUST deny access to all tenant-scoped rows

---

### Requirement: Workshops Table RLS

The `public.workshops` table MUST have Row Level Security enabled and policies that restrict access to the workshop associated with the authenticated user's profile.

#### Scenario: User can read own workshop

- GIVEN user U has `profiles.workshop_id = W`
- WHEN user U queries `SELECT * FROM workshops`
- THEN the result set MUST contain exactly the row where `workshops.id = W`
- AND MUST NOT contain any other workshop rows

#### Scenario: User cannot discover other workshops

- GIVEN user U has `profiles.workshop_id = W1`
- AND workshop W2 exists with a different owner
- WHEN user U queries `SELECT * FROM workshops WHERE id = W2`
- THEN the query MUST return zero rows

#### Scenario: User cannot update another workshop

- GIVEN user U has `profiles.workshop_id = W1`
- AND workshop W2 exists
- WHEN user U attempts `UPDATE workshops SET name = 'Hacked' WHERE id = W2`
- THEN the update MUST affect zero rows

---

### Requirement: Cross-Tenant CRUD Denial

For every tenant-scoped table, the system MUST deny cross-workshop `SELECT`, `INSERT`, `UPDATE`, and `DELETE` operations at the RLS layer.

#### Scenario: Cross-tenant SELECT is denied

- GIVEN user A has `profiles.workshop_id = W1`
- AND user B has `profiles.workshop_id = W2`
- AND table T contains a row with `workshop_id = W1`
- WHEN user B executes `SELECT * FROM T`
- THEN the row with `workshop_id = W1` MUST NOT appear in the result set

#### Scenario: Cross-tenant INSERT is denied

- GIVEN user A has `profiles.workshop_id = W1`
- WHEN user A attempts `INSERT INTO T (workshop_id, ...) VALUES (W2, ...)` where `W2 ≠ W1`
- THEN the insert MUST be denied by the `WITH CHECK` clause

#### Scenario: Cross-tenant UPDATE is denied

- GIVEN user A has `profiles.workshop_id = W1`
- AND table T contains a row with `workshop_id = W1`
- WHEN user A attempts `UPDATE T SET workshop_id = W2 WHERE id = ...` where `W2 ≠ W1`
- THEN the update MUST be denied by the `WITH CHECK` clause

#### Scenario: Cross-tenant DELETE is denied

- GIVEN user A has `profiles.workshop_id = W1`
- AND table T contains a row with `workshop_id = W2` where `W2 ≠ W1`
- WHEN user A attempts `DELETE FROM T WHERE id = ...`
- THEN the delete MUST affect zero rows because the `USING` clause denies visibility

---

### Requirement: Representative Tenant-Scoped Table Coverage

SQL RED tests MUST cover at least one representative table from each functional area to prove the isolation boundary works end-to-end.

#### Scenario: Inventory area (materials)

- GIVEN `materials` is a tenant-scoped table with `workshop_id`
- WHEN cross-tenant SELECT/INSERT/UPDATE/DELETE tests run
- THEN all operations across the workshop boundary MUST be denied

#### Scenario: Recipe area (furniture_templates or recipe_items)

- GIVEN `furniture_templates` or `recipe_items` is a tenant-scoped table with `workshop_id`
- WHEN cross-tenant SELECT/INSERT/UPDATE/DELETE tests run
- THEN all operations across the workshop boundary MUST be denied

#### Scenario: CRM area (clients)

- GIVEN `clients` is a tenant-scoped table with `workshop_id`
- WHEN cross-tenant SELECT/INSERT/UPDATE/DELETE tests run
- THEN all operations across the workshop boundary MUST be denied

#### Scenario: Quotes area (quotes)

- GIVEN `quotes` is a tenant-scoped table with `workshop_id`
- WHEN cross-tenant SELECT/INSERT/UPDATE/DELETE tests run
- THEN all operations across the workshop boundary MUST be denied

#### Scenario: Tasks area (tasks)

- GIVEN `tasks` is a tenant-scoped table with `workshop_id`
- WHEN cross-tenant SELECT/INSERT/UPDATE/DELETE tests run
- THEN all operations across the workshop boundary MUST be denied

#### Scenario: Stock area (stock_movements)

- GIVEN `stock_movements` is a tenant-scoped table with `workshop_id`
- WHEN cross-tenant SELECT/INSERT/UPDATE/DELETE tests run
- THEN all operations across the workshop boundary MUST be denied

---

### Requirement: No Request Header Authorization

The frontend Supabase client MUST NOT inject `x-workshop-id` or any other workshop-identifying header into database requests. The database MUST NOT read workshop identity from request headers, JWT custom claims, or any other client-controlled transport mechanism.

#### Scenario: Supabase client configuration

- GIVEN the application initializes the Supabase client
- WHEN any database request is made
- THEN the request MUST NOT contain an `x-workshop-id` header
- AND the client configuration MUST NOT include a mutable `global.headers` object for workshop injection

#### Scenario: AuthProvider login flow

- GIVEN a user successfully authenticates
- WHEN `AuthProvider` processes the session
- THEN it MUST NOT call any function that mutates the Supabase client's global headers
- AND it MUST NOT set an `x-workshop-id` header on the Supabase client

#### Scenario: AuthProvider logout flow

- GIVEN a user signs out
- WHEN `AuthProvider` cleans up session state
- THEN it MUST NOT attempt to clear or mutate `x-workshop-id` headers on the Supabase client

---

### Requirement: Workshop Context Remains Available for UI

The frontend MAY retain the current `workshopId` in React context, Zustand store, or local component state for display, filtering, query narrowing, or other UI purposes, provided it is never used as an authorization boundary.

#### Scenario: UI filtering

- GIVEN `workshopId` is stored in `AuthContext` for UI state
- WHEN a feature API query includes `.eq('workshop_id', workshopId)`
- THEN this MUST be treated as defense-in-depth query narrowing
- AND the actual security boundary MUST remain the server-derived RLS policy

---

### Requirement: Fail-Closed Missing Profile

If an authenticated user has no `profiles` row, or their profile lacks a `workshop_id`, the system MUST deny all access to tenant-scoped data. There MUST be no fallback to a default workshop, demo workshop, or any client-supplied value.

#### Scenario: Missing profile row

- GIVEN an authenticated user exists in `auth.users`
- AND no corresponding row exists in `public.profiles`
- WHEN the user attempts to query any tenant-scoped table
- THEN the query MUST return zero rows
- AND the application MUST NOT silently fall back to a default workshop

#### Scenario: NULL workshop_id in profile

- GIVEN a profile row exists with `workshop_id = NULL`
- WHEN the user attempts to query any tenant-scoped table
- THEN the query MUST return zero rows

---

## Non-Goals and Deferrals

The following items are explicitly OUT OF SCOPE for this change and MUST be deferred to future SDD packages:

1. **Missing-profile UX hardening:** User-facing error messages, retry flows, support links, or automatic profile repair when a profile is missing or broken. Defer to **SDD-3 (Auth/profile hardening)**.
2. **Custom JWT claims:** Replacing the `profiles` lookup with `raw_user_meta_data` or Supabase custom claims for performance optimization. May be revisited in **SDD-8 (Architecture cleanup)** if profiling proves RLS latency is a bottleneck.
3. **Billing integration:** Subscription checks, trial gates, or payment-related authorization. Defer to **SDD-2 (Billing + MercadoPago)**.
4. **Cache and PWA privacy:** Service worker cache clearing, query persistence policies, or local storage scrubbing on logout. Defer to **SDD-4 (Cache/PWA privacy)**.
5. **Observability and error reporting:** Production error tracking, support IDs, or error boundaries. Defer to **SDD-6 (Observability/support)**.
6. **End-to-end browser tests:** Full E2E coverage of signup, CRUD, and tenant isolation via Playwright or similar. Defer to **SDD-7 (Business-critical E2E)**.
7. **Architecture cleanup:** Cross-feature import removal, shared code reorganization, or general refactoring not strictly required for tenant isolation. Defer to **SDD-8 (Architecture cleanup)**.
8. **RPC parameter validation:** Changing `generate_quote_number(p_workshop_id uuid)` or other RPC signatures. RLS on the underlying tables already enforces isolation; RPC hardening is not required for SDD-1.

## Test Requirements

### SQL / RLS RED Tests

The apply phase MUST begin with failing (RED) SQL tests that prove the current header-based RLS model is insufficient and that the target server-derived model works.

#### Test Harness Setup

- **Constraint:** `supabase/config.toml` does not exist in the repository.
- **Safe initialization:** Before writing RLS tests, initialize a local Supabase test harness using `supabase init` or create a minimal `supabase/config.toml` that does not overwrite remote project configuration. If the connected Supabase project has live data, the test harness MUST target a separate local database or test project only.
- **Tooling:** Use `supabase test db` with pgTAP, or inline `DO $$ ... END $$;` assertions in a migration file, whichever the apply phase design selects.

#### Required RED Test Coverage

1. **Forged header test (fails before fix, passes after):**
   - Create two workshops, two users, two profiles.
   - Insert rows for workshop A.
   - Attempt to read workshop A's rows while authenticated as user B.
   - ASSERT result is empty.

2. **Cross-tenant INSERT denial:**
   - Authenticated as user A (workshop W1).
   - Attempt `INSERT INTO materials (workshop_id, ...) VALUES (W2, ...)`.
   - ASSERT the insert is denied.

3. **Cross-tenant UPDATE denial:**
   - Authenticated as user A (workshop W1).
   - Attempt to change a row's `workshop_id` from W1 to W2.
   - ASSERT the update is denied.

4. **Own-tenant access confirmation:**
   - Authenticated as user A (workshop W1).
   - Insert a row with `workshop_id = W1`.
   - SELECT the row.
   - ASSERT the row is returned.

5. **Workshops RLS:**
   - Authenticated as user A (workshop W1).
   - SELECT from `workshops`.
   - ASSERT only the row with `id = W1` is visible.

6. **Missing profile fail-closed:**
   - Create an authenticated user with NO profile row.
   - Attempt SELECT on any tenant-scoped table.
   - ASSERT zero rows returned.

### Frontend Tests

- **Test runner:** `npm test` (Vitest).
- **Required coverage:** At least one unit test proving that `AuthProvider` no longer mutates the Supabase client's global headers after login.
- **Required coverage:** At least one unit test proving that `supabase.ts` does not export `setWorkshopId` or `clearWorkshopId` functions, or that they are no-ops/deleted.
- **Mock policy:** Frontend tests MUST continue to mock the Supabase client; they are not expected to test real RLS behavior. RLS isolation is the responsibility of SQL tests.

## Affected Files and Boundaries

| File / Path | Role | Expected Change |
|-------------|------|-----------------|
| `supabase/migrations/*` | Database | Rewrite `get_current_workshop_id()`; add `workshops` RLS policies; add SQL test migration(s). |
| `src/shared/lib/supabase.ts` | Frontend client | Remove `_headers`, `setWorkshopId`, `clearWorkshopId`, and `global: { headers: _headers }`. |
| `src/shared/providers/AuthProvider.tsx` | Frontend auth | Remove imports and calls to `setWorkshopId` / `clearWorkshopId`. |
| `src/shared/hooks/useWorkshopId.ts` | Frontend UI | No logic change; continue reading from context for UI only. |
| `src/features/*/api/*.ts` | Feature queries | No required change; keep `.eq('workshop_id', ...)` as defense-in-depth. |
| `tests/` | Test suite | Add frontend tests for header removal; SQL tests added via migrations. |

## Compliance Notes

- Every tenant-scoped table MUST include `workshop_id uuid NOT NULL` per project `AGENTS.md` database conventions.
- RLS MUST be enabled on every new or modified table per project conventions.
- The service role key MUST NOT be exposed in frontend code per project `AGENTS.md` Supabase conventions.
- All client queries MUST continue to go through the typed `supabase` client from `@/shared/lib/supabase`.
