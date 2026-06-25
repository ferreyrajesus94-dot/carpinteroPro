# Design — Editable Stock Movement Ledger via Append-only Reversals

This change keeps `stock_movements` immutable by adding a role-gated reversal command that writes a compensating movement row linked to the original. The main implementation should stay inside `packages/coding-agent` scope as instructed by the SDD role, but this repository stores the relevant app code under `src/features/inventory`, `src/shared`, `supabase/migrations`, and `tests`.

## Executive decision summary

| Area | Decision |
| --- | --- |
| Ledger model | Reversals are normal `stock_movements` rows with extra linkage columns; originals are never updated. |
| Reversal effect | New row uses `delta = original.delta * -1` and updates `materials.stock` in the same SQL transaction. |
| Idempotency | Enforce one reversal per original with a partial unique index and row locking. Optional request idempotency can return/reject consistently without creating duplicates. |
| Authorization | Enforce in the reversal RPC, not only the UI. Current schema has no workshop role model, so implementation must add or integrate one before exposing reversal. |
| UI | Add a dedicated movement detail route/panel reachable from `/inventory/movements`; reversal confirmation requires a reason. |
| Reporting/CSV | Show both original and reversal rows; include reversal flags and original movement id in CSV. |
| TDD | SQL/RLS tests must fail first for reversal RPC/constraints; Vitest/RTL tests must fail first for detail/reversal UX and CSV semantics. |

## Existing code and dirty-carryover awareness

The design builds on prior inventory-ledger work that may still be dirty/uncommitted. Later apply phases must inspect the working tree before editing and avoid bundling unrelated carryover.

Likely affected files:

- `supabase/migrations/0007_stock_movements.sql` — original table/function reference only; do not edit old migration unless project policy requires squashing.
- `supabase/migrations/20260624120000_creator_attribution_and_ledger_rpc.sql` — current `apply_stock_movement` and `get_stock_movement_ledger` definitions to extend through a new migration.
- `tests/stock_movement_creator.test.sql` — existing creator attribution regression.
- `tests/stock_movement_ledger.test.sql` — existing ledger/RLS coverage.
- New `tests/stock_movement_reversal.test.sql` — reversal authorization, tenant isolation, idempotency, negative-stock, and immutability coverage.
- `src/shared/types/database.ts` — manual Supabase type updates for new columns, enum values, and RPC returns. Keep `Relationships` accurate.
- `src/features/inventory/api/stockMovements.ts` — detail fetch and reversal command API functions/types.
- `src/features/inventory/hooks/useStockMovements.ts` — detail/reversal hooks and cache invalidation.
- `src/features/inventory/components/StockMovementLedgerPage.tsx` and `StockMovementLedgerTable.tsx` — link to movement detail and display reversal markers.
- New `src/features/inventory/components/StockMovementDetailPage.tsx` or `StockMovementDetailPanel.tsx` — dedicated review/reversal surface.
- `src/features/inventory/lib/stockMovementCsv.ts` and tests — reversal columns and labels.
- `src/features/inventory/routes.tsx` — add `movements/:movementId` route.
- `src/features/inventory/index.ts` — export public inventory API/hook types intended for app-level composition.
- `src/shared/lib/cachePrivacy.test.ts` — add non-persistable query key checks for movement detail/reversal if new query-key families are introduced.

## Database/data model

### `stock_movements` additions

Add a new migration rather than modifying existing historical migrations:

```sql
ALTER TYPE stock_movement_reason ADD VALUE IF NOT EXISTS 'reversion';

ALTER TABLE public.stock_movements
  ADD COLUMN reversal_of_movement_id uuid NULL REFERENCES public.stock_movements(id) ON DELETE RESTRICT,
  ADD COLUMN reversal_reason text NULL,
  ADD COLUMN reversed_original_reason stock_movement_reason NULL,
  ADD COLUMN reversal_request_id uuid NULL;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_reversal_not_self
  CHECK (reversal_of_movement_id IS NULL OR reversal_of_movement_id <> id),
  ADD CONSTRAINT stock_movements_reversal_reason_required
  CHECK (reversal_of_movement_id IS NULL OR length(trim(coalesce(reversal_reason, ''))) > 0),
  ADD CONSTRAINT stock_movements_reversal_original_reason_required
  CHECK (reversal_of_movement_id IS NULL OR reversed_original_reason IS NOT NULL);

CREATE UNIQUE INDEX stock_movements_one_reversal_per_original_idx
  ON public.stock_movements (reversal_of_movement_id)
  WHERE reversal_of_movement_id IS NOT NULL;

CREATE UNIQUE INDEX stock_movements_reversal_request_idx
  ON public.stock_movements (workshop_id, reversal_request_id)
  WHERE reversal_request_id IS NOT NULL;

CREATE INDEX stock_movements_reversal_lookup_idx
  ON public.stock_movements (workshop_id, reversal_of_movement_id, created_at DESC)
  WHERE reversal_of_movement_id IS NOT NULL;
```

