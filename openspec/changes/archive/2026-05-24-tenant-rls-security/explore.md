# SDD 1 Explore Report — Tenant Security / RLS

## Quick Answer

The app relies on a **client-controlled `x-workshop-id` HTTP header** for all RLS tenant isolation. A malicious user can set any workshop UUID in this header and access or mutate another tenant's data. Thirteen tables depend on `get_current_workshop_id()`, which reads the header via `current_setting('request.headers')`. The fix is to replace this function with a server-trusted lookup: `auth.uid() → profiles.workshop_id`. No SQL test infrastructure exists yet.

---

## 1. Tenant Identity Flow Audit

### 1.1 Frontend → Database Path

| Step | File / Layer | Behavior | Risk |
|------|-------------|----------|------|
| 1 | `src/shared/lib/supabase.ts` | Creates a mutable `_headers` object injected into every Supabase client request as `global: { headers: _headers }`. | Client-side header injection. |
| 2 | `src/shared/providers/AuthProvider.tsx` | After login, loads `profiles.workshop_id` and calls `setWorkshopId(data.workshop_id)`, which mutates `_headers['x-workshop-id']`. | Correct data, wrong transport. |
| 3 | `src/shared/hooks/useWorkshopId.ts` | Returns `workshopId` from auth context for UI state. | Innocuous for UI only. |
| 4 | `src/features/*/api/*.ts` | Many queries include `.eq('workshop_id', workshopId)` as an explicit filter. | Defense in depth; not the security boundary. |
| 5 | PostgreSQL RLS policies | All policies call `get_current_workshop_id()`, which reads `request.headers->>'x-workshop-id'`. | **Security boundary trusts client.** |

### 1.2 Root Function (Vulnerable)

**File:** `supabase/migrations/0004_rls_policies.sql`

```sql
CREATE OR REPLACE FUNCTION get_current_workshop_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  header_value text;
BEGIN
  header_value := (current_setting('request.headers', true)::json)->>'x-workshop-id';
  IF header_value IS NOT NULL AND header_value <> '' THEN
    RETURN header_value::uuid;
  END IF;
  RETURN NULL;
END;
$$;
```

This function is `STABLE` (not `IMMUTABLE`) and `SECURITY DEFINER`, but the header source is untrusted.

---

## 2. Migrations, Policies, Functions & Triggers Inventory

### 2.1 Tables with RLS Enabled (and their policies)

| Table | Migration | Policy Pattern | Uses `get_current_workshop_id()`? |
|-------|-----------|----------------|-----------------------------------|
| `materials` | 0001, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `price_history` | 0001, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `furniture_templates` | 0002, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `recipe_items` | 0002, 0004, 0016 | Direct `workshop_id` check | ✅ Yes |
| `labor_items` | 0010, 0016 | Direct `workshop_id` check | ✅ Yes (after 0016) |
| `clients` | 0003, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `quotes` | 0003, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `quote_extras` | 0003, 0004, 0016 | Direct `workshop_id` check | ✅ Yes |
| `contract_templates` | 0003, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `workshop_settings` | 0003, 0004 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `stock_movements` | 0007 | Separate S/I/U/D policies | ✅ Yes |
| `tasks` | 0014 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `cut_pieces` | 0018 | `workshop_id = get_current_workshop_id()` | ✅ Yes |
| `profiles` | 0005 | `auth.uid() = id` (self-only) | ❌ No — uses auth |
| `workshops` | 0005 | **NO RLS ENABLED** | ❌ N/A — **exposed** |

### 2.2 Notable Inconsistencies Found

- **`0010_recipe_labor_waste.sql`** (pre-0016): The `labor_items` policy used `current_setting('request.jwt.claim.workshop_id', true)::uuid` — a non-existent JWT claim. The `WITH CHECK` clause also failed to verify workshop ownership, only checking `furniture_template` existence. Migration `0016` replaced this with direct `workshop_id` checks, but the migration history reveals mixed and untested approaches.
- **`workshops` table**: No RLS policies at all. Any authenticated user can `SELECT * FROM workshops` and discover other tenants' names.

