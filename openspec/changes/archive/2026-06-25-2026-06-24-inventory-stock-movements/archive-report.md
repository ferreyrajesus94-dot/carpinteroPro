# Archive Report — Inventory Stock Movements Reporting and Audit Hygiene

## Status

**PASS** — archived.

## Summary

The SDD change `2026-06-24-inventory-stock-movements` has completed all phases and is now archived.

## Artifacts Read

| Phase | Path |
|-------|------|
| proposal | `openspec/changes/2026-06-24-inventory-stock-movements/proposal.md` |
| exploration | `openspec/changes/2026-06-24-inventory-stock-movements/exploration.md` |
| spec | `openspec/changes/2026-06-24-inventory-stock-movements/spec.md` |
| design | `openspec/changes/2026-06-24-inventory-stock-movements/design.md` |
| tasks | `openspec/changes/2026-06-24-inventory-stock-movements/tasks.md` |
| apply-pr1-progress | `openspec/changes/2026-06-24-inventory-stock-movements/apply-pr1-progress.md` |
| apply-pr2-progress | `openspec/changes/2026-06-24-inventory-stock-movements/apply-pr2-progress.md` |
| apply-pr3-progress | `openspec/changes/2026-06-24-inventory-stock-movements/apply-pr3-progress.md` |
| apply-pr4-progress | `openspec/changes/2026-06-24-inventory-stock-movements/apply-pr4-progress.md` |
| verify-report | `openspec/changes/2026-06-24-inventory-stock-movements/verify-report.md` |
| sync-report | `openspec/changes/2026-06-24-inventory-stock-movements/sync-report.md` |
| canonical spec | `openspec/specs/inventory/spec.md` (newly created) |

## Scope Delivered

**In scope (A+B):**

- Workshop-wide stock-movement ledger at `/inventory/movements` with filterable table
- Server-side bounded retrieval via `get_stock_movement_ledger` RPC (limit clamped to [1,500]; offset ≥ 0)
- CSV export from filtered ledger results with BOM, escaping, and 500-row cap
- `created_by = auth.uid()` attribution in `apply_stock_movement` RPC
- Unit-test baseline for API, hooks, ledger components, and `StockAdjustDialog`
- Public API exports in `src/features/inventory/index.ts`
- Cache privacy assertions for ledger query keys

**Out of scope / deferred:**

- Reversal / compensating-entry workflows
- Dashboard recent-movements widget
- Wiring of `auto_stock_discount` and `stock_alert_enabled` settings toggles
- Reason taxonomy changes beyond existing enum

## Domains Synced

| Domain | Canonical Path | Action |
|--------|---------------|--------|
| inventory | `openspec/specs/inventory/spec.md` | Created (new domain spec) |

## Requirements Summary

All requirements from the spec were **ADDED** to the new canonical `inventory` domain spec:

- Materials Table
- Per-material Price History
- Stock Movements Table
- Apply Stock Movement RPC
- Per-material Stock History Dialog
- Workshop-wide Stock Movement Ledger
- Server-side Filtering and Bounded Retrieval
- CSV Export for Filtered Ledger Results
- Query-Key Cache Privacy
- Inventory Public API Exports
- Deferred Scope (explicitly documented)

No MODIFIED or REMOVED requirements. No destructive merge operations.

## Active Same-Domain Warnings

None. No other active change touches the `inventory` domain.

## Implementation Task Completion

All 29 implementation tasks and subtasks across 4 work units are checked complete.

Zero unchecked `[ ]` implementation task markers remain.

No stale-checkbox reconciliation was required.

## Verification Gate

Verify report status: **PASS** — all automated validations green, manual browser verification complete.

- `npm test`: 96 files, 703 tests passed
- `npx tsc --noEmit`: clean
- `npm run lint`: 0 errors (6 pre-existing warnings)
- `npx supabase test db`: 5 files, 68 tests PASS
- Manual Playwright verification: leder renders, filters narrow, CSV export wired

## CRITICAL Verification Issues

None.

## Destructive Merge Approvals

Not applicable — no destructive operations were performed.

## Archived Path

```
openspec/changes/archive/2026-06-25-2026-06-24-inventory-stock-movements/
```

## Memory Observation IDs

| Topic Key | ID |
|-----------|-----|
| sdd/2026-06-24-inventory-stock-movements/explore | 736 |
| sdd/2026-06-24-inventory-stock-movements/proposal | 738 |
| sdd/2026-06-24-inventory-stock-movements/spec | 739 |
| sdd/2026-06-24-inventory-stock-movements/design | 740 |
| sdd/2026-06-24-inventory-stock-movements/tasks | 741 |
| sdd/2026-06-24-inventory-stock-movements/apply-pr2 | 744 |
| sdd/2026-06-24-inventory-stock-movements/apply-pr4 | 745 |
| sdd/2026-06-24-inventory-stock-movements/verify-fixes | 747 |
| sdd/2026-06-24-inventory-stock-movements/sync | 748 |

## Risks and Notes

- Historical `created_by = null` rows render as `Sin registrar` in UI and CSV.
- CSV export capped at 500 rows; users with large workshops need narrower filters.
- Lint warnings are pre-existing (React Hook Form `watch()` incompatibility in unrelated files).
- `get_stock_movement_ledger` returns within the existing RLS model and is tenant-safe.