Notes:

- Original rows remain unchanged. Do **not** add a `reversed_at` or `reversed_by_movement_id` column that requires updating the original row.
- `reversal_of_movement_id IS NULL` means original/non-reversal movement.
- `reversed_original_reason` snapshots the original reason on the reversal row for audit/export readability; the FK link remains the source of truth.
- `created_by` is already available and should identify the user who performed the reversal.
- `workshop_id uuid NOT NULL` remains mandatory for every movement row; no new table is required for the ledger itself.

### Role model prerequisite

Severity: **high** — the current schema appears to lack workshop-level roles. `profiles` has `workshop_id`, `display_name`, consent fields, and `is_platform_admin`, but no operational/admin workshop role. The reversal RPC cannot satisfy the spec with UI-only gating.

Recommended minimal implementation:

```sql
CREATE TYPE workshop_user_role AS ENUM ('admin', 'operational', 'viewer');

ALTER TABLE public.profiles
  ADD COLUMN workshop_role workshop_user_role NOT NULL DEFAULT 'admin';
```

Rationale:

- Existing workshops appear single-user by default, so `admin` preserves current behavior.
- The RPC can check `profiles.workshop_role IN ('admin', 'operational')`.
- `is_platform_admin` is platform-scope and should not be reused as workshop authorization.

If a fuller membership model is already planned elsewhere, replace this with that canonical role source before implementation.

## RPC/API contracts

### `reverse_stock_movement`

Add a server-side mutation RPC:

```sql
CREATE OR REPLACE FUNCTION public.reverse_stock_movement(
  p_movement_id uuid,
  p_reversal_reason text,
  p_reversal_request_id uuid DEFAULT NULL
)
RETURNS TABLE (
  reversal_movement_id uuid,
  material_id uuid,
  new_stock numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$ ... $$;
```

Required behavior:

1. Derive `v_current_user_id := auth.uid()` and `v_current_workshop_id` from `profiles`.
2. Reject unauthenticated or missing profile with `42501`.
3. Check `profiles.workshop_role IN ('admin', 'operational')`; reject others with `42501`.
4. Validate non-empty `p_reversal_reason`.
5. Select original movement by `p_movement_id` and `workshop_id = v_current_workshop_id FOR UPDATE`.
6. Reject cross-workshop/not-found as `42501` or a generic not-found error that does not leak tenant data.
7. Reject rows where `reversal_of_movement_id IS NOT NULL`; reversal rows cannot be reversed in this slice.
8. Reject if a reversal already exists for the original. The unique partial index is the final concurrency guard.
9. Compute `v_compensating_delta := original.delta * -1`.
10. Atomically update `materials.stock = stock + v_compensating_delta` for the same `workshop_id` and `material_id`.
11. Reject negative resulting stock; the exception rolls back both stock update and reversal insert.
12. Insert a reversal movement with:
    - same `workshop_id`, `material_id`, and `quote_id` as the original,
    - `delta = v_compensating_delta`,
    - `reason = 'reversion'`,
    - `note` optional system copy such as `Reversión de movimiento <id>` or a normalized note containing the user reason,
    - `reversal_of_movement_id = original.id`,
    - `reversal_reason = p_reversal_reason`,
    - `reversed_original_reason = original.reason`,
    - `created_by = auth.uid()`,
    - `reversal_request_id = p_reversal_request_id` when supplied.
13. Return the reversal id and new material stock.

Idempotency stance:

- Double reversal of the same original must be rejected with no new row.
- Concurrent attempts are guarded by `FOR UPDATE` plus `stock_movements_one_reversal_per_original_idx`.
- If `p_reversal_request_id` is provided and a retry has the same key after a successful insert, either return the existing reversal row or raise a typed `already_processed` error. Do not create a second row.

### Detail/read RPC

Add a dedicated read RPC instead of requiring the UI to reconstruct eligibility with multiple direct table queries:

