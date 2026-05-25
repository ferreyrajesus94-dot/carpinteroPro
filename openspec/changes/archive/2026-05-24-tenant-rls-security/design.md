# Design: Tenant RLS Security

SDD 1 will replace browser-controlled tenant authorization with database-side tenant resolution from Supabase Auth. The apply phase must start with RED SQL/RLS tests; no RLS function or policy change is allowed without a failing SQL test that proves the current gap.

## Decisions

| Area | Design decision | Why |
|---|---|---|
| Tenant resolver | Rewrite `public.get_current_workshop_id()` to return `profiles.workshop_id` for `auth.uid()` only. | Single trusted source of tenant identity; missing profile and anonymous sessions return `NULL` and fail closed. |
| SQL/RLS test harness | Add local Supabase pgTAP tests under `supabase/tests/` and run them with `supabase test db`. Create a minimal local `supabase/config.toml` if missing. | Tests real PostgreSQL RLS behavior without touching remote Supabase data. |
| Remote safety | Do not run `supabase db push`, `supabase db reset --linked`, `supabase link`, `vercel deploy`, or other remote/destructive operations in SDD 1 apply/verify. | Supabase/Vercel CLIs are available, but repo is not configured for remote-safe deployment. |
| Frontend tenant context | Keep `workshopId` in React auth context for UI/query narrowing only; remove global header mutation. | Preserves app behavior while removing the authorization bypass. |
| Workshops table | Enable RLS on `public.workshops`; allow authenticated users to select/update only their own workshop. Do not add direct authenticated insert/delete policies. | Prevents tenant discovery while preserving future own-workshop edits; signup trigger can still create workshops as `SECURITY DEFINER`. |
| Delivery | Target one PR under 400 changed lines split into work-unit commits; auto-slice into chained PRs if forecast exceeds budget. | Matches SDD preflight and keeps review load bounded. |

## Architecture

### 1. RED SQL/RLS harness

Preferred harness:

- `supabase/config.toml`: minimal local Supabase config created by `supabase init` or a hand-written equivalent.
- `supabase/tests/tenant_isolation.test.sql`: pgTAP tests run by `supabase test db`.
- Tests should set the authenticated context with local transaction settings, e.g. `SET LOCAL ROLE authenticated` and `set_config('request.jwt.claim.sub', '<user-uuid>', true)`.
- The RED forged-header test must also set `request.headers` with another workshop id. It should fail before the resolver rewrite because the current function trusts `x-workshop-id`, then pass after the fix because headers are ignored.

If pgTAP setup proves infeasible locally, the fallback is a local-only SQL assertion script using transaction-scoped `DO $$ ... ASSERT ... $$` blocks against `supabase start`/local Postgres. Do not use production or linked Supabase projects for RED tests.

Minimum SQL coverage:

1. Forged header cannot expose another workshop's rows.
2. User A cannot insert a row for workshop B.
3. User A cannot update `workshop_id` from W1 to W2.
4. User B cannot select/update/delete user A rows.
5. User A can select own tenant rows.
6. `workshops` returns only the profile-associated workshop.
7. Missing profile returns zero tenant rows.

Representative tables: `materials`, `furniture_templates` or `recipe_items`, `clients`, `quotes`, `tasks`, `stock_movements`, plus `workshops`.

### 2. Migration design

Add one migration, expected name: `supabase/migrations/0020_tenant_rls_security.sql`.

Resolver contract:

```sql
CREATE OR REPLACE FUNCTION public.get_current_workshop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT p.workshop_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
$$;
```

Implementation notes:

- The function must not read `request.headers`, JWT custom claims, URL params, or any client-controlled value.
- Keep the existing policy call sites that compare `workshop_id = get_current_workshop_id()` unless a test shows a table-specific bug.
- Add `ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;`.
- Add/drop idempotent policies for `workshops_select_own` and `workshops_update_own` using `id = public.get_current_workshop_id()` in both `USING` and `WITH CHECK` where applicable.
- Do not add direct authenticated `INSERT`/`DELETE` policies for `workshops` in this SDD.
- Include lightweight migration assertions only for schema invariants if useful; the authoritative behavior checks live in SQL tests.

### 3. Frontend cleanup

Files:

- `src/shared/lib/supabase.ts`
  - Remove `_headers`.
  - Remove `global: { headers: _headers }`.
  - Delete exports `setWorkshopId()` and `clearWorkshopId()`.
  - Keep typed `createClient<Database>(supabaseUrl, supabaseAnonKey)`.
