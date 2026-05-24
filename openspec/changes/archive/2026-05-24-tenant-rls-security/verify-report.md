# SDD 1 Verify Report — Tenant RLS Security

## Status

**PASS — strict-TDD blocker resolved; implementation verification remains green.**

The prior process blocker is resolved: `openspec/changes/tenant-rls-security/apply-progress.md` now contains a `TDD Cycle Evidence` table with RED, GREEN, and triangulation/refactor evidence for WU1/WU2 SQL/RLS, WU3 frontend header cleanup, and WU4 config cleanup.

## Spec coverage

| Requirement | Coverage | Finding |
|---|---:|---|
| Trusted workshop resolver | PASS | `supabase/migrations/0020_tenant_rls_security.sql` rewrites `public.get_current_workshop_id()` to select `profiles.workshop_id` where `profiles.id = auth.uid()` and does not read client headers/JWT custom claims. |
| Workshops table RLS | PASS | Migration enables RLS and adds authenticated `SELECT`/`UPDATE` own-workshop policies; no direct `INSERT`/`DELETE` policies were added. |
| Cross-tenant CRUD denial | PASS | `supabase/tests/tenant_isolation.test.sql` covers forged-header SELECT denial, cross-tenant INSERT on `materials`, cross-tenant UPDATE on `clients`, own SELECT on `quotes`, missing profile on `tasks`, stock movement forged-header denial, and workshops visibility. |
| Representative table coverage | PASS | Covers `materials`, `clients`, `quotes`, `tasks`, `stock_movements`, and `workshops`; schema invariant also covers all listed tenant-scoped tables. |
| No request header authorization | PASS | `src/shared/lib/supabase.ts` has no `_headers`, `global.headers`, `setWorkshopId`, or `clearWorkshopId`; `AuthProvider` no longer imports/calls header mutation helpers. Historical migration `0004` and SQL tests still intentionally mention `x-workshop-id`. |
| Workshop context remains available for UI | PASS | `AuthProvider` retains `workshopId` state for UI/query narrowing only. |
| Fail-closed missing profile | PASS | SQL test confirms authenticated user without profile sees zero `tasks` rows. |

## Task completion status

| Work unit | Status | Notes |
|---|---:|---|
| WU1 SQL harness + RED tests | COMPLETE | Local Supabase config and pgTAP tests exist. WU1 report records expected RED failures: forged header exposed `materials`/`stock_movements`; `workshops` returned both rows. |
| WU2 Trusted RLS migration | COMPLETE | `0020_tenant_rls_security.sql` implements trusted resolver and workshops RLS. WU2 report records GREEN SQL tests. |
| WU3 Frontend header cleanup | COMPLETE | Frontend header mutation path removed; tests updated/added. |
| WU4 Config & verification | COMPLETE | `.env.example` no longer contains `VITE_WORKSHOP_ID`; final local verification passed. |

## Verification commands run

```bash
sg docker -c 'supabase test db' && npm test && npm run lint && npm run build
```

Result:

- `sg docker -c 'supabase test db'` — PASS, `Files=1, Tests=10`, `Result: PASS`.
- `npm test` — PASS, `Test Files 21 passed (21)`, `Tests 141 passed (141)`.
- `npm run lint` — PASS with warnings, `0 errors, 6 warnings` from existing React Hook Form `watch()` / React Compiler compatibility warnings.
- `npm run build` — PASS, Vite build completed successfully.

Additional static checks run:

```bash
grep -R "x-workshop-id\|_headers" -n src/ tests/ || true
grep -R "setWorkshopId\|clearWorkshopId" -n src/ tests/ | grep -v "setWorkshopIdState" || true
grep -R "VITE_WORKSHOP_ID" -n .env.example src/ tests/ || true
grep -R "request\.headers" -n supabase/migrations/0020_tenant_rls_security.sql src/ || true
```

Result: no output.

Broad grep still finds expected occurrences only in:

- `supabase/migrations/0004_rls_policies.sql` — historical superseded migration.
- `supabase/tests/tenant_isolation.test.sql` — intentional forged-header regression tests.
- `supabase/migrations/0020_tenant_rls_security.sql` — comment only.
- `src/shared/providers/AuthProvider.tsx` — `setWorkshopIdState`, a React state setter, not the removed Supabase header helper.

## Strict TDD compliance

| Check | Status | Finding |
|---|---:|---|
| Strict TDD active | YES | `openspec/config.yaml` has `testing.strict_tdd: true`, and the prompt explicitly required strict-TDD re-verification. |
| Support guidance file | N/A | Project-local `.pi/gentle-ai/support/strict-tdd-verify.md` was not present; default strict-TDD checks were applied. |
| `TDD Cycle Evidence` table in `apply-progress.md` | PASS | Table is present and includes RED/GREEN/TRIANGULATE evidence for WU1/WU2, WU3, and WU4. |
| RED evidence | PASS | WU1 report and `apply-progress.md` record 3 expected failed SQL tests before implementation. |
| GREEN evidence | PASS | WU2/WU3/WU4 reports record passing SQL/frontend/build verification; fresh re-run is green. |
| Reported test files exist | PASS | `supabase/tests/tenant_isolation.test.sql`, `src/shared/providers/AuthProvider.test.tsx`, and `src/shared/lib/supabase.test.ts` exist. |
| Assertion quality | PASS with warning | SQL assertions are meaningful. Frontend Supabase test checks deleted helper exports but not direct `createClient` options; static review covers absence of `global.headers`. |

## Assertion quality findings

- SQL pgTAP assertions are behavior-focused: forged header denial, cross-tenant insert/update denial, own-tenant access, workshops own-row visibility, missing profile fail-closed, and schema invariants.
- AuthProvider tests assert runtime state behavior for restored sessions, login, logout, missing workshop profile, sign out, and unsubscribe behavior.
- No tautological loops, type-only assertions alone, smoke-only tests, or CSS implementation-detail assertions were found.
- **Warning:** `src/shared/lib/supabase.test.ts` verifies deleted helper exports but does not directly assert the absence of `global.headers` in the client configuration. Static code review confirms no options object is passed to `createClient`.

## Review workload / PR boundary findings

**WARNING: review workload packaging remains unresolved, but it does not block verify per re-verification instruction.**

- `tasks.md` forecast: 350–500 changed lines, medium risk, chained PRs recommended, `delivery_strategy: auto-chain`, `Chain strategy: stacked-to-main`.
- `apply-progress.md` now records review packaging guidance and recommends stacked review slices.
- No explicit `size:exception` was found. Before PR review, split according to the stacked review slices or record an explicit exception.

## Migration renumbering implications

**WARNING: existing migration filenames were renumbered; keep as a deployment safety warning.**

The apply reports state that duplicate `0014` migration versions were resolved by renaming existing migrations through `0019_cut_pieces.sql`. This enabled local Supabase reset/test, but it can create remote migration-history drift if any old versions were already applied to a linked Supabase project. `apply-progress.md` now records remote migration safety notes. Do not run remote Supabase operations until a remote migration-history plan is reviewed.

## Exact blockers

None.

## Verification conclusion

The strict-TDD process blocker is resolved and fresh verification remains green. SDD 1 verify can be considered **PASS**, with non-blocking warnings for PR packaging/review workload and remote migration-history safety.
