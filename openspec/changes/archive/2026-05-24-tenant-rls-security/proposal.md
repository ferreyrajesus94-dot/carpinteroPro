# Proposal: Tenant RLS Security

Replace client-controlled tenant authorization with server-derived workshop identity. SDD 1 is a launch blocker because current RLS trusts the browser-supplied `x-workshop-id` header.

## Problem

`get_current_workshop_id()` currently reads `x-workshop-id` from request headers. A malicious authenticated user can forge that header and attempt cross-workshop reads or writes. The `workshops` table also lacks RLS, allowing tenant discovery.

## Goals

- Derive authorization workshop identity from trusted server state: `auth.uid() -> profiles.workshop_id`.
- Remove `x-workshop-id` header injection from the frontend Supabase client.
- Enable RLS and policies for `workshops`.
- Add SQL/RLS isolation tests before changing policies or functions.
- Keep frontend workshop context only for UI state, filtering, and query narrowing; not authorization.

## Non-goals

- Full missing-profile UX hardening; defer to SDD 3.
- Billing, cache privacy, observability, or architecture cleanup outside files required for tenant isolation.
- Replacing the `profiles.workshop_id` lookup with custom JWT claims unless future profiling proves it necessary.

## Proposed approach

1. **RED SQL/RLS tests first:** add pgTAP or migration-level SQL tests that fail under the current header-based RLS model. No RLS implementation change may land without a SQL test proving the target isolation behavior.
2. Replace `get_current_workshop_id()` with a `SECURITY DEFINER` lookup from `public.profiles` where `id = auth.uid()`.
3. Preserve existing tenant policies that compare table `workshop_id` to `get_current_workshop_id()`, but make the function trusted by construction.
4. Add `workshops` RLS so users can only access their own workshop through their profile relationship.
5. Remove `_headers`, `setWorkshopId`, `clearWorkshopId`, and global header injection from `src/shared/lib/supabase.ts`; remove related calls from `AuthProvider`.
6. Keep `workshopId` in auth context and existing `.eq('workshop_id', workshopId)` query filters as UI/performance defense-in-depth only.
7. Fail closed for missing profiles: no profile means `get_current_workshop_id()` returns `NULL`, so RLS denies. User-facing recovery is deferred to SDD 3 except minimal safe handling needed to avoid unsafe fallbacks.

## Affected areas

- `supabase/migrations/*`: RLS function, workshops policies, SQL/RLS tests.
- `src/shared/lib/supabase.ts`: remove mutable workshop header path.
- `src/shared/providers/AuthProvider.tsx`: stop mutating Supabase request headers.
- Existing feature API files: expected to remain mostly unchanged; explicit `workshop_id` filters are not the security boundary.

## Acceptance criteria

- [ ] SQL/RLS RED tests are introduced before implementation and fail against the current header-trusting behavior.
- [ ] `get_current_workshop_id()` derives workshop identity only from `auth.uid() -> profiles.workshop_id`.
- [ ] No frontend code injects or relies on `x-workshop-id` for Supabase authorization.
- [ ] `workshops` has RLS enabled and policies restricting users to their own workshop.
- [ ] Cross-tenant `SELECT`, `INSERT`, `UPDATE`, and `DELETE` attempts are denied by SQL tests for representative tenant tables.
- [ ] Authenticated users can still access their own workshop data.
- [ ] Missing/broken profile state fails closed, with full UX hardening deferred to SDD 3.
- [ ] `npm test` passes after implementation.

## Test strategy

- Primary: SQL/RLS tests using pgTAP or equivalent Supabase database test harness.
- Required RED coverage before RLS changes:
  - forged or mismatched workshop context cannot expose another workshop's rows;
  - user A cannot insert/update rows for workshop B;
  - user B cannot select, update, or delete user A's tenant rows;
  - users can select their own workshop row.
- Frontend: Vitest coverage for removal of workshop header mutation where practical.
- Final verification: run `npm test`; include manual review of Supabase client configuration to confirm no `x-workshop-id` injection remains.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| RLS lookup performance overhead | Medium | `profiles.id` is indexed by primary key; profile lookup is simple and stable. Revisit JWT claims only if profiling shows a bottleneck. |
| SQL test harness does not exist yet | High | Make database test setup part of SDD 1 before implementation. |
| Missing profile creates confusing UI | Medium | Fail closed now; defer UX hardening and recovery flows to SDD 3. |
| Policy regressions across many tables | High | Use SQL tests for representative CRUD isolation and keep changes centralized in `get_current_workshop_id()`. |

## Rollback

- Revert the migration that changes `get_current_workshop_id()` and `workshops` policies only if tests or production verification fail before launch.
- Reverting to header-based RLS is not acceptable for production; rollback should keep the app non-public until server-derived tenant isolation passes.

## Success criteria

SDD 1 succeeds when authorization no longer trusts client-supplied workshop headers, `workshops` is protected by RLS, SQL tests prove cross-tenant isolation, and the app still loads authenticated users' own workshop data.

## Review workload forecast

Expected apply workload is likely above one tiny patch but should remain reviewable under the 400 changed-line budget if split carefully:

1. SQL test harness + RED tests.
2. RLS function and `workshops` policy migration.
3. Frontend header-path removal and focused Vitest updates.

If implementation forecast exceeds the review budget, pause before apply and split into chained review packages.