- `src/shared/providers/AuthProvider.tsx`
  - Import only `supabase` from `@/shared/lib/supabase`.
  - In `loadProfile`, set only React state: `setWorkshopIdState(data.workshop_id)`.
  - On logout/session removal, clear React state only.
  - Do not introduce fallback workshop ids.
- Feature API files may keep `.eq('workshop_id', workshopId)` as query narrowing, not authorization.

Frontend tests:

- Add focused Vitest coverage for the removed header mutation path.
- Prefer a module-level test for `src/shared/lib/supabase.ts` proving no `global.headers` workshop injection is configured or exported.
- Add/adjust `AuthProvider` test only if it can be done without broad test scaffolding churn.

## Data flow after change

1. Browser authenticates through Supabase Auth and sends only the normal JWT/session.
2. `AuthProvider` loads `profiles.workshop_id` for UI state.
3. Feature queries may include `workshop_id` filters for narrowing.
4. PostgreSQL RLS evaluates `get_current_workshop_id()`.
5. Resolver maps `auth.uid()` to `public.profiles.workshop_id`.
6. If no valid profile exists, resolver returns `NULL`; tenant policies deny access.

## Work units and commit boundaries

Target a single PR if the total changed lines stay under 400.

| Work unit | Commit boundary | Includes tests? | Rollback scope |
|---|---|---:|---|
| SQL harness + RED tests | `test(rls): add tenant isolation SQL tests` | Yes, failing before implementation | Remove `supabase/config.toml`/`supabase/tests` only. |
| Trusted RLS migration | `fix(rls): derive workshop from authenticated profile` | Yes, SQL tests pass after migration | Revert migration before launch; do not ship header-based RLS publicly. |
| Frontend header cleanup | `fix(auth): remove workshop header injection` | Yes, focused Vitest test/update | Revert frontend cleanup only if app cannot load own tenant after DB fix. |
| Phase docs if needed | `docs(sdd): record tenant rls verification notes` | N/A | Docs-only revert. |

Chained PR fallback:

- PR 1: local SQL test harness + RED tests only.
- PR 2: RLS resolver/workshops migration making SQL tests pass.
- PR 3: frontend header cleanup + Vitest tests.

If apply forecast exceeds the 400 changed-line review budget, pause before implementation packaging and use the chained PR fallback automatically per preflight.

## Verification

Run these commands locally only:

```bash
# Static review for forbidden header path
grep -R "x-workshop-id\|setWorkshopId\|clearWorkshopId\|request.headers" src supabase/migrations supabase/tests

# Initialize local Supabase config only if missing
# Prefer: supabase init
# Do not link to or reset a remote project.

supabase start
supabase test db
npm test
npm run lint
npm run build
```

Manual checks:

- Confirm `supabase/config.toml` contains no production project reference or secrets.
- Confirm no service-role key is added to frontend env files.
- Confirm the RED forged-header test fails before `0020_tenant_rls_security.sql` and passes after it.
- Confirm `workshops` has RLS enabled and only own-workshop select/update policies.
- Confirm the app still loads an authenticated user's profile/workshop state.

## Rollback plan

- Before launch, rollback is a git revert of the failing work unit.
- If the SQL harness is problematic, revert only the harness commit and replace it with the local assertion fallback before touching RLS.
- If the resolver migration fails verification, revert `0020_tenant_rls_security.sql` and keep the product non-public; returning to header-based RLS is not production-acceptable.
- If frontend cleanup causes app load regressions after DB tests pass, revert the frontend work unit while keeping the trusted database resolver.
- Do not perform remote database rollback through Supabase CLI as part of this SDD unless a separate deployment/ops plan is approved.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Local Supabase config missing | High | Create minimal local config during apply; no remote link/push/reset. |
| pgTAP/auth context setup friction | Medium | Use transaction-scoped JWT settings; fallback to local SQL assertions if pgTAP blocks progress. |
| RLS performance from profile lookup | Medium | `profiles.id` is the primary key; defer JWT-claim optimization unless profiling requires it. |
| Missing profile UX is confusing | Medium | Security fails closed now; SDD 3 owns UX hardening. |
| Policy gaps across many tables | High | Centralize resolver change and test representative CRUD across functional areas. |
| Review budget overflow | Medium | Use work-unit commits and chained PR fallback above 400 changed lines. |

## Out of scope

- Billing gates or MercadoPago.
- Missing-profile recovery UX beyond fail-closed behavior.
- Production Supabase/Vercel deployment.
- Custom JWT claims.
- Broad feature API refactors or architecture cleanup.
