# Apply Progress — Editable Stock Movement Ledger via Append-only Reversals

## Session context

| Field | Value |
|-------|-------|
| SDD change | `2026-06-25-editable-stock-movement-ledger` |
| Branch | `main` |
| HEAD | `8deb9ae chore(gga): switch default provider to opencode` |
| Work unit | 1 (of 6) — pre-apply hygiene + RED SQL/RLS tests |
| TDD mode | strict (RED → GREEN → TRIANGULATE → REFACTOR) |
| TDD test runner (frontend) | `npm test` → vitest |
| TDD test runner (SQL) | `supabase test db <file>` — pgTAP against local/linked Supabase |
| Date | 2026-06-25 |

## Pre-apply hygiene

### Carryover strategy (completed 2026-06-25)

**Status of working tree (`git status --short`):**

```
 M src/features/inventory/api/stockMovements.ts
 M src/features/inventory/hooks/useStockMovements.ts
 M src/features/inventory/index.ts
 M src/features/inventory/routes.tsx
 M src/shared/lib/cachePrivacy.test.ts
 M src/shared/types/database.ts
?? openspec/changes/2026-06-25-editable-stock-movement-ledger/
?? openspec/changes/archive/2026-06-25-2026-06-24-inventory-stock-movements/
?? openspec/specs/inventory/
?? src/features/inventory/api/stockMovements.test.ts
?? src/features/inventory/components/StockAdjustDialog.test.tsx
?? src/features/inventory/components/StockMovementLedgerFilters.test.tsx
?? src/features/inventory/components/StockMovementLedgerFilters.tsx
?? src/features/inventory/components/StockMovementLedgerPage.test.tsx
?? src/features/inventory/components/StockMovementLedgerPage.tsx
?? src/features/inventory/components/StockMovementLedgerTable.test.tsx
?? src/features/inventory/components/StockMovementLedgerTable.tsx
?? src/features/inventory/hooks/useStockMovements.test.ts
?? src/features/inventory/lib/stockMovementCsv.test.ts
?? src/features/inventory/lib/stockMovementCsv.ts
?? supabase/migrations/20260624120000_creator_attribution_and_ledger_rpc.sql
?? supabase/tests/stock_movement_creator.test.sql
?? supabase/tests/stock_movement_ledger.test.sql
```

**Decision:** No stash, no commit, no reset. The dirty tree from the archived `2026-06-25-2026-06-24-inventory-stock-movements` change is treated as the **intentional baseline** for this apply session. New edits for the reversal change will be layered on top. The carryover files that overlap with this change (e.g. `src/features/inventory/api/stockMovements.ts`, `src/shared/types/database.ts`, etc.) are baseline code that the reversal tests and implementation will extend.

**Risks accepted:**

- Files modified by both the old change and this one will carry merged diff content — review must distinguish reversal additions from carryover.
- No `git diff` can cleanly isolate this change's contributions until after a PR is prepared.

### Strict TDD confirmation (completed 2026-06-25)

Re-read `openspec/config.yaml`:

- `testing.strict_tdd: true`
- `testing.command: "npm test"` (frontend: vitest)
- For SQL/RLS: `supabase test db` (pgTAP runner)

**TDD cycle expected for Work Unit 1:**

1. **RED**: Write failing SQL tests (this file). Tests assert expected behavior that cannot succeed until schema/RPC exist. RED is represented by:
   - SQL functions not existing → pgTAP `throws_ok` or `-- throws` comments
   - Columns/indexes not existing → structural assertion failures
   - Test file itself will fail if run because schema is absent
2. **GREEN**: Later work unit adds migration + RPC
3. **TRIANGULATE**: Edge cases added (already-reversed, cross-tenant, unauthorized role)
4. **REFACTOR**: Final cleanup while keeping tests green

---

## Work Unit 1 progress

