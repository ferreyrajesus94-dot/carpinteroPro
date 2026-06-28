# Apply PR 3 Progress: Production Deduction Batch and RPCs

## Status

PR 3 implementation completed and verified.

## Scope applied

### New migration

`supabase/migrations/20260627000002_production_deduction_batch.sql`:

- Added `consumo_produccion` to `stock_movement_reason` enum.
- Added `production_deduction_id` column to `stock_movements` with index.
- Created `quote_production_stock_deductions` table with RLS, unique constraints `(workshop_id, quote_id)`, `(workshop_id, request_id)`, and `(workshop_id, reversal_request_id)`.
- Created `get_quote_production_deduction_preview(p_quote_id)` RPC — read-only preview that creates no movements.
- Created `start_quote_production(p_quote_id, p_confirm_deduction, p_request_id)` RPC — atomic production start with idempotency, status validation, BOM-based deduction, and controlled negative stock.
- Created `reverse_production_stock_deduction(p_deduction_id, p_reversal_reason, p_reversal_request_id)` RPC — whole-batch append-only reversal.

### API and hooks

- `src/features/quotes/api/productionStockDeduction.ts` — `fetchProductionDeductionPreview()`, `startQuoteProduction()`, `reverseProductionDeduction()`.
- `src/features/quotes/hooks/useProductionStockDeduction.ts` — `useProductionDeductionPreview()`, `useStartQuoteProduction()`, `useReverseProductionDeduction()` with cache invalidation and toast feedback.

### Types

- `src/shared/types/database.ts` — added `quote_production_stock_deductions` table entry, `production_deduction_id` to stock_movements Row/Insert/Update, `consumo_produccion` to enum, and three new RPC function entries.

### Label update

- `src/features/inventory/lib/stockMovementLabels.ts` — added `consumo_produccion: "Consumo producción"`.

### Pre-existing test fixtures

- `src/features/inventory/components/StockHistoryDialog.test.tsx` — added `production_deduction_id: null` to all movement fixtures (strict type requirement from the new column).

## Files changed

### New files

- `supabase/migrations/20260627000002_production_deduction_batch.sql`
- `src/features/quotes/api/productionStockDeduction.ts`
- `src/features/quotes/api/productionStockDeduction.test.ts`
- `src/features/quotes/hooks/useProductionStockDeduction.ts`
- `src/features/quotes/hooks/useProductionStockDeduction.test.ts`

### Modified files

- `src/shared/types/database.ts`
- `src/features/inventory/lib/stockMovementLabels.ts`
- `src/features/inventory/components/StockHistoryDialog.test.tsx`

## TDD evidence

### RED

Written before implementation:

- **API tests** (`productionStockDeduction.test.ts`): 10 tests covering preview RPC call parameters, start RPC with confirm=true/false, request_id idempotency, reversal RPC call parameters, and error handling for each function.
- **Hook tests** (`useProductionStockDeduction.test.ts`): 8 tests covering preview fetch, null guard, error state, start mutation with confirm=true/false, reverse mutation with reason, and error toasts.

### GREEN

- Migration with all three RPCs, table, enum value, and column additions.
- API functions wrapping the three RPCs.
- React hooks with TanStack Query queries/mutations, cache invalidation, and toast feedback.
- Database type updates for the new table, column, enum, and function signatures.
- Movement label addition for `consumo_produccion`.

### TRIANGULATE

- Manual-mode path: setting off → no batch/movements, status update succeeds.
- Idempotency: both `(workshop_id, quote_id)` unique constraint and client `request_id` support.
- Incomplete BOM lines: skipped with warning copy to batch `warning_summary`.
- Existing batch: idempotent return without duplicate movements.

### REFACTOR

- Transaction logic centralized in RPCs (single `start_quote_production` function, not split across client/server).
- Frontend wrappers thin and typed.
- No `any` types used.
- Named exports only for all new code.
- Feature boundaries respected: quotes feature owns production-start API/hooks.

## Verification

Commands run:

```bash
npx vitest run src/features/quotes/api/productionStockDeduction.test.ts
# 1 passed, 10 tests

npx vitest run src/features/quotes/hooks/useProductionStockDeduction.test.ts
# 1 passed, 8 tests

npx vitest run src/features/quotes/ src/features/settings/ src/features/inventory/
# 23 passed, 156 tests

npm test
# 103 passed, 768 tests

npm run lint
# 0 errors, 6 pre-existing React Hook Form watch() warnings

npx tsc -b
# passed, no output
```

## Parent recovery review notes

- Fixed migration ordering so `quote_production_stock_deductions` is created before `stock_movements.production_deduction_id` references it.
- Added `reversal_request_id` to the batch table/types plus a unique idempotency index for whole-batch reversal retries.
- Added `admin` / `operational` role gating to `reverse_production_stock_deduction`, matching the existing single-movement reversal authorization model.
- Fixed reviewer-confirmed blocker in `start_quote_production`: the quote status and batch status now use separate variables (`v_quote_status` / `v_batch_status`) so a no-row batch idempotency query cannot null out the quote-status guard. The guard now uses `IS DISTINCT FROM 'aprobado'`.
- Removed the dead `v_new_stock` declaration and added non-empty reversal reason validation for whole-batch reversal.

## Known non-blockers

- SQL/RLS tests require a Supabase-local deployment or pgTAP test runner and cannot run in the Vitest environment. The RPC contracts are covered at the API wrapper level through mocked Supabase calls.
- The `start_quote_production` RPC calls `gen_random_uuid()` as the default `p_request_id`. If concurrent requests for the same quote use the default, the unique `(workshop_id, quote_id)` constraint prevents duplicates rather than the request_id. PR 4 UI should always generate a client-side request_id for safe retries.
- The plate nesting approximation in PR 2's approved BOM capture (`_compute_plate_boards_needed`) is reused. The production-start RPC reads BOM lines as-is; accuracy depends on the capture RPC.

## Residual risks

- RLS on new tables is enabled with all 4 policies (S/I/U/D) scoped to `get_current_workshop_id()`. If the `workshop_settings` or `quote_approved_bom_lines` queries receive insufficient RLS for the caller's profile, the RPC will fail.
- PR 1/2 changes are preserved and untouched.

## Next recommended

Proceed to PR 4 (production-start UI) after review confirms the batch/RPC schema is correct and contracts are properly typed.
