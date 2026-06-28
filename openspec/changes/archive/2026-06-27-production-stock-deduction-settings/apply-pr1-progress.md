# Apply PR 1 Progress: Stop approval deduction and safe quote status foundations

## Status

PR 1 implementation completed and verified.

## Scope applied

- Removed the approval-time automatic stock deduction call from quote update flow.
- Added a status-only quote update API/hook so pure status changes do not replace extras or quote snapshots.
- Updated quote list status changes to use the status-only path.
- Updated Settings copy so `auto_stock_discount` now means stock deduction when production starts.
- Preserved legacy `stockDiscount.ts` as a deprecated scaffold/reference for later BOM/production deduction PRs; it is no longer imported by production code.
- Restored existing WorkshopSettings composition tests while adding the new copy test.

## Files changed

- `src/features/quotes/api/quotes.ts`
- `src/features/quotes/api/stockDiscount.ts`
- `src/features/quotes/components/QuoteList.tsx`
- `src/features/quotes/hooks/useQuotes.ts`
- `src/features/quotes/hooks/useQuotes.test.ts`
- `src/features/quotes/index.ts`
- `src/features/settings/components/WorkshopSettings.tsx`
- `src/features/settings/components/WorkshopSettings.test.tsx`

## TDD evidence

### RED

Added failing intent before/alongside implementation for:

- `useUpdateQuoteStatus` status-only changes, including `aprobado`.
- Snapshot-preservation contract: status-only hook calls `updateQuoteStatus`, not full `updateQuote` with empty snapshots.
- Settings copy uses production-start wording.

### GREEN

Implemented:

- `updateQuoteStatus(id, status)` in quotes API.
- `useUpdateQuoteStatus(workshopId)` hook.
- QuoteList status transitions use `useUpdateQuoteStatus`.
- Removed `maybeAutoDiscountStock` invocation from `useUpdateQuote`.
- Updated Settings copy from approval to production start.

### TRIANGULATE

Added/kept cases for:

- `aprobado` status-only update.
- `en_produccion` / non-approval status-only update.
- error state for status-only update.
- existing WorkshopSettings composition contracts.

### REFACTOR

- Kept status-only naming explicit to avoid accidental snapshot replacement.
- Fixed strict inequality warnings in the deprecated stock discount scaffold.
- Restored pre-existing WorkshopSettings composition coverage that was accidentally reduced during apply recovery.

## Verification

Commands run:

```bash
npx vitest run src/features/quotes/hooks/useQuotes.test.ts src/features/settings/components/WorkshopSettings.test.tsx
# Test Files 2 passed (2), Tests 19 passed (19)

npm test
# Test Files 99 passed (99), Tests 741 passed (741)

npm run lint
# 0 errors, 6 pre-existing React Compiler warnings for React Hook Form watch() usage

npx tsc -b
# passed with no output
```

LSP/diagnostics:

- Checked changed TS/TSX files with `lsp_diagnostics`.
- No blocking TypeScript errors found.
- Remaining diagnostics are repository-style warnings/hints such as extensionless imports, existing inline styles, Spanish typos, and pre-existing React Hook Form compiler warnings.

## Known non-blockers

- `supabase/.temp/cli-latest` was already dirty before this work and was not touched.
- `stockDiscount.ts` still exists as deprecated legacy scaffold. It is intentionally uncalled in production code and may be removed or rewritten in later PRs when approved BOM/production deduction is implemented.

## Next recommended

Run a fresh review of the PR 1 diff, then proceed to PR 2 only if the reviewer confirms no PR 1 blockers.
