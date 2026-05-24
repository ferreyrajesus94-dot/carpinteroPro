# Apply Progress: Tenant RLS Security

## Current phase

Work Unit 4 — Config cleanup and final verification

## Status

`apply_complete`

## Completed

- Created local Supabase config with `supabase init`.
- Created `supabase/.gitignore` for local Supabase runtime folders.
- Added `supabase/tests/tenant_isolation.test.sql` with pgTAP tenant-isolation tests.
- Resolved local migration blockers:
  - renamed duplicate `0014_tasks.sql` to `0015_tasks.sql`;
  - shifted following migration filenames through `0019_cut_pieces.sql`;
  - made duplicate policy drops idempotent in `0017_child_tables_workshop_id.sql`.
- Ran `supabase db reset` successfully against the local Docker-backed Supabase stack.
- Ran `supabase test db` and reached the intended RED state.
- Confirmed no remote Supabase/Vercel operations were executed.

## RED evidence

`supabase test db` fails 3 of 10 tests:

```text
Failed test 4: "forged x-workshop-id header cannot expose another workshop materials row"
    have: (1)
    want: (0)
Failed test 5: "forged x-workshop-id header cannot expose another workshop stock movement row"
    have: (1)
    want: (0)
Failed test 9: "user A can only see own workshop row"
    have: (2)
    want: (1)
```

These failures are expected before Work Unit 2:

- current `get_current_workshop_id()` trusts forged `x-workshop-id` headers;
- `workshops` has no own-workshop RLS.

## Work Unit 2 completed

Created `supabase/migrations/0020_tenant_rls_security.sql` with:

- trusted `public.get_current_workshop_id()` resolver using `auth.uid() -> public.profiles.workshop_id`;
- `ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;`;
- own-workshop `SELECT` and `UPDATE` policies for `public.workshops`;
- no frontend changes yet.

Verification:

```bash
sg docker -c 'supabase db reset'
sg docker -c 'supabase test db'
```

Result:

```text
/home/elias/Proyectos/carpinteroPro/supabase/tests/tenant_isolation.test.sql .. ok
All tests successful.
Files=1, Tests=10
Result: PASS
```

## Work Unit 3 completed

Removed frontend tenant header mutation:

- `src/shared/lib/supabase.ts` no longer defines `_headers`, `global.headers`, `setWorkshopId()`, or `clearWorkshopId()`.
- `src/shared/providers/AuthProvider.tsx` no longer imports/calls header mutation helpers.
- `workshopId` remains in React auth state for UI/query narrowing only.
- `src/shared/providers/AuthProvider.test.tsx` was updated.
- `src/shared/lib/supabase.test.ts` was added.

Verification:

```bash
npm test
npm run lint
npm run build
sg docker -c 'supabase test db'
```

Results:

```text
Test Files  21 passed (21)
Tests  141 passed (141)

npm run lint -> 0 errors, 6 existing warnings
npm run build -> success
supabase test db -> 10 tests passed
```

## Work Unit 4 completed

Removed obsolete `VITE_WORKSHOP_ID` from `.env.example` and completed final verification.

Final verification:

```bash
sg docker -c 'supabase test db'
npm test
npm run lint
npm run build
```

Results:

```text
supabase test db -> 10 tests passed
npm test -> 21 files / 141 tests passed
npm run lint -> 0 errors, 6 existing warnings
npm run build -> success
```

Static checks found no forbidden frontend tenant-header patterns and no obsolete `VITE_WORKSHOP_ID` placeholder.

## TDD Cycle Evidence

| Cycle | RED evidence | GREEN evidence | TRIANGULATE / REFACTOR evidence | Status |
|---|---|---|---|---|
| WU1/WU2 — SQL/RLS tenant isolation | `qa/sdd-1-apply-wu1-report.md` records `supabase test db` failing 3 expected tests before implementation: forged `x-workshop-id` exposes `materials`, forged header exposes `stock_movements`, and `workshops` returns both tenant rows. | `qa/sdd-1-apply-wu2-report.md` records `supabase db reset` and `supabase test db` passing 10/10 after `0020_tenant_rls_security.sql`. | `supabase/tests/tenant_isolation.test.sql` includes multiple representative checks: forged header denial, cross-tenant insert/update denial, own-tenant access, workshops visibility, missing-profile fail-closed, and schema invariants. | PASS |
| WU3 — Frontend header cleanup | Existing `AuthProvider` tests expected header mutation helpers and failed until updated; static grep initially found `_headers`, `setWorkshopId`, `clearWorkshopId`, and `x-workshop-id` in frontend source/tests. | `qa/sdd-1-apply-wu3-report.md` records `npm test` passing 21 files / 141 tests after removing frontend header mutation and updating tests. | Added `src/shared/lib/supabase.test.ts` to assert removed helper exports; static checks confirm no frontend `x-workshop-id`/`_headers` and no removed helper refs outside `setWorkshopIdState`. | PASS |
| WU4 — Config cleanup and final verification | `.env.example` contained obsolete `VITE_WORKSHOP_ID`, which contradicted the no-client-supplied-workshop contract. | `qa/sdd-1-apply-wu4-report.md` records removal of `VITE_WORKSHOP_ID` and final `supabase test db`, `npm test`, `npm run lint`, and `npm run build` verification. | Final static checks confirm no obsolete env placeholder or forbidden frontend tenant-header patterns. | PASS |

## Review packaging decision

The task forecast recommended chained PRs if implementation exceeded the 400-line review budget. The current working tree includes all work units in one local apply session for SDD continuity, but PR/review packaging should still be split before opening a PR unless the user explicitly approves a `size:exception`.

Recommended stacked review slices:

1. SQL harness + migration-history cleanup + RED tests.
2. Trusted RLS migration + GREEN SQL evidence.
3. Frontend header cleanup + env cleanup + final verification.

## Remote migration safety

Historical migration filenames were renumbered to fix duplicate local version `0014`. Do not run remote Supabase operations (`db push`, `migration repair`, linked reset) until a remote migration-history plan is reviewed against the connected project.

## Strict TDD gate

Apply is complete and TDD evidence is recorded. Proceed to verify phase with a fresh review before considering SDD 1 done.
