# Sync Report — Editable Stock Movement Ledger via Append-only Reversals

## Status

Completed.

## Summary

The verified SDD delta for `2026-06-25-editable-stock-movement-ledger` has been synced into the canonical inventory spec.

Canonical target updated:

- `openspec/specs/inventory/spec.md`

## Synced changes

### Added canonical requirements

- Append-only Reversal Eligibility and Idempotency
- Reversal Row Linkage to Original Movement
- Stock Totals Impacted via Compensating Delta
- Original Movement Preservation
- Role-gated Reversal Authorization
- Tenant Isolation for Reversal Operations
- Dedicated Movement Detail UI for Reversal Review
- Ledger, Reporting, and CSV Presentation of Reversals

### Modified canonical requirements

- Stock Movements Table
  - Added reversal audit columns and reversal lookup/idempotency index expectations.
- Workshop-wide Stock Movement Ledger
  - Added dedicated movement detail linkage from ledger rows.
- CSV Export for Filtered Ledger Results
  - Added reversal traceability columns.
- Query-Key Cache Privacy
  - Added movement detail query-key family.
- Inventory Public API Exports
  - Added detail/reversal API and hook exports.
- Deferred Scope
  - Replaced the blanket reversal prohibition with append-only reversal support.
  - Kept in-place historical movement editing forbidden.
  - Kept dashboard widgets and settings UI toggles out of scope.

## Verification evidence carried forward

- SQL reversal + ledger tests passed: 35 tests.
- Full frontend/unit test suite passed: 97 files, 724 tests.
- Focused LSP diagnostics for touched TypeScript/TSX files: no diagnostics.
- Fresh reviewer: no blockers found.

## Caveats

- The working tree still contains prior archived inventory-ledger carryover accepted as this apply session's baseline.
- The implementation exceeds the 400-line review budget; chained/reviewable work units are still recommended before PR.

## Next recommended

Archive the change after final status confirms `verify-report.md` and `sync-report.md` are present.