### 2.3 Autofill Triggers

**File:** `supabase/migrations/0017_workshop_id_autofill_triggers.sql`

Five `BEFORE INSERT` triggers auto-fill `workshop_id` on child tables from their parent:

- `recipe_items` ← `furniture_templates`
- `labor_items` ← `furniture_templates`
- `quote_extras` ← `quotes`
- `quote_recipe_snapshots` ← `quotes`
- `quote_labor_snapshots` ← `quotes`

**File:** `supabase/migrations/0018_cut_pieces.sql`

- `cut_pieces` ← `recipe_items`

These triggers are helpful but do not replace RLS. They ensure `NOT NULL` constraints are satisfied when the frontend omits `workshop_id`, but a malicious client can still override the column directly on `INSERT` or `UPDATE` unless RLS `WITH CHECK` blocks it.

### 2.4 RPC Functions Using `workshop_id`

| Function | File | Accepts `workshop_id`? | Notes |
|----------|------|------------------------|-------|
| `generate_quote_number(p_workshop_id uuid)` | 0003 | **Yes** — parameter | Caller passes it. RLS on `quotes` still enforces, but the RPC itself does not verify ownership before scanning. |
| `apply_stock_movement(...)` | 0007 | No — derives from `materials.workshop_id` | Internally looks up `materials.workshop_id`. Safe pattern. |
| `handle_new_user()` | 0005, 0015 | No — creates workshop + profile | Trigger on `auth.users`. Safe. |

---

## 3. All Tables / Policies Depending on `get_current_workshop_id()`

A grep across all migrations confirms **24 policy definitions** reference `get_current_workshop_id()`:

- `0004_rls_policies.sql`: 10 policies (materials, price_history, furniture_templates, recipe_items, clients, quotes, quote_extras, contract_templates, workshop_settings)
- `0007_stock_movements.sql`: 4 policies (select, insert, update, delete)
- `0012_quote_recipe_snapshots.sql`: 4 references inside `EXISTS` subqueries
- `0014_tasks.sql`: 1 policy
- `0016_child_tables_workshop_id.sql`: 5 policies (recipe_items, labor_items, quote_extras, quote_recipe_snapshots, quote_labor_snapshots)
- `0018_cut_pieces.sql`: 1 policy

**Total affected tables: 13** (excluding `profiles` and `workshops`).

---

## 4. Secure Design Options — Tradeoffs

### Option A: `auth.uid() → profiles.workshop_id` Lookup (Recommended)

Replace `get_current_workshop_id()` with:

```sql
CREATE OR REPLACE FUNCTION get_current_workshop_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT workshop_id FROM public.profiles WHERE id = auth.uid();
$$;
```

**Pros:**
- Single source of truth (`profiles` table).
- No client header needed.
- Fails closed: missing profile → `NULL` → RLS denies.
- Minimal infrastructure change.

**Cons:**
- Subquery on every RLS evaluation (performance cost, mitigated by `profiles(id)` PK index).
- `auth.uid()` requires Supabase Auth session; anon users get `NULL`.

### Option B: Custom JWT Claim (`app_metadata.workshop_id`)

Sync `workshop_id` into `auth.users.raw_user_meta_data` or Supabase custom claims, then read via `auth.jwt()->'app_metadata'->>'workshop_id'`.

**Pros:**
- Zero DB lookup per RLS check (fastest).
- Claim travels with the JWT automatically.

**Cons:**
- Requires edge function or auth hook to update claims when workshop changes.
- Supabase custom claims setup is project-level infrastructure.
- Claim can become stale if workshop_id changes (edge case).

### Option C: Hybrid — Lookup + Cache

