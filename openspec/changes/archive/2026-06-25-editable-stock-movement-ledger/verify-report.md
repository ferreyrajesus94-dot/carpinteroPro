# Verify Report — Editable Stock Movement Ledger via Append-only Reversals

## Status

Passed with caveats.

## Summary

The SDD change `2026-06-25-editable-stock-movement-ledger` has been implemented and verified against the proposal, delta spec, design, and task list.

The implementation adds append-only stock movement reversals with:

- immutable original `stock_movements` rows;
- compensating reversal rows linked to the original movement;
- server-side tenant isolation and role-gated authorization;
- no in-place movement edits;
- dedicated movement detail UI with reversal action and audit copy;
- ledger/CSV reversal traceability;
- cache invalidation and cache privacy coverage.

## Artifacts verified

- `openspec/changes/2026-06-25-editable-stock-movement-ledger/proposal.md`
- `openspec/changes/2026-06-25-editable-stock-movement-ledger/specs/inventory/spec.md`
- `openspec/changes/2026-06-25-editable-stock-movement-ledger/design.md`
- `openspec/changes/2026-06-25-editable-stock-movement-ledger/tasks.md`
- `openspec/changes/2026-06-25-editable-stock-movement-ledger/apply-progress.md`
- `supabase/migrations/20260625183000_stock_movement_reversals.sql`
- `supabase/migrations/20260625184500_stock_movement_ledger_reversal_columns.sql`
- `supabase/tests/stock_movement_reversal.test.sql`
- touched inventory API/hooks/components/lib files
- `src/shared/types/database.ts`

## Requirements verification

| Requirement | Result | Evidence |
| --- | --- | --- |
| Append-only reversal eligibility and idempotency | Pass | SQL tests cover one reversal per original and request idempotency support. |
| Reversal row linkage to original movement | Pass | Migration adds `reversal_of_movement_id`; SQL tests and TypeScript types cover linkage. |
| Stock totals impacted via compensating delta | Pass | SQL tests verify compensating stock update. |
| Original movement preservation | Pass | RPC inserts reversal row and never mutates original; SQL tests verify original fields. |
| Role-gated reversal authorization | Pass | `workshop_user_role` and `profiles.workshop_role`; SQL tests cover admin/operational/viewer behavior. |
| Tenant isolation | Pass | RPCs derive workshop from `auth.uid() -> profiles`; SQL tests cover cross-workshop denial. |
| Dedicated movement detail UI | Pass | `StockMovementDetailPage` plus RTL tests. |
| Ledger/reporting/CSV presentation | Pass | Ledger detail links and CSV reversal traceability columns covered by tests. |

## Test evidence

### RED evidence

Initial focused SQL reversal test failed as expected before implementation:

```bash
supabase test db --local supabase/tests/stock_movement_reversal.test.sql
```

Observed RED summary:

```text
Tests: 24
Failed: 14
Result: FAIL
```

Expected failures were missing reversal columns, missing `reverse_stock_movement`, missing `get_stock_movement_detail`, and absent stock-update behavior.

### GREEN SQL evidence

```bash
supabase migration up --local
supabase test db --local supabase/tests/stock_movement_reversal.test.sql supabase/tests/stock_movement_ledger.test.sql
```

Result:

```text
All tests successful.
Files=2, Tests=35
Result: PASS
```

Existing inventory SQL regressions also passed earlier:

```bash
supabase test db --local supabase/tests/stock_movement_creator.test.sql supabase/tests/stock_movement_ledger.test.sql
```

Result:

```text
All tests successful.
Files=2, Tests=16
Result: PASS
```

### Frontend/unit evidence

```bash
npm test
```

Result:

```text
Test Files  97 passed (97)
Tests  724 passed (724)
```

Focused suites passed for:

- stock movement API;
- stock movement hooks;
- movement detail UI;
- ledger table;
- CSV export;
- cache privacy.

### Diagnostics evidence

Focused LSP diagnostics over touched TypeScript/TSX files reported no diagnostics.

`lens_diagnostics` caveat: the session cache showed stale intermediate TypeScript errors from the RED phase in `stockMovements.test.ts`; active LSP diagnostics and `npm test` confirm the current file is clean. Project-wide full diagnostics also report pre-existing unrelated issues outside this SDD scope (`.playwright-mcp` generated output, Deno edge-function globals/imports, and JSONC comments in tsconfig files).

## Fresh review evidence

A fresh reviewer inspected the critical changed files and reported:

- SQL ↔ TypeScript signatures match.
- Tenant isolation is enforced at every layer.
- Role enforcement is present.
- Append-only behavior is enforced.
- React hook invalidation is complete.
- Feature boundaries are respected.
- No security regressions found.
- **No blockers found.**

## Caveats and risks

- The working tree still includes uncommitted carryover from the prior archived inventory-ledger change. This was intentionally accepted as the baseline for this apply session, but PR preparation should separate or clearly explain carryover vs. reversal work.
- The implementation exceeds the 400-line review budget and should be split into reviewable work units/chained PRs before review.
- Full `lens_diagnostics` includes unrelated pre-existing project diagnostics; they are not introduced by this change.

## Decision

Verification passes for this SDD change. The next SDD phase is `sync`, to merge the verified delta into canonical OpenSpec inventory specs before archive.
