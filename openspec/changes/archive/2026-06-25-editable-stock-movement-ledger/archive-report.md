# Archive Report — Editable Stock Movement Ledger via Append-only Reversals

## Status

Archived.

## Summary

The SDD change `2026-06-25-editable-stock-movement-ledger` completed proposal, spec, design, tasks, apply, verify, and sync.

Canonical inventory specs were updated before archive.

## Evidence

- Tasks: 53/53 complete.
- SQL reversal + ledger tests: 35 passed.
- Full frontend/unit suite: 97 files, 724 tests passed.
- Focused LSP diagnostics for touched TS/TSX files: clean.
- Fresh reviewer: no blockers found.
- Sync report: completed.

## Archived artifacts

- `proposal.md`
- `specs/inventory/spec.md`
- `design.md`
- `tasks.md`
- `apply-progress.md`
- `verify-report.md`
- `sync-report.md`
- `archive-report.md`

## Residual caveats

- Dirty carryover from the prior archived inventory-ledger change remains in the working tree and was accepted as this apply session's baseline.
- The implementation exceeds the 400-line review budget; split/chained PR review is recommended before merge.
- Project-wide diagnostics still include unrelated pre-existing noise outside this SDD scope.
