# Apply PR 2 Progress: Approved BOM Schema and Capture

## Status

PR 2 implementation completed and verified.

## Scope applied

- Created `quote_approved_bom_lines` migration with RLS policies, constraints, and the `capture_quote_approved_bom` RPC.
- Updated `src/shared/types/database.ts` with the new table entry and function definition, both with `Relationships: []`.
- Created `src/features/quotes/types.ts` `ApprovedBomLine` type export.
- Created `src/features/quotes/api/approvedBom.ts` with `captureApprovedBom()` and `fetchApprovedBomLines()`.
- Created `src/features/quotes/hooks/useApprovedBom.ts` with `useApprovedBomLines()` and `useCaptureApprovedBom()`.
- Wired capture into both approval flows:
  - `useUpdateQuote`: calls `captureApprovedBom` after `updateQuote` when status is `'aprobado'`.
  - `useUpdateQuoteStatus`: calls `captureApprovedBom` after `updateQuoteStatus` when status is `'aprobado'`.
- Created focused API and hook tests for the new modules.
- Extended existing `useQuotes.test.ts` to verify capture is called on approval and NOT called for non-approval transitions.
- Remaining PR 1 changes are untouched and preserved.

## Files changed

### New files

- `supabase/migrations/20260627000001_quote_approved_bom_lines.sql` (migration + RPC)
- `src/features/quotes/api/approvedBom.ts` (API functions)
- `src/features/quotes/api/approvedBom.test.ts` (API tests)
- `src/features/quotes/hooks/useApprovedBom.ts` (React hooks)
- `src/features/quotes/hooks/useApprovedBom.test.ts` (hook tests)

### Modified files

- `src/shared/types/database.ts` (added `quote_approved_bom_lines` table + `capture_quote_approved_bom` function)
- `src/features/quotes/types.ts` (added `ApprovedBomLine` export)
- `src/features/quotes/hooks/useQuotes.ts` (added BOM capture to approval transitions)
- `src/features/quotes/hooks/useQuotes.test.ts` (added capture assertions + mock)

## TDD evidence

### RED

Tests written verifying:

- `captureApprovedBom()` calls the RPC with the correct parameter.
- `captureApprovedBom()` throws when the RPC fails.
- `fetchApprovedBomLines()` queries the correct table with ordering.
- `fetchApprovedBomLines()` throws on query error.
- `useApprovedBomLines()` returns data from the API.
- `useCaptureApprovedBom()` calls the API and shows error toast on failure.
- `useUpdateQuoteStatus` with `'aprobado'` calls `captureApprovedBom`.
- `useUpdateQuoteStatus` with non-approval status does NOT call `captureApprovedBom`.
- `useUpdateQuote` with `status: 'aprobado'` calls `captureApprovedBom` after `updateQuote`.
- Snapshot preservation: status-only path does not call `updateQuote`.

### GREEN

- Migration with RLS policies, indexes, and the capture RPC.
- API functions wired to Supabase RPC and table query.
- React hooks with cache invalidation and error handling.
- Wired capture into `useUpdateQuote` and `useUpdateQuoteStatus` mutationFn.

### TRIANGULATE

- Non-approval status transitions explicitly do not call capture.
- Status-only approval path calls capture but not updateQuote (preserves snapshots).
- Null quoteId: hook does not fetch.

### REFACTOR

- Const objects not needed for PR 2; calculation_method is a string value (used as const in RPC).
- Named exports only for all new components/functions.
- No `any` types used; all types derived from Database types.
- No cross-feature imports.

## Verification

Commands run:

```bash
npx vitest run src/features/quotes/ src/features/settings/
# Test Files 7 passed (7), Tests 44 passed (44)

npm test
# Test Files 101 passed (101), Tests 750 passed (750)

npm run lint
# 0 errors, 6 pre-existing React Compiler warnings for React Hook Form watch() usage

npx tsc -b
# passed with no output
```

## Known non-blockers

- `supabase/.temp/cli-latest` was already dirty before this work.
- The RPC `capture_quote_approved_bom` enforces that the quote is already `aprobado` before capture. This was added during parent recovery review to keep the database contract aligned with the spec, not only the frontend hook behavior.
- The RPC `capture_quote_approved_bom` uses a simplified board-count estimation helper (`_compute_plate_boards_needed`) that approximates nesting. The exact board count requires the JavaScript `computeNesting` algorithm which cannot run server-side. For plate materials with cut_pieces, the RPC attempts to compute boards from total piece area divided by board area, with ceiling rounding. If this is insufficient, a frontend-side recalculation can be added in a later PR.
- The RPC does not include a production-deduction-batch guard (that's PR 3 scope). It only checks cross-workshop access and quote existence.
- Tests for the RPC and RLS cannot be run in the JS test environment; they require a Supabase-local deployment or pgTAP test runner.

## Residual risks

- The migration is time-stamped after existing migrations. If other migrations are added concurrently, the timestamp may need adjustment.
- The `capture_quote_approved_bom` RPC is SECURITY INVOKER, relying on the caller's permission to access quotes, quote_recipe_snapshots, recipe_items, cut_pieces, and materials tables through RLS. If any of these have insufficient RLS for the invoking user, the capture will fail or produce incomplete results.
- The capture is called from the mutationFn of the hooks, which means it runs sequentially after the status update. If the capture fails _after_ the status update succeeds, the quote will be in `aprobado` state but the BOM will not have been captured. A future improvement could wrap both operations in a transaction.

## Next recommended

Proceed to PR 3 (production deduction batch/RPCs) after review confirms the BOM schema is correct and capture is properly wired.
