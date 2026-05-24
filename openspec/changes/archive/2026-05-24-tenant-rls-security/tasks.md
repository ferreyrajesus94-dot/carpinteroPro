# SDD 1 Tasks: Tenant RLS Security

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–500 (additions + deletions) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (SQL harness + RED tests) → PR 2 (RLS migration + workshops policies) → PR 3 (frontend cleanup + Vitest) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium
```

## Goal

Replace client-controlled `x-workshop-id` header authorization with server-derived tenant identity via `auth.uid() → profiles.workshop_id`. Harden all RLS policies, protect the `workshops` table, and prove cross-tenant isolation with SQL tests before any policy change lands.

## Rules

- **Strict TDD is active.** Every SQL/RLS change must be preceded by a failing RED test.
- No destructive remote operations (`supabase db push`, `supabase db reset --linked`, `vercel deploy`, etc.).
- All client queries continue through `@/shared/lib/supabase`.
- No service-role key in frontend.
- Missing/broken profile state must **fail closed**; UX hardening is deferred to SDD-3.

---

## Work Unit 1: SQL Test Harness + RED Tests

**Commit boundary:** `test(rls): add tenant isolation SQL tests`
**Rollback scope:** Delete `supabase/config.toml` and `supabase/tests/` only.

### Task 1.1 — Initialize local Supabase test harness

- [ ] Create `supabase/config.toml` via `supabase init` (or hand-write a minimal local-only config).
- [ ] Ensure `config.toml` has **no** linked production project ID or remote secrets.
- [ ] Confirm `supabase start` can launch a local Postgres instance.

**Acceptance evidence:** `supabase status` shows local services running.

### Task 1.2 — Write pgTAP RED tests

- [ ] Create `supabase/tests/tenant_isolation.test.sql`.
- [ ] Required RED test coverage (must **fail** against current header-based `get_current_workshop_id()`):
  1. **Forged header SELECT denial:**
     - Create workshops W1, W2; users U_A, U_B; profiles linking each user to their workshop.
     - Insert a row into `materials` with `workshop_id = W1`.
     - Set auth context to U_B (via `SET LOCAL ROLE authenticated` + `request.jwt.claim.sub`).
     - Also set `request.headers` with `x-workshop-id = W1` (simulates forged header).
     - Assert `SELECT` returns zero rows (current code would wrongly return the row).
  2. **Cross-tenant INSERT denial (materials):**
     - Auth as U_A (workshop W1).
     - Attempt `INSERT INTO materials (workshop_id, ...) VALUES (W2, ...)`.
     - Assert denied by `WITH CHECK`.
  3. **Cross-tenant UPDATE denial (clients):**
     - Auth as U_A (workshop W1).
     - Insert a client with `workshop_id = W1`.
     - Attempt `UPDATE clients SET workshop_id = W2 WHERE id = ...`.
     - Assert denied by `WITH CHECK`.
  4. **Own-tenant access confirmation (quotes):**
     - Auth as U_A (workshop W1).
     - Insert a quote with `workshop_id = W1`.
     - Assert `SELECT` returns the row.
  5. **Workshops RLS SELECT:**
     - Auth as U_A (workshop W1).
     - Assert `SELECT * FROM workshops` returns only the row where `id = W1`.
  6. **Missing profile fail-closed (tasks):**
     - Create an auth user with **no** profile row.
     - Set auth context to that user.
     - Assert `SELECT * FROM tasks` returns zero rows.
  7. **Representative tables:** cover at least `materials`, `clients`, `quotes`, `tasks`, `stock_movements`, and `workshops`.

**Acceptance evidence:** `supabase test db` runs and **fails** with the current migrations (RED state).

### Task 1.3 — Add migration-level existence assertions

- [ ] In a local-only assertion script or inline in the test file, verify:
  - `get_current_workshop_id()` exists.
  - `profiles(id)` has a primary-key or unique index.
  - All tenant-scoped tables have `workshop_id uuid NOT NULL`.

**Acceptance evidence:** Assertions pass on the local database schema before RLS changes.

---

## Work Unit 2: Trusted RLS Migration

**Commit boundary:** `fix(rls): derive workshop from authenticated profile`
**Rollback scope:** Revert `supabase/migrations/0020_tenant_rls_security.sql`.

### Task 2.1 — Rewrite `get_current_workshop_id()`

- [ ] Create `supabase/migrations/0020_tenant_rls_security.sql`.
- [ ] Replace `get_current_workshop_id()` with:

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

- [ ] The new function must **not** reference `request.headers`, `request.jwt.claims`, or any client-controlled value.

**Acceptance evidence:** `\sf public.get_current_workshop_id` in `psql` shows the new SQL body.

### Task 2.2 — Add `workshops` RLS policies

- [ ] In the same migration:
  - `ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;`
  - `CREATE POLICY workshops_select_own ON public.workshops FOR SELECT USING (id = public.get_current_workshop_id());`
  - `CREATE POLICY workshops_update_own ON public.workshops FOR UPDATE USING (id = public.get_current_workshop_id()) WITH CHECK (id = public.get_current_workshop_id());`
- [ ] Do **not** add `INSERT` or `DELETE` policies for `workshops`; `handle_new_user()` creates workshops as `SECURITY DEFINER`.

**Acceptance evidence:** `\d workshops` shows RLS enabled and the two policies listed.

### Task 2.3 — GREEN: confirm SQL tests pass

- [ ] Run `supabase test db` after applying the migration locally.
- [ ] All RED tests from Work Unit 1 must now pass.

**Acceptance evidence:** `supabase test db` output shows all tests passing (GREEN state).

---

## Work Unit 3: Frontend Header Cleanup

**Commit boundary:** `fix(auth): remove workshop header injection`
**Rollback scope:** Revert changes to `src/shared/lib/supabase.ts`, `src/shared/providers/AuthProvider.tsx`, and related tests.

### Task 3.1 — Remove header mutation from Supabase client

- [ ] Edit `src/shared/lib/supabase.ts`:
  - Remove `const _headers: Record<string, string> = {}`.
  - Remove `global: { headers: _headers }` from `createClient` options.
  - Remove `export function setWorkshopId(...)`.
  - Remove `export function clearWorkshopId(...)`.
- [ ] Keep the typed `supabase` export and environment validation.

**Acceptance evidence:**
- `grep -n "x-workshop-id\|setWorkshopId\|clearWorkshopId\|_headers" src/shared/lib/supabase.ts` returns zero matches.
- `npm run lint` passes.

### Task 3.2 — Remove header calls from AuthProvider

- [ ] Edit `src/shared/providers/AuthProvider.tsx`:
  - Change import to `import { supabase } from '@/shared/lib/supabase'` (remove `setWorkshopId`, `clearWorkshopId`).
  - In `loadProfile`, remove the call to `setWorkshopId(data.workshop_id)`; keep only `setWorkshopIdState(data.workshop_id)`.
  - In `onAuthStateChange` logout path, remove `clearWorkshopId()`; keep only React state cleanup.
- [ ] Do **not** add fallback workshop IDs or default values.

**Acceptance evidence:**
- `grep -n "setWorkshopId\|clearWorkshopId" src/shared/providers/AuthProvider.tsx` returns zero matches (except React state setter `setWorkshopIdState`).
- `npm run lint` passes.

### Task 3.3 — Update AuthProvider unit tests

- [ ] Edit `src/shared/providers/AuthProvider.test.tsx`:
  - Remove `setWorkshopId` and `clearWorkshopId` from the `vi.mock('@/shared/lib/supabase', ...)` mock.
  - Remove assertions that expect `setWorkshopId` or `clearWorkshopId` to have been called.
  - Add assertions that `workshopId` state is set/cleared correctly via `useAuth()` hook result (existing coverage may already do this).
  - Keep all other existing tests (session restore, sign out, unmount, error boundary).

**Acceptance evidence:** `npm test` passes for the AuthProvider test suite.

### Task 3.4 — Add Supabase client unit test (no header injection)

- [ ] Create `tests/shared/lib/supabase.test.ts`:
  - Test that `@/shared/lib/supabase` does **not** export `setWorkshopId` or `clearWorkshopId`.
  - Test that the exported `supabase` client has no `global.headers` workshop injection configured.
  - Mock `import.meta.env` to provide required env vars.

**Acceptance evidence:** `npm test` passes and the new test file runs successfully.

---

## Work Unit 4: Configuration & Verification

**Commit boundary:** `chore(env): remove obsolete VITE_WORKSHOP_ID and add verification`
**Rollback scope:** Revert `.env.example` and doc/checklist changes only.

### Task 4.1 — Clean up `.env.example`

- [ ] Remove `VITE_WORKSHOP_ID` from `.env.example`.

**Acceptance evidence:** `grep VITE_WORKSHOP_ID .env.example` returns no matches.

### Task 4.2 — Static review for forbidden patterns

- [ ] Run:

```bash
grep -R "x-workshop-id\|setWorkshopId\|clearWorkshopId\|request\.headers" src/ supabase/migrations/ supabase/tests/ || echo "No forbidden patterns found"
```

**Acceptance evidence:** Command outputs "No forbidden patterns found" (or equivalent empty result).

### Task 4.3 — Full local verification checklist

- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `supabase test db` passes.
- [ ] Manual check: confirm `supabase/config.toml` has no production project reference.
- [ ] Manual check: confirm `src/shared/lib/supabase.ts` does not export `setWorkshopId`/`clearWorkshopId`.
- [ ] Manual check: confirm `workshops` table has RLS enabled and only `select_own`/`update_own` policies.

**Acceptance evidence:** All checklist items signed off; no errors in any command output.

---

## Verification Commands

```bash
# SQL/RLS tests
supabase start
supabase test db

