# Tasks — Editable Stock Movement Ledger via Append-only Reversals

## Review workload forecast

- Forecast: **large / chained recommended**.
- Expected touched areas: Supabase migration + SQL tests, manual database types, inventory API/hooks, detail UI, ledger table/CSV semantics, cache privacy tests.
- Expected changed lines: likely **> 400** because this spans database, frontend, tests, and OpenSpec follow-up.
- Delivery recommendation: split implementation into reviewable work units before PR:
  1. database/RLS/RPC reversal contract,
  2. TypeScript API/hooks contract,
  3. dedicated movement detail UI,
  4. reporting/CSV/cache polish and verification.

## Pre-apply hygiene

- [x] Inspect `git status --short` and identify carryover from the prior inventory-ledger change.
- [x] Confirm whether prior dirty files should be committed/stashed separately before editing this change.
- [x] Record the chosen carryover strategy in `apply-progress.md` before implementation.
- [x] Re-read `openspec/config.yaml` and apply strict TDD: `npm test`, RED → GREEN → TRIANGULATE → REFACTOR.

## 1. Database and RLS contract — RED

- [x] Add failing SQL tests for reversal creation through the intended RPC.
- [x] Add failing SQL tests proving original `stock_movements` rows remain immutable during reversal.
- [x] Add failing SQL tests for `reversal_of_movement_id` linkage and one-reversal-per-original idempotency.
- [x] Add failing SQL tests for tenant isolation: users from another workshop cannot reverse or read unauthorized reversal details.
- [x] Add failing SQL tests for role-gated authorization: unauthorized workshop users cannot reverse movements.
- [x] Add failing SQL tests for negative-stock edge cases and the selected blocking/error semantics.
- [x] Add failing SQL tests proving reversal rows update material stock through a compensating delta in the same transaction.

## 2. Database and RLS implementation — GREEN

- [x] Add a new Supabase migration for reversal support; do not edit historical migrations unless explicitly required by project policy.
- [x] Add reversal linkage columns/constraints/indexes on `stock_movements` as designed.
- [x] Add or integrate the workshop role model needed for server-side reversal authorization.
- [x] Implement `reverse_stock_movement` RPC with tenant checks, role checks, row locking, idempotency/no-double-reversal, and stock update in one transaction.
- [x] Ensure original movement rows are never updated by the reversal RPC.
- [x] Extend ledger/detail RPC output to expose reversal linkage/status fields needed by the UI and CSV.
- [x] Run focused SQL tests and record RED/GREEN evidence in `apply-progress.md`.

## 3. Manual Supabase types

- [x] Update `src/shared/types/database.ts` for new columns, enum values, RPC args/returns, and relationships.
- [x] Preserve project conventions: no `any`, no unused types/imports, and include `Relationships: []` where manually maintained types require it.
- [x] Run TypeScript/LSP diagnostics for touched TypeScript files before moving to UI implementation.

## 4. API and hooks — RED/GREEN

- [x] Add failing tests for fetching a single stock movement detail with reversal linkage/status fields.
- [x] Add failing tests for calling the reversal RPC and surfacing authorization/idempotency errors.
- [x] Add failing tests for TanStack Query invalidation after reversal: ledger list, movement detail, and affected material stock queries.
- [x] Implement inventory API functions in `src/features/inventory/api/` for detail fetch and reversal command.
- [x] Implement inventory hooks in `src/features/inventory/hooks/` for detail and mutation flows.
- [x] Keep feature boundaries intact: inventory feature may import its own files and `src/shared/**`; no cross-feature imports.
- [x] Run focused Vitest tests and record RED/GREEN evidence in `apply-progress.md`.

## 5. Dedicated movement detail UI — RED/GREEN

- [x] Add failing RTL tests for dedicated movement detail view/panel loading, error, and success states.
- [x] Add failing RTL tests showing original movement details, reversal linkage/history, and clear immutable/audit copy.
- [x] Add failing RTL tests for role-gated reversal action visibility/disabled states.
- [x] Add failing RTL tests for reversal confirmation requiring a non-empty reason.
- [x] Implement `StockMovementDetailPage` or equivalent dedicated detail surface under `src/features/inventory/components/`.
- [x] Add route wiring for movement detail, e.g. `/inventory/movements/:movementId`, inside inventory routing boundaries.
- [x] Link ledger rows to the dedicated detail surface without replacing the existing ledger table flow.
- [x] Run focused UI tests and record RED/GREEN evidence in `apply-progress.md`.

## 6. Ledger, reporting, CSV, and cache privacy

- [x] Add failing tests showing ledger rows distinguish originals from reversal rows and expose linked movement context.
- [x] Add failing CSV tests for reversal columns/labels and linked original movement id.
- [x] Implement ledger table/reporting presentation for reversal rows without hiding audit entries.
- [x] Implement CSV export semantics so both original and reversal rows remain visible and traceable.
- [x] Extend cache privacy tests for any new non-persistable movement detail/reversal query keys.
- [x] Run focused tests for ledger, CSV, and cache privacy and record evidence.

## 7. Triangulate and refactor

- [x] Add at least one additional scenario after the first GREEN path: already-reversed movement, unauthorized role, or negative-stock case.
- [x] Refactor duplicated API/hook/UI logic while keeping tests green.
- [x] Check accessibility basics for the reversal confirmation UI: labels, focus path, button names, and error text.
- [x] Run `npm test` and record complete output or failure summary in `apply-progress.md`.

## 8. Verification checklist

- [x] Verify SQL/RLS tests cover cross-tenant isolation and role-gated authorization.
- [x] Verify original stock movement rows remain immutable after reversal.
- [x] Verify material stock changes by the compensating delta exactly once.
- [x] Verify ledger and CSV show both original and reversal rows with linkage.
- [x] Verify dedicated detail UI supports review, confirmation, success, and error states.
- [x] Verify no direct DOM manipulation, no `any`, no unused imports, and no feature-boundary violations.
- [x] Run `lens_diagnostics mode=all` or equivalent diagnostics before declaring apply complete.

## Implementation dependencies

1. Pre-apply hygiene must complete before code edits.
2. Database/RLS contract and migration must land before frontend detail/reversal implementation can be finalized.
3. Manual `database.ts` types must be updated before API/hooks compile cleanly.
4. API/hooks must land before detail UI and ledger action flows.
5. Full verification must wait for all tasks and `apply-progress.md` evidence.
