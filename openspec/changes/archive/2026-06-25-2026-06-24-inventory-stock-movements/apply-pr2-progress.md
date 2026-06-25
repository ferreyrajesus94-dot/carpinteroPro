# Apply Progress — PR2 (Work Unit 2)

## Status: Success

### TDD Cycle Evidence

| Task | Phase | What was done | Result |
|------|-------|--------------|--------|
| T2.1 | 🔴 RED | Wrote `src/features/inventory/api/stockMovements.test.ts` with 4 tests for `fetchStockMovementLedger` (call shape, filter passthrough, error throw, success return) | 4 failures: "fetchStockMovementLedger is not a function" ✅ |
| T2.2 | 🟢 GREEN | Added `StockMovementLedgerFilters`, `StockMovementLedgerRow`, and `fetchStockMovementLedger` to `src/features/inventory/api/stockMovements.ts` | All 10 API tests pass ✅ |
| T2.3 | 🔷 TRIANGULATE | Added 3 tests for existing `applyStockMovement` and `fetchStockMovements` (call shape, error throw, return value) to the same test file | All 10 API tests pass ✅ |
| T2.4 | 🔴 RED | Wrote `src/features/inventory/hooks/useStockMovements.test.ts` with 5 tests for `useStockMovementLedger` (default filters, filter passthrough, enabled:false, query key, error) and 1 invalidation test | 6 failures: "useStockMovementLedger is not a function" ✅ |
| T2.5 | 🟢 GREEN | Added `useStockMovementLedger` hook with `['stock_movements', 'ledger', filters]` query key and `enabled` option. Updated `useApplyStockMovement.onSuccess` to also invalidate `['stock_movements', 'ledger']` | All 6 hook tests pass ✅ |
| T2.6 | 🔷 TRIANGULATE | Ran all existing inventory tests to verify no regressions | 34/34 tests pass (6 files) ✅ |
| T2.7 | ♻️ REFACTOR | Added cache privacy assertion for `['stock_movements', 'ledger', {}]` | 3/3 cache privacy tests pass ✅ |

### Files changed

- `src/features/inventory/api/stockMovements.ts` — Added `StockMovementLedgerFilters`, `StockMovementLedgerRow`, `fetchStockMovementLedger`
- `src/features/inventory/api/stockMovements.test.ts` — New file: 10 tests covering ledger RPC, apply, and fetch
- `src/features/inventory/hooks/useStockMovements.ts` — Added `useStockMovementLedger`, updated `useApplyStockMovement` invalidation
- `src/features/inventory/hooks/useStockMovements.test.ts` — New file: 6 tests covering hook behavior and invalidation
- `src/shared/lib/cachePrivacy.test.ts` — Added ledger query key assertion

### Test results

- `npx vitest run src/features/inventory/` — **34/34 pass**
- `npx vitest run` — **675/675 pass** (91 files)
- `npx tsc --noEmit` — **clean** (no errors)

### Deviations from design

- **Mock strategy**: Used module-level mutable state (`rpcCallHistory`, `rpcReturnValue`, `fromResult`) with `vi.mock` factory closures instead of `vi.mocked()` for the supabase mock. This avoids TypeScript issues with `Mock<Procedure | Constructable>` not being callable in factory closures.
- **Invalidation test**: Used `vi.spyOn(queryClient, 'invalidateQueries')` instead of checking `result.current.data` to avoid TanStack Query v5 render-timing issues with `mutateAsync`.
- **`fromMock` removed**: The module-level `fromMock` was replaced with a `fromResult` variable since `vi.mocked(supabase.from)` could not be used due to type constraints in mock factory.

### Remaining tasks

All PR2 tasks (T2.1–T2.7) are complete. Ready for PR3 (UI ledger/filters) and PR4 (CSV export/public API exports).

### Risks

- `useStockMovementLedger` stores filters as part of the query key (`['stock_movements', 'ledger', filters]`). Deep-equal comparison by TanStack Query means object identity changes will trigger refetches. This matches the pattern used elsewhere in the codebase.
- The `enabled: false` test proved the hook doesn't fire prematurely.
