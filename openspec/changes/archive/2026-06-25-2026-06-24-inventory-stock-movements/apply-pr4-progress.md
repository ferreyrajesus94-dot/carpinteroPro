# Apply Progress — PR 4 CSV Export, Public API, StockAdjustDialog Baseline

## Status

Completed.

## Scope

Implemented Work Unit 4 only:

- `src/features/inventory/lib/stockMovementCsv.ts` — CSV builder with BOM, HEADERS, REASON_LABELS, `escape()`, `buildStockMovementCsv()`, `exportStockMovementCsv()`, `EXPORT_LIMIT = 500`.
- `src/features/inventory/lib/stockMovementCsv.test.ts` — 10 tests for builder, export, bounded behavior.
- `src/features/inventory/components/StockMovementLedgerPage.tsx` — wired export button with imperative `fetchStockMovementLedger({ ...filters, limit: 500, offset: 0 })`, toast warning on 500+ rows, toast error on failure.
- `src/features/inventory/components/StockMovementLedgerPage.test.tsx` — added export click test.
- `src/features/inventory/index.ts` — added public API exports for hooks, API functions, and types.

## TDD Evidence

| Phase | Tasks | Evidence |
| --- | --- | --- |
| RED | T4.1 CSV builder tests | Module not found — vitest import failed ✅ |
| GREEN | T4.2 stockMovementCsv.ts | 8/8 builder tests passed |
| RED | T4.3 bounded export tests | Included in same file; 2 more tests |
| GREEN | T4.4 wire export in LedgerPage | Wired `handleExport` with imperative fetch, toast, `exportStockMovementCsv` |
| GREEN | T4.5 index.ts exports | All hooks, API, types exported; tsc clean |
| TRIANGULATE | T4.6 StockAdjustDialog test | 2 tests: negative-stock block + valid in-mutation |
| REFACTOR | T4.7 final cleanup | CSV `escape` pattern reused; no `any`/`var`; full suite 702 pass |

## Validation Commands

```text
# Inventory tests
npx vitest run src/features/inventory/
# 11 files, 61 tests passed

# Full project test suite
npm test
# 96 files, 702 tests passed

# TypeScript
npx tsc --noEmit
# clean

# Lint
npm run lint
# 0 errors, 6 pre-existing React Hook Form warnings
```

## Files Changed

- `src/features/inventory/lib/stockMovementCsv.ts` (new)
- `src/features/inventory/lib/stockMovementCsv.test.ts` (new)
- `src/features/inventory/components/StockMovementLedgerPage.tsx` (modified)
- `src/features/inventory/components/StockMovementLedgerPage.test.tsx` (modified)
- `src/features/inventory/components/StockAdjustDialog.test.tsx` (new)
- `src/features/inventory/index.ts` (modified)

## Notes

- PR 3 previously added a visible `Exportar CSV` button without click behavior as an affordance. PR 4 now wires the click handler.
- All 4 PRs for this SDD change are now complete and verified.
- Manual browser verification for `/inventory/movements` still pending.
