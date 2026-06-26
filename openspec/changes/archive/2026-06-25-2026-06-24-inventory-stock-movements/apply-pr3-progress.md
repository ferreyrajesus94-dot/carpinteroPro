# Apply Progress — PR 3 Ledger UI

## Status

Completed.

## Scope

Implemented Work Unit 3 only:

- `StockMovementLedgerTable`
- `StockMovementLedgerFilters`
- `StockMovementLedgerPage`
- `/inventory/movements` nested route
- Inventory index action link to the movement ledger
- Component tests for table, filters, and page behavior

CSV export behavior, public API exports, and `StockAdjustDialog` baseline tests remain deferred to PR 4.

## TDD Evidence

| Phase | Tasks | Evidence |
| --- | --- | --- |
| RED | T3.1 table tests before component | Component did not exist, tests failed in child apply session |
| GREEN | T3.2 table implementation | Table tests passed in child apply session |
| RED | T3.3 filter tests before component | Component did not exist, tests failed in child apply session |
| GREEN | T3.4 filter implementation | Filter tests passed in child apply session |
| RED | T3.5 page tests before component | Page did not exist, tests failed in child apply session |
| GREEN | T3.6 page implementation + route | Page tests passed in child apply session |
| TRIANGULATE | Inventory component/hook tests | `npx vitest run src/features/inventory/` → 9 files, 48 tests passed |
| REFACTOR | Type/lint cleanup | `npx tsc --noEmit` clean; `npm run lint` exits 0 with 6 pre-existing warnings |

## Validation Commands

```text
npm test -- src/features/inventory/components/StockMovementLedgerPage.test.tsx src/features/inventory/components/StockMovementLedgerTable.test.tsx src/features/inventory/components/StockMovementLedgerFilters.test.tsx src/features/inventory/api/stockMovements.test.ts src/features/inventory/hooks/useStockMovements.test.ts
# 5 files, 30 tests passed

npx vitest run src/features/inventory/
# 9 files, 48 tests passed

npx tsc --noEmit
# clean

npm run lint
# 0 errors, 6 warnings in pre-existing React Hook Form watch() call sites
```

## Notes

- Manual browser verification for `/inventory/movements` remains pending.
- The page currently renders an `Exportar CSV` button as a visible affordance, but the click behavior is intentionally deferred to PR 4 per tasks T4.4.
- No PR 4 code paths were implemented in this slice.