### Task status

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Inspect `git status --short` | ✅ done | Recorded above |
| 2 | Confirm carryover strategy | ✅ done | No stash/commit; baseline approach |
| 3 | Record carryover strategy in `apply-progress.md` | ✅ done | This document |
| 4 | Re-read `openspec/config.yaml` and apply strict TDD | ✅ done | Strict TDD confirmed |
| 5 | Add failing SQL tests for reversal creation through RPC | ✅ done | `stock_movement_reversal.test.sql` covers all cases |
| 6 | Add failing SQL tests for original row immutability | ✅ done | Included in reversal test file |
| 7 | Add failing SQL tests for one-reversal-per-original idempotency | ✅ done | Included in reversal test file |
| 8 | Add failing SQL tests for tenant isolation | ✅ done | Included in reversal test file |
| 9 | Add failing SQL tests for role-gated authorization | ✅ done | Included in reversal test file |
| 10 | Add failing SQL tests for negative-stock edge cases | ✅ done | Included in reversal test file |
| 11 | Add failing SQL tests for compensating delta stock update | ✅ done | Included in reversal test file |

### Tests added

New file: `supabase/tests/stock_movement_reversal.test.sql`

Contains 20+ pgTAP assertions covering:

1. Reversal row creation through intended RPC
2. Original movement immutability preserved
3. `reversal_of_movement_id` linkage + one-reversal-per-original
4. Tenant isolation (cross-workshop rejection)
5. Role-gated authorization (viewer/unauthorized → 42501)
6. Negative-stock reversal rejection
7. Compensating delta stock update in same transaction

### SQL test runner

`supabase test db supabase/tests/stock_movement_reversal.test.sql`

Attempt to run (expected: RED — will fail because schema/RPC do not exist):

```bash
supabase test db --local supabase/tests/stock_movement_reversal.test.sql
```

**Result:** RED confirmed — command ran against the local database and failed for the expected missing contract.

Observed command:

```bash
supabase test db --local supabase/tests/stock_movement_reversal.test.sql
```

Observed result summary:

```text
Tests: 24
Failed: 14
Result: FAIL
```

Expected RED failures included:

- missing `stock_movements.reversal_of_movement_id`, `reversal_reason`, and `reversal_request_id` columns;
- missing `reverse_stock_movement(uuid, text)` RPC;
- missing `get_stock_movement_detail(uuid)` RPC;
- reversal linkage/count expectations returning sentinel values because schema is absent;
- material stock not changing because reversal implementation is absent.

The test file now runs its full planned assertion count without aborting on missing columns.

---

## Implementation artifacts created in this work unit

| Artifact | Path |
|----------|------|
| Apply progress (this file) | `openspec/changes/2026-06-25-editable-stock-movement-ledger/apply-progress.md` |
| RED SQL/RLS tests | `supabase/tests/stock_movement_reversal.test.sql` |
| Updated tasks | `openspec/changes/2026-06-25-editable-stock-movement-ledger/tasks.md` |

## TDD Cycle Evidence (Work Unit 1)

| Phase | Status | Notes |
|-------|--------|-------|
| RED | ✅ Confirmed | `supabase test db --local supabase/tests/stock_movement_reversal.test.sql` ran 24 tests, failed 14 as expected against missing reversal schema/RPCs |
| GREEN | ⏳ Not yet | Requires migration + RPC implementation |
| TRIANGULATE | ⏳ Not yet | Edge cases included in test design |
| REFACTOR | ⏳ Not yet | Post-implementation cleanup |

---

## Work Unit 2 progress — Database/RLS GREEN

### Implementation completed

New migration: `supabase/migrations/20260625183000_stock_movement_reversals.sql`

Implemented:

- `workshop_user_role` enum: `admin`, `operational`, `viewer`.
- `profiles.workshop_role` with authenticated-user mutation guard.
- `stock_movements` reversal metadata:
  - `reversal_of_movement_id`
  - `reversal_reason`
  - `reversed_original_reason`
  - `reversal_request_id`
- reversal constraints and indexes:
  - no self-reversal
  - reversal reason required
  - original reason snapshot required
  - one reversal per original movement
  - idempotency request index
  - reversal lookup index
- authenticated-user immutability guard for direct `stock_movements` UPDATE/DELETE.
- `reverse_stock_movement(uuid, text, uuid default null)` RPC:
  - derives workshop and role from `auth.uid() -> profiles`;
  - permits `admin` and `operational` only;
  - rejects cross-workshop access with `42501`;
  - locks the original movement and material stock row;
  - rejects reversal-of-reversal and double reversal;
  - rejects negative-stock outcomes;
  - writes an append-only compensating movement row;
  - leaves original movement rows unchanged.