Option A for launch, with a migration path to Option B if RLS latency becomes measurable.

**Decision:** Adopt **Option A** for SDD 1. It is the simplest, most robust path to production. Option B can be evaluated in a future SDD (e.g., SDD-8 Architecture cleanup) if profiling shows RLS evaluation as a bottleneck.

---

## 5. Frontend Changes Required

| File | Change | Notes |
|------|--------|-------|
| `src/shared/lib/supabase.ts` | Remove `_headers`, `setWorkshopId()`, `clearWorkshopId()`, and `global: { headers: _headers }` from client config. | The Supabase client should no longer send `x-workshop-id`. |
| `src/shared/providers/AuthProvider.tsx` | Remove imports and calls to `setWorkshopId` / `clearWorkshopId`. | Keep `workshopId` in state for **UI only** (display, filtering local data). |
| `src/shared/hooks/useWorkshopId.ts` | No logic change needed; it reads from AuthContext. | Continue using for UI state. |
| `src/features/*/api/*.ts` | **Keep** `.eq('workshop_id', workshopId)` where present. | Defense in depth + query performance. RLS is the real gatekeeper. |

---

## 6. Test Strategy Options for SQL / RLS Isolation

### 6.1 Current State

- **No SQL tests exist.** No pgTAP, no Supabase CLI local test harness, no `supabase/config.toml`.
- Frontend tests use Vitest + jsdom + mocked Supabase client. They cannot test actual RLS behavior.

### 6.2 Viable Strategies

| Strategy | Tooling | Effort | Coverage | Recommendation |
|----------|---------|--------|----------|----------------|
| **A. Migration-level assertions** | Inline `DO $$ ASSERT ... END $$;` blocks in migration SQL | Low | Schema invariants only | **Adopt** for NOT NULL, index, and function-existence checks. |
| **B. pgTAP via Supabase CLI** | `supabase test db` with `supabase/config.toml` + pgTAP extension | Medium | Full RLS isolation tests | **Adopt** as the primary SQL test strategy. Requires initializing local Supabase config. |
| **C. Integration tests against test project** | Vitest + live `supabase-js` client against a dedicated Supabase project | Medium-High | End-to-end tenant denial | Optional backup; requires CI secrets and project management. |

### 6.3 Recommended Test Plan

1. **Initialize `supabase/config.toml`** (if not present) to enable `supabase test db`.
2. **Add a pgTAP test migration** (e.g., `supabase/tests/tenant_isolation.test.sql`) that:
   - Creates two workshops, two users, two profiles.
   - Inserts a row in each affected table for workshop A.
   - Authenticates as user B and asserts `SELECT` returns zero rows.
   - Authenticates as user A and asserts `SELECT` returns the rows.
   - Attempts `INSERT` into workshop B as user A and asserts failure.
3. **Add one frontend Vitest test** for `AuthProvider` confirming `setWorkshopId` is no longer called after login (to verify the header path is removed).

---

## 7. Missing Profile / Fail-Closed Behavior

With Option A, if a user authenticates but has no `profiles` row, `get_current_workshop_id()` returns `NULL`. Because every RLS policy uses `workshop_id = get_current_workshop_id()`, this evaluates to `workshop_id = NULL` → `NULL` (falsy) → **deny access**.

This is the correct fail-closed behavior, but the UX will be broken (blank app, silent failures). **SDD-3 (Auth/profile hardening)** should address explicit error handling for missing profiles. For SDD-1, we only need to ensure the security boundary is correct.

---

## 8. Risks & Launch Blockers

