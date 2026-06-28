# Archive Report — production-stock-deduction-settings

## Status

**PASS** — Archived successfully.

## Executive Summary

The change moves automatic stock deduction from quote approval to the controlled `aprobado → en_produccion` production-start flow. All five chained PR slices were implemented, verified, and synced. The canonical spec at `openspec/specs/inventory/spec.md` was updated with the new production-start stock deduction domain and three modified requirement blocks.

## Artifacts Read

| Artifact | Path | Status |
|----------|------|--------|
| Proposal | `openspec/changes/production-stock-deduction-settings/proposal.md` | Done |
| Spec (delta) | `openspec/changes/production-stock-deduction-settings/specs/inventory/spec.md` | Done |
| Design | `openspec/changes/production-stock-deduction-settings/design.md` | Done |
| Tasks | `openspec/changes/production-stock-deduction-settings/tasks.md` | Done (174 stale checkboxes reconciled via verify-report) |
| Apply progress (canonical) | `openspec/changes/production-stock-deduction-settings/apply-progress.md` | Done |
| Apply progress (PR 1–5) | `openspec/changes/production-stock-deduction-settings/apply-pr1-progress.md` … `apply-pr5-progress.md` | All completed and verified |
| Verify report | `openspec/changes/production-stock-deduction-settings/verify-report.md` | PASS, Blockers: None |
| Sync report | `openspec/changes/production-stock-deduction-settings/sync-report.md` | synced |

## Domains Synced

| Domain | Operation | Canonical File |
|--------|-----------|----------------|
| Stock Movements | MODIFIED — added `production_deduction_id` column, `consumo_produccion` enum, production index | `openspec/specs/inventory/spec.md` |
| Apply Stock Movement RPC | MODIFIED — replaced outdated approval-auto-discount scenario with non-deduction scenario | `openspec/specs/inventory/spec.md` |
| Deferred Scope | MODIFIED — updated to reflect production-start semantics for `auto_stock_discount` | `openspec/specs/inventory/spec.md` |
| Production-Start Stock Deduction | ADDED — 9 requirements (setting semantics, trigger, manual preview, approved BOM, incomplete warning, shortage/negative stock, idempotency, auditable context, ledger/export/reporting, batch reversal) | `openspec/specs/inventory/spec.md` |

## ADDED/MODIFIED/REMOVED Requirement Names

### ADDED Requirements (new domain)

- Setting Semantics — Automatic Production-Start Deduction
- Production-Start Trigger
- Manual-Mode Preview
- Approved BOM/Snapshot Source of Truth
- Incomplete Snapshot Warning
- Insufficient Stock Warning and Controlled Negative Stock
- Idempotent Production Deduction
- Auditable Production-Context Movements
- Ledger, Detail, Export, and Report Visibility
- Batch Reversal Guidance

### MODIFIED Requirements

- Apply Stock Movement RPC — scenario replaced (approval auto-discount → approval does not invoke RPC)
- Stock Movements Table — added `consumo_produccion` enum, `production_deduction_id` column
- Deferred Scope — updated for production-start semantics

### REMOVED Requirements

- Approval-Time Quote Auto-Discount (not in canonical spec; replaced scenario in RPC section)

## Same-Domain Active Change Warnings

No active same-domain collisions. Only one active change in workspace.

## Verification Basis

- `verify-report.md` Status: **PASS**, Blockers: None
- `sync-report.md` Status: **synced**, Blockers: None
- `npm test`: 104 files / 790 tests passed
- `npm run lint`: 0 errors
- `npx tsc -b`: passed
- `supabase db reset --local`: all migrations applied
- `supabase db test --local`: 74 pgTAP tests passed

## Stale-Checkbox Reconciliation

`tasks.md` has 174 unchecked implementation task boxes. Per the SDD status contract's documented exception, these are reconciled by the verify report which provides:

1. Per-PR progress evidence (all 5 PR progress files claim completion)
2. Full verification command output (Vitest, lint, tsc, Supabase migrations, pgTAP)
3. Targeted code inspection confirmation

## Archived Path

`openspec/changes/archive/2026-06-27-production-stock-deduction-settings/`

## Residual Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Stale task checkboxes | HIGH | Verify report provides required reconciliation evidence |
| No dedicated pgTAP tests for new RPCs | MEDIUM | RPC contracts covered by Vitest API mocks |
| Plate nesting approximation | MEDIUM | Documented limitation; revisit if accuracy critical |
| Git tree dirty on main, no per-PR branches | MEDIUM | Documented in verify/sync/archive reports |
| `lens_diagnostics` not run | LOW | Lint, tsc, Vitest, supabase tests all passed |
| Manual smoke checks not executed | LOW | Covered by 790 automated + 74 pgTAP tests |

## Engram Persistence

Artifact store mode: `openspec`. Archive report written to filesystem only.