- `get_stock_movement_detail(uuid)` RPC with reversal linkage and `can_reverse` flag.

### Test evolution

The initial RED test file needed cleanup after the first GREEN attempt because several scenarios reused `movement_orig` after a successful reversal. The test was adjusted to:

- assign explicit `profiles.workshop_role` values when the role column exists;
- use separate movement fixtures for original reversal, operational reversal, cross-tenant attempts, and compensating-stock assertions;
- keep the negative-stock scenario isolated from the final stock-update scenario.

### GREEN evidence

Focused reversal test:

```bash
supabase migration up --local
supabase test db --local supabase/tests/stock_movement_reversal.test.sql
```

Result:

```text
/home/elias/Proyectos/carpinteroPro/supabase/tests/stock_movement_reversal.test.sql .. ok
All tests successful.
Files=1, Tests=24
Result: PASS
```

Existing inventory SQL regression tests:

```bash
supabase test db --local supabase/tests/stock_movement_creator.test.sql supabase/tests/stock_movement_ledger.test.sql
```

Result:

```text
/home/elias/Proyectos/carpinteroPro/supabase/tests/stock_movement_creator.test.sql .. ok
/home/elias/Proyectos/carpinteroPro/supabase/tests/stock_movement_ledger.test.sql ... ok
All tests successful.
Files=2, Tests=16
Result: PASS
```

### Remaining database/API follow-up

- The detail RPC exists, but `get_stock_movement_ledger` has not yet been extended with reversal-specific return columns. That remains open for the ledger/reporting/CSV work unit.
- Manual Supabase TypeScript types still need to be updated for the new enum, columns, and RPCs before frontend API/hook work.

---

## Work Unit 3 progress — Manual Supabase types

Updated `src/shared/types/database.ts` for:

- `workshop_user_role` enum.
- `profiles.workshop_role` row/insert/update typing.
- `stock_movement_reason = 'reversion'`.
- `stock_movements` reversal columns.
- self-referential `stock_movements_reversal_of_movement_id_fkey` relationship.
- `reverse_stock_movement` RPC args/return.
- `get_stock_movement_detail` RPC return shape.

Diagnostics:

```bash
lsp_diagnostics src/shared/types/database.ts
```

Result:

```text
No diagnostics found.
```

---

## Work Unit 4 progress — API and hooks RED/GREEN

### API RED/GREEN

Added API tests in `src/features/inventory/api/stockMovements.test.ts` for:

- `fetchStockMovementDetail(movementId)` calling `get_stock_movement_detail`.
- returning first detail row or `null`.
- surfacing Supabase detail errors.
- `reverseStockMovement(input)` calling `reverse_stock_movement`.
- passing optional idempotency request id.
- surfacing authorization/idempotency errors.
- returning reversal movement id.

Implemented in `src/features/inventory/api/stockMovements.ts`:

- `StockMovementDetail` type.
- `ReverseStockMovementInput` type.
- `fetchStockMovementDetail`.
- `reverseStockMovement`.

Evidence:

```bash
npm test -- src/features/inventory/api/stockMovements.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests  19 passed (19)
```

### Hooks RED/GREEN

Added hook tests in `src/features/inventory/hooks/useStockMovements.test.ts` for:

- `useStockMovementDetail` enabled/disabled behavior.
- `useReverseStockMovement` mutation invalidating materials, per-material stock movements, ledger, and movement detail query keys.

Implemented in `src/features/inventory/hooks/useStockMovements.ts`:

- detail query key family: `["stock_movements", "detail", movementId]`.
- `useStockMovementDetail`.
- `useReverseStockMovement` with explicit payload mapping to avoid unused variables and preserve strict TypeScript.

Evidence:

```bash
npm test -- src/features/inventory/hooks/useStockMovements.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests  9 passed (9)
```

Diagnostics:

```text
lsp_diagnostics checked 5 touched TypeScript files: no diagnostics found.
```

