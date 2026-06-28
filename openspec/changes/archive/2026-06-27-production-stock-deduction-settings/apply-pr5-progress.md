# Apply PR 5 Progress: Ledger/export/reporting and batch reversal guidance

## Status

PR 5 implementation completed and verified.

## Scope applied

- Extended `get_stock_movement_ledger` and `get_stock_movement_detail` RPCs to return `production_deduction_id`, `is_production_deduction`, and `production_deduction_status` via LEFT JOIN to `quote_production_stock_deductions`.
- Updated manually maintained `database.ts` function return types.
- Added inventory-owned `reverseProductionDeduction` API + `useReverseProductionDeduction` hook that calls the existing `reverse_production_stock_deduction` RPC directly, avoiding cross-feature imports.
- Updated CSV export with `origen_produccion`, `presupuesto`, `production_deduction_id` columns.
- Updated `StockMovementLedgerTable` with production indicator (Factory icon) and quote reference for production-origin rows.
- Updated `StockMovementDetailPage` with production batch context section and batch reversal CTA (textarea + button) for production-origin rows.
- Updated all typed test fixtures with new production fields.
- Filters continue to work for `consumo_produccion`; no dashboard implemented.

### Files changed

#### New files

- `supabase/migrations/20260627000003_production_deduction_ledger_columns.sql`

#### Modified files

- `src/shared/types/database.ts` — added 3 production fields to both RPC return types
- `src/features/inventory/api/stockMovements.ts` — added `reverseProductionDeduction` API function + types
- `src/features/inventory/api/stockMovements.test.ts` — added `reverseProductionDeduction` tests
- `src/features/inventory/hooks/useStockMovements.ts` — added `useReverseProductionDeduction` hook
- `src/features/inventory/hooks/useStockMovements.test.ts` — added `useReverseProductionDeduction` tests
- `src/features/inventory/lib/stockMovementCsv.ts` — added 3 CSV columns
- `src/features/inventory/lib/stockMovementCsv.test.ts` — added production row test + updated header/fixtures
- `src/features/inventory/components/StockMovementLedgerTable.tsx` — added production badge + quote reference column
- `src/features/inventory/components/StockMovementLedgerTable.test.tsx` — added production row fixture + assertions
- `src/features/inventory/components/StockMovementDetailPage.tsx` — added batch context + batch reversal CTA
- `src/features/inventory/components/StockMovementDetailPage.test.tsx` — added production detail fixtures + batch reversal tests
- `src/features/inventory/components/StockMovementLedgerPage.test.tsx` — added production fields to fixture
- `src/features/inventory/index.ts` — exported new types/hooks/API

## TDD evidence

### RED

- CSV tests for production row columns (failing until implementation)
- Ledger table test for production badge and quote reference
- Detail page tests for batch context, batch reversal CTA, reversed state, and batch reversal submission
- API tests for `reverseProductionDeduction` parameter mapping, idempotency, and error handling
- Hook tests for `useReverseProductionDeduction` parameter forwarding and cache invalidation

### GREEN

- Migration extending both RPCs
- `database.ts` type updates
- Inventory API/hook wrappers for batch reversal
- CSV column additions
- Ledger table production indicator
- Detail page production batch context + batch reversal CTA
- All typed fixture updates

### TRIANGULATE

- Reversed batch state hides reversal CTA and shows "lote ya fue revertido"
- Individual reversal still available alongside batch CTA for production rows
- Non-production rows do not show batch section
- Caller-supplied `reversalRequestId` preserved in API and hook

### REFACTOR

- Inventory-owned RPC wrapper avoids cross-feature import from quotes
- No `any` types used
- Named exports only
- Feature boundaries respected

## Verification

Commands run:

```bash
npx vitest run src/features/inventory/
# Test Files 14 passed (14), Tests 106 passed (106)

npx vitest run
# Test Files 104 passed (104), Tests 790 passed (790)

npm run lint
# 0 errors, 6 pre-existing React Hook Form watch() warnings

npx tsc -b
# passed with no output
```

## Known non-blockers

- The detail page batch reversal CTA works through inventory-owned hook. Cross-feature import rules are respected; the RPC is called directly from inventory API.
- `supabase/.temp/cli-latest` was already dirty before this work.
- SQL/RLS/pgTAP tests for the RPC changes require Supabase-local deployment and cannot run in Vitest.
- Filters already include `consumo_produccion` via `REASON_OPTIONS` (PR 3); no filter changes needed.
- CSV column position shifted (3 new columns appended). If downstream automation relies on positional indexes, they need updating.

## Residual risks

- If `reverse_production_stock_deduction` RPC receives permissions or role-gating changes in future PRs, the inventory wrapper will inherit those changes automatically.
- Migration extends RPCs without dropping existing function signatures; if other tools or environments call these RPCs with positional arguments, the additional columns at end of return type should be backward-compatible.
- Production/reporting dashboard widgets remain explicitly out of first scope per design.md.

## Next recommended

Run a fresh review of the PR 5 diff, then proceed to final verification and archive.