# Frontend tests + static checks
npm test
npm run lint
npm run build

# Forbidden-pattern sweep
grep -R "x-workshop-id\|setWorkshopId\|clearWorkshopId\|request\.headers" src/ supabase/migrations/ supabase/tests/ || echo "Clean"
```

## Stop Conditions

1. **RED tests do not fail before migration** → Do not proceed to Work Unit 2. Fix test assertions or harness setup.
2. **GREEN tests do not pass after migration** → Do not proceed to Work Unit 3. Debug `get_current_workshop_id()` or `workshops` policies.
3. **`npm test` fails after frontend cleanup** → Do not proceed to Work Unit 4. Fix imports, mocks, or test assertions.
4. **Forbidden pattern grep finds matches** → Do not consider the phase complete. Remove all occurrences.
5. **Any remote/destructive operation triggered** → Halt immediately; remote safety is a hard constraint.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Local Supabase config missing | High | Create minimal `supabase/config.toml` in Work Unit 1; never link/push/reset remote. |
| pgTAP/auth context friction | Medium | Use `SET LOCAL ROLE` + `request.jwt.claim.sub`; fallback to local SQL assertions if pgTAP blocks. |
| RLS lookup performance | Medium | `profiles.id` is PK; defer JWT-claim optimization to SDD-8 if profiling requires it. |
| Missing profile UX confusion | Medium | Fail closed now; SDD-3 owns UX hardening. |
| Review budget overflow | Medium | Work-unit commits map to chained PRs if total diff exceeds 400 lines. |

## Out of Scope

- Billing, MercadoPago, subscription gates (SDD-2).
- Missing-profile recovery flows, auth UX hardening (SDD-3).
- Cache/PWA privacy, service worker changes (SDD-4).
- Observability, error reporting, support IDs (SDD-6).
- End-to-end browser tests (SDD-7).
- Architecture cleanup, custom JWT claims (SDD-8).
- RPC parameter validation (e.g., `generate_quote_number`).