---

## Work Unit 5 progress — Dedicated movement detail UI

Added `src/features/inventory/components/StockMovementDetailPage.tsx` and tests covering:

- loading state;
- error state;
- movement detail rendering;
- immutable audit copy;
- role/state-gated reversal action visibility;
- non-empty reversal reason validation;
- reversal submission payload.

Updated ledger table and routing:

- `StockMovementLedgerTable` links material names to `/inventory/movements/:movementId`.
- `StockMovementLedgerTable` labels `reversion` as `Reversión`.
- `InventoryRoutes` includes the dedicated movement detail route.
- `src/features/inventory/index.ts` exports the new API/hook types and functions.

Evidence:

```bash
npm test -- src/features/inventory/components/StockMovementDetailPage.test.tsx src/features/inventory/components/StockMovementLedgerTable.test.tsx
```

Result:

```text
Test Files  2 passed (2)
Tests  13 passed (13)
```

Diagnostics:

```text
lsp_diagnostics checked StockMovementDetailPage, StockMovementLedgerTable, routes, and inventory index: no diagnostics found.
```

---

## Work Unit 6 progress — Ledger, reporting, CSV, and cache privacy

### Database/RPC ledger extension

Added `supabase/migrations/20260625184500_stock_movement_ledger_reversal_columns.sql` to recreate `get_stock_movement_ledger` with reversal linkage fields:

- `reversal_of_movement_id`
- `reversal_reason`
- `reversed_original_reason`
- `is_reversal`
- `reversed_by_movement_id`

Evidence:

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

### TypeScript reporting/cache

Updated:

- `src/shared/types/database.ts` for extended ledger return fields.
- `src/features/inventory/lib/stockMovementCsv.ts` with reversal traceability columns.
- `src/features/inventory/components/StockMovementLedgerTable.tsx` with detail links and `Reversión` reason label.
- `src/shared/lib/cachePrivacy.test.ts` for movement detail query keys.

Evidence:

```bash
npm test -- src/features/inventory/lib/stockMovementCsv.test.ts src/shared/lib/cachePrivacy.test.ts src/features/inventory/components/StockMovementLedgerTable.test.tsx src/features/inventory/components/StockMovementLedgerPage.test.tsx src/features/inventory/hooks/useStockMovements.test.ts src/features/inventory/api/stockMovements.test.ts
```

Result:

```text
Test Files  6 passed (6)
Tests  55 passed (55)
```

Diagnostics:

```text
lsp_diagnostics checked 15 touched TypeScript/TSX files: no diagnostics found.
```

### Triangulation/refactor notes

Triangulation scenarios are present in SQL and UI/API tests:

- already-reversed movement / one reversal per original;
- unauthorized viewer role;
- cross-tenant denial;
- negative-stock rejection;
- reversal reason required;
- non-reversible UI state.

Refactor pass kept API payload mapping explicit and avoided unused variables or `any`.

---

## Final apply verification

Full frontend/unit suite:

```bash
npm test
```

Result:

```text
Test Files  97 passed (97)
Tests  724 passed (724)
```

Focused SQL/RLS suites:

```bash
supabase test db --local supabase/tests/stock_movement_reversal.test.sql supabase/tests/stock_movement_ledger.test.sql
```

Result:

```text
All tests successful.
Files=2, Tests=35
Result: PASS
```

Type diagnostics:

```text
lsp_diagnostics checked 15 touched TypeScript/TSX files: no diagnostics found.
```

Lens diagnostics note:

- `lens_diagnostics mode=all` initially showed two stale TypeScript errors for
  `src/features/inventory/api/stockMovements.test.ts` from the intermediate RED
  state before `fetchStockMovementDetail` and `reverseStockMovement` were
  implemented.
- Active LSP diagnostics for that file now report no diagnostics, and `npm test`
  passes the file.
- `lens_diagnostics mode=full` also reports pre-existing/unrelated project
  diagnostics outside this SDD scope: `.playwright-mcp` generated HTML parsed as
  CSS, Deno globals/imports in Supabase edge-function shared files, and JSONC
  comments in tsconfig files.
