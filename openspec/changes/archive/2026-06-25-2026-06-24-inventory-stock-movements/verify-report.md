# Verify Report — Inventory Stock Movements Reporting and Audit Hygiene

## Status

PASS — implementation verified.

## Summary

The SDD change `2026-06-24-inventory-stock-movements` is implemented across the planned four review slices:

1. Backend SQL/RPC/types/SQL tests.
2. Inventory API + TanStack Query hooks + unit tests.
3. Ledger page, filters, table, route, and component tests.
4. CSV export, public API exports, and `StockAdjustDialog` baseline tests.

All implementation tasks in `tasks.md` are complete. Manual browser verification was completed after the first verify pass identified unchecked manual tasks.

## Validation Evidence

| Command / check | Result |
| --- | --- |
| `npm test` | PASS — 96 files, 703 tests |
| `npx tsc --noEmit` | PASS — clean |
| `npm run lint` | PASS — 0 errors, 6 pre-existing warnings in unrelated React Hook Form `watch()` call sites |
| `npx supabase test db` | PASS — 5 files, 68 tests |
| Focused API/page/CSV tests after inclusive date fix | PASS — 3 files, 26 tests |
| Fresh fast review | PASS — no blockers |

## Manual Browser Verification

Performed with Playwright against the local Vite dev server.

Steps verified:

1. Navigated to `/inventory/movements` while unauthenticated and confirmed auth redirect.
2. Registered/signed in as a local manual verification user.
3. Skipped onboarding.
4. Navigated to `/inventory/movements`; page rendered with the empty state.
5. Created material `MDF Manual Verify`.
6. Applied a `+3` stock movement through the existing stock adjustment dialog.
7. Navigated to `/inventory/movements`; ledger displayed the row with material, `+3` delta, `Compra` reason, and creator email.
8. Filtered material search with `ZZZ`; ledger showed `Sin movimientos`.
9. Filtered material search with `MDF`; ledger showed the row again.

## Fixes Applied During Verification

- Date-only end filters now normalize to the next-day exclusive timestamp before calling `get_stock_movement_ledger`, so a UI `Hasta` date includes movements on that selected day.
- Added an API test for date-only `to` normalization.
- Replaced stale RED-phase comment in `supabase/tests/stock_movement_creator.test.sql` with a current regression-test comment.

## Strict TDD Evidence

RED/GREEN/TRIANGULATE/REFACTOR evidence is recorded in:

- `apply-pr1-progress.md`
- `apply-pr2-progress.md`
- `apply-pr3-progress.md`
- `apply-pr4-progress.md`

The implementation followed the planned chained slices and did not add deferred scope such as reversals, dashboard widgets, or settings-toggle wiring.

## Remaining Risks / Notes

- Lint warnings remain pre-existing and unrelated to the changed files.
- Historical stock movements with `created_by = null` intentionally render as `Sin registrar` in UI/CSV.
- `get_stock_movement_ledger` clamps export/page fetches to 500 rows; users may need narrower filters for large ledgers.

## Next Recommended Phase

Proceed to SDD sync: merge the verified stock-movement reporting/audit requirements into canonical OpenSpec specs, then archive the change.
