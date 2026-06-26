# Apply Progress — PR 1: Backend migration, database.ts types, SQL tests

## Completed

All tasks from Work Unit 1 / PR 1 are complete.

### T1.1 — RED: SQL test for creator attribution

- **File:** `supabase/tests/stock_movement_creator.test.sql`
- Result: 1 failure (created_by = NULL ≠ user_a UUID) — **RED confirmed**
- Cross-workshop denial uses P0001 (generic exception) not 42501 because RLS filters the material first

### T1.2 — GREEN: Update `apply_stock_movement` with `created_by = auth.uid()`

- **File:** `supabase/migrations/20260624120000_creator_attribution_and_ledger_rpc.sql`
- Copied existing hardened function body, added `created_by` to INSERT columns
- Re-ran T1.1 — **PASS** (all 5 tests)

### T1.3 — RED: SQL test for `get_stock_movement_ledger`

- **File:** `supabase/tests/stock_movement_ledger.test.sql`
- Result: Function doesn't exist — **RED confirmed**
- Fixed plan count from 13 to 11

### T1.4 — GREEN: Add `get_stock_movement_ledger` migration

- Same migration file
- SECURITY INVOKER, workshop derivation from `auth.uid() -> profiles.workshop_id`
- Clamped limit [1, 500], offset >= 0
- Fixed profiles column from `name` to `display_name`
- Re-ran T1.3 — **PASS** (all 11 tests)

### T1.5 — TRIANGULATE: Cross-workshop denial

- Added test in creator test file
- Cross-workshop material triggers RLS invisibility → generic exception → no movement inserted
- Re-ran all SQL tests — **PASS**

### T1.6 — database.ts function types

- Added `get_stock_movement_ledger` under `public.Functions`
- `npx tsc --noEmit` — **clean** (exit 0)

### T1.7 — REFACTOR

- Migration uses `CREATE OR REPLACE` for both functions (idempotent)
- Both functions documented with `COMMENT ON FUNCTION`
- No unnecessary `SET search_path` changes
- All SQL test files re-run — **PASS**

## TDD Cycle Evidence

| Phase | Test File | Result |
|-------|-----------|--------|
| RED (T1.1) | `stock_movement_creator.test.sql` | 1/5 failed — created_by is NULL |
| GREEN (T1.2) | `stock_movement_creator.test.sql` | 5/5 passed |
| RED (T1.3) | `stock_movement_ledger.test.sql` | function does not exist |
| GREEN (T1.4) | `stock_movement_ledger.test.sql` | 11/11 passed |
| TRIANGULATE (T1.5) | Both SQL test files | All passed (68/68 across 5 files) |
| REFACTOR (T1.7) | Both SQL test files | All passed (68/68 across 5 files) |

## Files Changed

- `supabase/migrations/20260624120000_creator_attribution_and_ledger_rpc.sql` (new)
- `supabase/tests/stock_movement_creator.test.sql` (new)
- `supabase/tests/stock_movement_ledger.test.sql` (new)
- `src/shared/types/database.ts` (updated — added get_stock_movement_ledger function type)

## Test Commands Run

- `supabase db test` — 5 files, 68 tests, Result: PASS
- `npx tsc --noEmit` — clean

## Deviations from Design

1. Cross-workshop denial raises P0001 (not 42501) because RLS on `materials` table filters the material before the function reaches the explicit errcode check. Test updated to expect generic exception.
2. `profiles` table uses `display_name` (not `name`). Migration uses `pr.display_name AS creator_name`.

## Remaining Tasks (PR 2–4)

PR 2: API layer + hooks + unit tests (T2.1–T2.7)
PR 3: Ledger route, table, filters, component tests (T3.1–T3.9)
PR 4: CSV export, public API exports, StockAdjustDialog test (T4.1–T4.7)

## Workload / PR Boundary

PR 1 completed. Ready for PR 2.

## Status Consumed

SDD status for `2026-06-24-inventory-stock-movements` resolved from native SDD status engine.
applyState was `blocked` — now partially unblocked (PR 1 complete).
