# Apply Progress — production-stock-deduction-settings

This change was implemented as five chained PR slices. Each slice has its own detailed progress file; this document is the canonical index.

| PR | Scope | File | Status |
| --- | --- | --- | --- |
| PR 1 | Stop approval-time deduction and safe quote status foundations | [apply-pr1-progress.md](./apply-pr1-progress.md) | completed and verified |
| PR 2 | Approved BOM schema and capture | [apply-pr2-progress.md](./apply-pr2-progress.md) | completed and verified |
| PR 3 | Production deduction batch/RPCs | [apply-pr3-progress.md](./apply-pr3-progress.md) | completed and verified |
| PR 4 | Production-start UI | [apply-pr4-progress.md](./apply-pr4-progress.md) | completed and verified |
| PR 5 | Ledger/export/reporting and batch reversal guidance | [apply-pr5-progress.md](./apply-pr5-progress.md) | completed and verified |

## Consolidated verification summary

- `npm test` — 104 test files / 790 tests passed
- `npm run lint` — 0 errors, 6 pre-existing React Hook Form compiler warnings
- `npx tsc -b` — passed
- Supabase local migrations applied cleanly
- Existing pgTAP test suite passed (including stock movement and tenant isolation tests)
- New migrations were validated by `supabase db reset --local`

## Notes

- Code was applied directly to the `main` working tree; no feature branch or per-PR git commits were created.
- `tasks.md` checkboxes remain unchecked even though the work is complete; this is reconciled in the [verify-report.md](./verify-report.md).
