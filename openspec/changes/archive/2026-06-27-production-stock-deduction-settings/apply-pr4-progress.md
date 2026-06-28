# Apply PR 4 Progress: Production-start UI

## Status

PR 4 implementation completed and verified.

## Scope applied

- Added a shared `ProductionStartReviewDialog` for the approved-quote production-start review flow.
- The dialog shows production deduction preview rows, automatic/manual mode copy, shortage warnings, incomplete-BOM warnings, existing-batch state, success result, and a link to inventory movements.
- Confirmation calls `useStartQuoteProduction` with an explicit client-side `requestId`.
- Wired `QuoteList` pipeline/mobile status transition path so `aprobado -> en_produccion` opens the dialog instead of calling `useUpdateQuoteStatus` directly.
- Wired `QuoteForm` edit submit path so an existing approved quote submitted as `en_produccion` first saves the form content (keeping status `aprobado`) via `useUpdateQuote`, then opens the production-start dialog. Cancel does not revert the saved edits, but the quote remains `aprobado` so the user can retry.
- Added focused dialog component coverage for automatic mode, manual mode, warnings, cancel safety, request id confirmation, success state, and existing batch state.
- PR 5 ledger/export/reporting scope was not implemented.

## Files changed

### New files

- `src/features/quotes/components/ProductionStartReviewDialog.tsx`
- `src/features/quotes/components/ProductionStartReviewDialog.test.tsx`

### Modified files

- `src/features/quotes/components/QuoteList.tsx`
- `src/features/quotes/components/QuoteForm.tsx`

## TDD evidence

### RED

Added focused failing intent for the shared dialog:

- Preview rows render material quantity/current stock/projected stock.
- Manual mode primary action starts production without stock deduction.
- Shortage warning is visible.
- Incomplete BOM warning is visible.
- Cancel does not call the start mutation.
- Confirm calls the start mutation with `quoteId`, `confirmDeduction`, and a client-side `requestId`.
- Existing batch state is visible and suppresses the confirm action.

### GREEN

Implemented:

- `ProductionStartReviewDialog` using existing PR 3 hooks: `useProductionDeductionPreview` and `useStartQuoteProduction`.
- Explicit request-id generation in the dialog confirmation path.
- QuoteList intercept for `aprobado -> en_produccion`.
- QuoteForm submit intercept for editing an approved quote into production.
- Inventory movement link in the success state.

### TRIANGULATE

Added cases for:

- automatic mode (`confirmDeduction: true`),
- manual mode (`confirmDeduction: false`),
- shortage warnings,
- incomplete BOM warnings,
- existing batch visibility/no duplicate confirmation.

### REFACTOR

- Kept modal logic in one shared component instead of duplicating it across list/form entry points.
- Kept UI copy in Spanish.
- Used named exports and explicit interfaces; no `any` types added.
- Kept frontend wrappers thin and used existing PR 3 hooks.

## Verification

Commands run:

```bash
npx vitest run src/features/quotes/components/ProductionStartReviewDialog.test.tsx
# Test Files 1 passed (1), Tests 10 passed (10)

npx vitest run src/features/quotes/components/ProductionStartReviewDialog.test.tsx src/features/quotes/components/QuoteForm.test.tsx
# Test Files 2 passed (2), Tests 16 passed (16)

npx vitest run src/features/quotes/
# Test Files 9 passed (9), Tests 69 passed (69)

npm test
# Test Files 104 passed (104), Tests 778 passed (778)

npm run lint
# 0 errors, 6 pre-existing React Compiler warnings for React Hook Form watch() usage

npx tsc -b
# passed with no output
```

Diagnostics:

- Checked touched PR 4 TS/TSX files with `lsp_diagnostics`.
- No blocking TypeScript errors found.
- Remaining diagnostics were Spanish-copy typo hints and pre-existing React Hook Form compiler warnings.

## Known non-blockers

- The UI defaults to automatic-mode copy while workshop settings are unavailable; the server-side RPC still reads the setting at execution time and enforces the actual behavior.
- Existing SQL/RLS verification for PR 3 RPCs remains outside Vitest and requires Supabase-local or pgTAP.
- `supabase/.temp/cli-latest` was already dirty before this work and was not touched.
- A mistaken `npx vitest ... --runInBand` command was attempted; Vitest 4 does not support that option. The focused command was rerun without the unsupported flag and passed.

## Residual risks

- QuoteForm cancel after the production-start dialog leaves the server quote saved with `status = aprobado` and the edited fields, but the local status selection remains `en_produccion`. The user can retry starting production or navigate away without data loss.
- Production-start result visibility is modal-scoped; deeper production badges/ledger/export/reporting remain PR 5 scope.

## Next recommended

Run a fresh review of the PR 4 diff, then proceed to PR 5 only if the reviewer confirms no PR 4 blockers.