| Risk | Severity | Mitigation in SDD-1 |
|------|----------|---------------------|
| Client can forge `x-workshop-id` to access any tenant | **Critical** | Remove header path; replace function with `auth.uid() → profiles` lookup. |
| `workshops` table has no RLS | **High** | Add `workshop_isolation_workshops` policy or restrict to `auth.uid() = profiles.id` join. |
| No SQL tests exist | **High** | Add pgTAP or migration assertions as the first task in apply phase. |
| `generate_quote_number` RPC accepts `p_workshop_id` param | Medium | Keep as-is; RLS on `quotes` still blocks cross-workshop access. The RPC only reads `quotes`, which is RLS-protected. |
| Frontend tests mock Supabase; RLS bypass not tested | Medium | Add at least one integration-style test or manual verification checklist. |
| Mixed JWT claim attempts in migration history | Low | No runtime impact; `0016` replaced the broken policy. Document for cleanup in SDD-8. |

---

## 9. Checklist for Next Phases

- [ ] `get_current_workshop_id()` rewritten to `SELECT workshop_id FROM profiles WHERE id = auth.uid()`.
- [ ] `x-workshop-id` header injection removed from `supabase.ts`.
- [ ] `setWorkshopId` / `clearWorkshopId` removed from `AuthProvider`.
- [ ] `workshops` table RLS enabled with appropriate policy.
- [ ] All 13 tenant tables verified to use the new function (or equivalent auth-derived check).
- [ ] SQL test proves user A cannot read user B's rows in at least one representative table per feature (inventory, recipes, CRM, quotes, tasks, stock).
- [ ] SQL test proves `INSERT` with mismatched `workshop_id` is denied.
- [ ] Frontend tests updated to reflect removed `setWorkshopId` calls.
- [ ] `.env.example` updated to remove `VITE_WORKSHOP_ID` (no longer needed client-side).

---

## 10. Next Recommended Step

Proceed to **SDD-1 Proposal phase**: write a 1-page proposal with:
1. Scope: replace `get_current_workshop_id()`, remove client header, add `workshops` RLS.
2. Acceptance criteria: cross-tenant denial in SQL tests + no frontend header injection.
3. Risk assessment: performance of subquery in RLS, missing profile UX (deferred to SDD-3).

---

## Phase Result Envelope

| Field | Value |
|-------|-------|
| **status** | `explore_complete` |
| **executive_summary** | The tenant isolation boundary is fundamentally broken: `get_current_workshop_id()` trusts the client-controlled `x-workshop-id` header. Thirteen tables depend on it. The fix is a server-trusted `auth.uid() → profiles.workshop_id` lookup. No SQL test infrastructure exists yet and must be created during apply. |
| **artifacts** | `qa/sdd-1-explore-report.md` (this file), `openspec/changes/tenant-rls-security/explore.md` |
| **next_recommended** | `proposal` — write 1-page proposal with acceptance criteria and risk assessment. |
| **risks** | Critical: client header forgery. High: no RLS on `workshops`, no SQL tests. Medium: RPC params, mocked frontend tests. |
| **skill_resolution** | `paths-injected` — loaded `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md` before work. |

---

## Important Discoveries for Engram

If memory tools become available, save these observations:

- **Discovery: `0010_recipe_labor_waste.sql` had a broken RLS policy** using non-existent `request.jwt.claim.workshop_id` and an incomplete `WITH CHECK`. Replaced by `0016` but indicates untested migration history.
- **Discovery: `workshops` table lacks RLS entirely.** Any authenticated user can enumerate all workshops.
- **Discovery: No `supabase/config.toml` exists.** Local Supabase testing is not initialized; pgTAP tests will require `supabase init` or project-level test setup.
- **Pattern: `BEFORE INSERT` autofill triggers** (`0017`, `0018`) are a helpful pattern for child-table `workshop_id` but do not replace RLS enforcement.

---

**File write note:** This report should be written to `/home/elias/Proyectos/carpinteroPro/qa/sdd-1-explore-report.md` and duplicated at `/home/elias/Proyectos/carpinteroPro/openspec/changes/tenant-rls-security/explore.md` (create the `openspec/changes/tenant-rls-security/` directory). I do not have file-write tools in this session; please create these files from the content above.