```sql
CREATE OR REPLACE FUNCTION public.get_stock_movement_detail(p_movement_id uuid)
RETURNS TABLE (
  id uuid,
  workshop_id uuid,
  material_id uuid,
  material_name text,
  material_unit unit_of_measure,
  delta numeric,
  reason stock_movement_reason,
  note text,
  quote_id uuid,
  quote_number text,
  created_at timestamptz,
  created_by uuid,
  creator_name text,
  reversal_of_movement_id uuid,
  reversal_reason text,
  reversed_original_reason stock_movement_reason,
  reversal_movement_id uuid,
  reversal_created_at timestamptz,
  can_reverse boolean,
  ineligible_reason text
)
LANGUAGE plpgsql
SECURITY INVOKER;
```

Rules:

- Derive workshop from `auth.uid()`; never accept `workshop_id` from the client.
- Return no rows for cross-workshop movement ids.
- `can_reverse` is a convenience flag only; the mutation RPC remains authoritative.
- `ineligible_reason` values may be stable strings such as `already_reversed`, `is_reversal`, `negative_stock_would_result`, `unauthorized`.
- Include enough context for the detail UI: material, signed delta, reason, note, quote reference, creator, original/reversal linkage.

### Extend `get_stock_movement_ledger`

Extend the existing ledger RPC return type with:

- `reversal_of_movement_id uuid`
- `reversal_reason text`
- `reversed_original_reason stock_movement_reason`
- `is_reversal boolean`
- optionally `original_created_at timestamptz` or `original_reason stock_movement_reason` when useful for display/export.

Keep existing filters, tenant derivation, `SECURITY INVOKER`, limit clamp `[1, 500]`, and deterministic ordering.

## RLS and security

- Keep `stock_movements` RLS scoped by `get_current_workshop_id()` for reads/inserts.
- The reversal RPC must be `SECURITY INVOKER`; if implementation hits RLS limitations and requires `SECURITY DEFINER`, the function must set a locked `search_path`, perform explicit workshop/role checks, and receive a separate security review.
- Do not expose service role keys in frontend code.
- Do not trust hidden UI controls for authorization.
- Cross-workshop movement ids must not reveal whether the movement exists.
- CSV export must use the same tenant-scoped RPC as the ledger; no broad client-side reads.

## Stock consistency rules

- Reversal delta is always the arithmetic inverse of the original movement delta.
- The reversal row is applied to `materials.stock`; current stock is the operational source of truth.
- If reversing a positive original would make stock negative, reject the reversal and insert no row.
- Reversing a negative original increases stock and should generally pass unless the material has been deleted or tenant checks fail.
- Reversal rows cannot be reversed in this change. If future product needs undo-of-reversal, model it as a separate SDD because double compensation is easy to misunderstand.
- Material deletion currently cascades `stock_movements` via `ON DELETE CASCADE`; this is an existing audit concern. This change should not broaden it, but reviewers should flag whether immutable audit rows should eventually switch to `ON DELETE RESTRICT` or soft-delete materials.

## Frontend architecture

Stay inside feature-sliced boundaries:

- Inventory DB/API calls: `src/features/inventory/api/stockMovements.ts`.
- TanStack Query wrappers: `src/features/inventory/hooks/useStockMovements.ts` or a sibling inventory hook file.
- Inventory UI: `src/features/inventory/components/*`.
- App-level composition can use exports from `src/features/inventory/index.ts`; do not import inventory internals from other features.

Recommended additions:

- `fetchStockMovementDetail(movementId)` calling `get_stock_movement_detail`.
- `reverseStockMovement({ movementId, reason, requestId })` calling `reverse_stock_movement`.
- `useStockMovementDetail(movementId)` query key: `['stock_movements', 'detail', movementId]`.
- `useReverseStockMovement()` mutation invalidating:
  - `['materials']` or the current workshop material key,
  - `['stock_movements']` family,
  - `['stock_movements', 'detail', movementId]`.
- `StockMovementDetailPage` at `/inventory/movements/:movementId`.
- Ledger rows link to the detail route. The reversal action should live in the detail surface, not as the primary inline row action.
- Detail page shows: movement context, current reversal status, related rows for the same material/original pair, creator, quote link, and a confirmation dialog requiring `reversalReason`.
- Use React 19 style: named React imports, no unnecessary `useMemo`/`useCallback` manual memoization.
- Use strict TypeScript: const objects for stable statuses/reasons, no `any`, flat interfaces.

## Reporting and CSV semantics

Ledger and per-material history must include both original and reversal rows. Do not hide the original after reversal.

UI labels:

- Mark `reason = 'reversion'` or `is_reversal = true` as `Reversión` / `Corrección`.
- Show `Revierte movimiento <short id>` for reversal rows.
- On original detail, show `Revertido por <short id>` when a reversal exists.

CSV additions:

- Add columns after existing stable columns to minimize disruption:
  - `es_reversion`
  - `movimiento_original_id`
  - `motivo_reversion`
- Existing aggregate totals remain valid if they sum deltas because reversal rows carry compensating deltas. Reports that count movement rows should clarify that original and reversal are separate audit entries.

## Test plan and strict TDD evidence

Run all validation with `npm test` per `openspec/config.yaml`.

### SQL/RLS RED tests first

Add `tests/stock_movement_reversal.test.sql` before implementation. It should initially fail because columns/RPCs do not exist.

Required SQL cases:

- Admin/operational user reverses eligible same-workshop original and original row remains byte-for-byte unchanged for protected fields.
- Reversal row links to original, uses inverse delta, `reason = 'reversion'`, required `reversal_reason`, `created_by = auth.uid()`.
- Double reversal is rejected; no second row exists.
- Reversal row itself is ineligible.
- Cross-workshop reversal raises `42501` or equivalent tenant error; no row inserted.
- Viewer/unauthorized role gets permission error; no row inserted.
- Negative-stock reversal is rejected and material stock remains unchanged.
- Concurrent/idempotent path is protected by unique index/request key.
- Detail RPC returns no cross-workshop row and includes linkage/status for same-workshop rows.

### Frontend RED tests first

Add or update Vitest/RTL tests:

- `src/features/inventory/api/stockMovements.test.ts` — RPC args for detail/reversal, error propagation, no `workshop_id` parameter.
- `src/features/inventory/hooks/useStockMovements.test.ts` — query keys, mutation invalidation, success/error behavior.
- `src/features/inventory/components/StockMovementLedgerTable.test.tsx` — reversal rows are marked and link to detail.
- `src/features/inventory/components/StockMovementDetailPage.test.tsx` — context/history renders; authorized eligible user sees reversal action; unauthorized/ineligible hides or disables it; reason is required before submit.
- `src/features/inventory/lib/stockMovementCsv.test.ts` — CSV includes reversal flag and original id.
- `src/shared/lib/cachePrivacy.test.ts` — new detail query key remains non-persistable.

Evidence required in apply/verify handoff:

1. RED: failing SQL and frontend test output before implementation.
2. GREEN: minimal implementation passing the new tests.
3. TRIANGULATE: at least one edge case test for double reversal, cross-tenant, or negative stock.
4. REFACTOR: final `npm test` passing after cleanup.

## Work units and review boundaries

Suggested chunks to stay near the 400 changed-line review budget:

1. **DB roles + reversal schema/tests** — role field/enum, stock movement columns/indexes, SQL tests.
2. **Reversal/detail RPCs + database types** — mutation/read contracts and generated/manual type updates.
3. **Inventory API/hooks** — typed frontend contracts and cache invalidation.
4. **Detail UI + route** — dedicated page/panel and confirmation workflow.
5. **Ledger/CSV presentation** — labels, links, export columns, tests.
6. **Spec/canonical update** — apply the OpenSpec delta and archive later per SDD workflow.

If role-model work grows beyond the budget, split it as a prerequisite PR and keep reversal disabled until server-side authorization is available.

## Rollout and rollback

Rollout:

1. Ship schema columns and role source first.
2. Deploy RPCs and type updates.
3. Deploy read-only detail UI without enabled reversal if needed.
4. Enable reversal action only after SQL/RLS tests pass and roles are populated.

Rollback:

- Hide/disable the reversal action and remove route links first.
- Keep existing reversal rows visible; they are audit records and should not be deleted in rollback.
- If RPC is faulty, revoke execute on `reverse_stock_movement` or replace it with a function that raises a maintenance error.
- Do not mutate original or reversal movement rows during rollback without a separate approved data correction plan.

## Residual risks and review findings

- **high: schema authorization gap** — `profiles` currently lacks workshop role data; implementation must add a role source or block reversal exposure.
- **medium: enum migration** — adding `stock_movement_reason = 'reversion'` can affect TypeScript labels, tests, and any exhaustive reason handling.
- **medium: audit deletion inheritance** — existing `stock_movements.material_id ON DELETE CASCADE` can remove audit rows if a material is deleted; not introduced here but relevant to immutable-ledger claims.
- **medium: dirty carryover** — prior inventory-ledger files may be uncommitted; apply phase must isolate diffs.
- **low: reporting interpretation** — sums of `delta` remain correct, but counts and filtered exports must communicate reversal rows clearly.
