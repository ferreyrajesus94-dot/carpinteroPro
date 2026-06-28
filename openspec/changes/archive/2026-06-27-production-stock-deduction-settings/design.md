# Design: Production-start stock deduction

Automatic stock deduction will move from quote approval to the controlled `aprobado -> en_produccion` production-start flow. The design keeps the first implementation quote-based, adds an immutable approved BOM snapshot for deduction, and introduces a quote-level production deduction batch so production consumption is at-most-once and reversible as a whole.

## Executive decisions

| Area | Decision |
| --- | --- |
| Setting semantics | Keep `workshop_settings.auto_stock_discount`, but relabel it as automatic deduction when production starts. |
| Trigger | Only `quotes.status = 'aprobado'` to `target = 'en_produccion'` can start the production-deduction flow. |
| Snapshot source | Add a dedicated immutable approved BOM snapshot table. Production deduction reads this snapshot, never mutable `recipe_items`, `cut_pieces`, or template rows. |
| Plate/cut-piece safety | Capture the final deduction quantity at approval time and store calculation context for audit. Production start does not recompute nesting. |
| Idempotency | Add one production deduction batch per quote with a unique `(workshop_id, quote_id)` constraint and client `request_id` support. |
| Negative stock | Keep generic `apply_stock_movement` strict. A new production-start RPC may update stock below zero after warning/confirmation. |
| Confirmation | All-or-nothing. No per-material exclusion or quantity editing. |
| Manual mode | Still shows read-only preview, then starts production without movements. |
| Corrections | Primary path reverses the whole quote production-deduction batch through append-only compensating movements. |
| First-scope reporting | Ledger, detail, CSV, and inventory/admin report surfaces show production origin and quote/batch context. Dashboard widgets stay out of scope. |

## Current findings that affect the design

- **high: `src/features/quotes/hooks/useQuotes.ts` + `src/features/quotes/api/quotes.ts`** — `QuoteList` status changes call `useUpdateQuote` without `recipeSnapshots`/`laborSnapshots`; `updateQuote()` defaults missing arrays to `[]` and `replaceSnapshots()` deletes existing snapshots. Production-start work should not reuse this status path for approval/production transitions.
- **high: `src/features/quotes/api/stockDiscount.ts`** — approval-time deduction reads mutable `recipe_items` and `cut_pieces`, then calls strict `apply_stock_movement`; this conflicts with the approved-snapshot and shortage-allowed requirements.
- **medium: `supabase/migrations/0012_quote_recipe_snapshots.sql`** — quote recipe snapshots hold material quantity/pricing, but not enough plate/cut-piece dimensions to reconstruct nesting safely later; they are also replaced on quote update.
- **medium: `src/features/inventory/lib/stockMovementLabels.ts` / ledger CSV/detail surfaces** — reason labels and RPC return types must be extended when adding `consumo_produccion` and production batch context.

## Data model

### 1. Approved BOM snapshot

Add `quote_approved_bom_lines` as the immutable deduction source of truth.

Proposed columns:

| Column | Contract |
| --- | --- |
| `id uuid primary key default gen_random_uuid()` | Line identity. |
| `workshop_id uuid not null references workshops(id)` | Tenant isolation; indexed; RLS required. |
| `quote_id uuid not null references quotes(id) on delete cascade` | Source quote. |
| `line_number integer not null` | Stable display/order within the approved BOM. |
| `source_recipe_snapshot_id uuid null references quote_recipe_snapshots(id) on delete set null` | Trace to quote snapshot when available. |
| `material_id uuid null references materials(id) on delete set null` | Material to deduct; nullable so incomplete/unresolved lines can be audited. |
| `material_name text not null` | Frozen display name. |
| `material_unit text not null` | Frozen unit display. |
| `material_category text not null` | Frozen category display. |
| `deduction_quantity numeric(12,2) null check (deduction_quantity is null or deduction_quantity > 0)` | Final positive quantity to consume at production start. Null means incomplete. |
| `calculation_method text not null` | Const-style values in TS, e.g. `direct_quantity`, `plate_nesting`, `unresolved`. |
| `is_complete boolean not null default true` | Whether the line can be deducted automatically. |
| `warning_code text null` | e.g. `missing_material`, `missing_plate_dimensions`, `missing_cut_pieces`, `invalid_quantity`. |
| `calculation_context jsonb not null default '{}'::jsonb` | Audit-only frozen context: original quantity/waste, plate dimensions, cut pieces, nesting boards needed, or unresolved reason. |
| `created_at timestamptz not null default now()` | Capture timestamp. |

Constraints and indexes:

- `unique (quote_id, line_number)`.
- Index `(workshop_id, quote_id)`.
- RLS all policies scoped to `workshop_id = get_current_workshop_id()`.
- Manually maintained `database.ts` entries must include `Relationships: []` per project convention.

Capture contract:

- Add RPC `capture_quote_approved_bom(p_quote_id uuid) returns void` or a feature API command that runs immediately after quote snapshots are saved when a quote first transitions into `aprobado`.
- The command locks the quote, verifies workshop ownership, and only writes/rewrites approved BOM lines when the quote is entering `aprobado` and no production deduction batch exists.
- For normal material lines, store `deduction_quantity = quote_recipe_snapshots.quantity` (including whatever the quote snapshot currently represents).
- For plate/cut-piece lines, compute the board count at approval time from current complete source data, then store `deduction_quantity = boardsNeeded` plus `calculation_context` with board dimensions and cut pieces. If required cut-piece or board dimension data is unavailable, insert an incomplete line instead of silently falling back.
- After capture, production start reads only `quote_approved_bom_lines`. If templates/recipes/cut pieces change later, deduction remains unchanged.

Why this is safer than extending mutable quote snapshots only: existing quote snapshots can be replaced on quote edit and lack cut-piece detail. A dedicated approved BOM minimizes the production-start query surface and freezes the final consumption quantity before mutable recipe data can drift.

### 2. Production deduction batch

Add `quote_production_stock_deductions` as the quote-level idempotency and reversal batch.

Proposed columns:

| Column | Contract |
| --- | --- |
| `id uuid primary key default gen_random_uuid()` | Batch identity. |
| `workshop_id uuid not null references workshops(id)` | Tenant isolation. |
| `quote_id uuid not null references quotes(id) on delete cascade` | One batch per quote. |
| `request_id uuid null` | Client idempotency token for network retries. |
| `status text not null default 'completed'` | Const-style TS values: `completed`, `reversed`. |
| `auto_stock_discount_enabled boolean not null` | Setting value at confirmation time. |
| `snapshot_incomplete boolean not null default false` | Whether any approved BOM line was incomplete. |
| `shortage_detected boolean not null default false` | Whether any material stock was insufficient at preview/confirmation. |
| `warning_summary jsonb not null default '[]'::jsonb` | Audit copy of strong warnings shown to user. |
| `confirmed_by uuid null` | `auth.uid()` at production start. |
| `confirmed_at timestamptz not null default now()` | Confirmation time. |
| `reversed_by uuid null` / `reversed_at timestamptz null` / `reversal_reason text null` | Whole-batch reversal audit. |

Constraints and indexes:

- `unique (workshop_id, quote_id)` enforces at-most-once per quote.
- `unique (workshop_id, request_id) where request_id is not null` makes network retries idempotent.
- Index `(workshop_id, confirmed_at desc)`.
- RLS all policies scoped to `workshop_id = get_current_workshop_id()`.

Extend `stock_movements`:

- Add enum value `consumo_produccion`; retain `descuento_presupuesto` as legacy.
- Add nullable `production_deduction_id uuid references quote_production_stock_deductions(id) on delete set null`.
- Add index `(workshop_id, production_deduction_id)` where not null.

## RPC and API boundaries

### Keep manual movement strict

`apply_stock_movement(p_material_id, p_delta, p_reason, p_note, p_quote_id)` remains the generic manual path and continues to reject negative resulting stock. Do not add an `allow_negative` parameter to this RPC; that would broaden a safety exception beyond the product-approved path.

### New preview RPC

Add `get_quote_production_deduction_preview(p_quote_id uuid)`.

Contract:

- SECURITY INVOKER, derives workshop from `auth.uid() -> profiles.workshop_id`.
- Verifies the quote belongs to the current workshop and currently has `status = 'aprobado'` for production-start preview. If status is already `en_produccion` and a batch exists, it can return existing result context for visibility, but must not suggest a new deduction.
- Reads `workshop_settings.auto_stock_discount` and `quote_approved_bom_lines`.
- Returns one row per approved BOM line with: material id/name/unit, deduction quantity, current stock, projected stock, shortage amount, `is_complete`, warning code, and existing `production_deduction_id` if present.
- Strong warning conditions: no approved BOM lines, incomplete lines, unresolved material, invalid/null quantity, insufficient stock, existing batch.
- Creates no movements and updates no quote status.

Frontend wrapper location: `src/features/quotes/api/productionStockDeduction.ts` with hook in `src/features/quotes/hooks/useProductionStockDeduction.ts`. This stays within the quotes feature because the user action is quote production start; inventory remains the ledger/reversal/reporting consumer.

### New production-start RPC

Add `start_quote_production(p_quote_id uuid, p_confirm_deduction boolean, p_request_id uuid default gen_random_uuid()) returns jsonb`.

Contract:

1. Lock the quote row `for update` and derive workshop from auth.
2. Reject cross-workshop access with `42501`.
3. If quote is already `en_produccion` and a batch exists, return the existing batch/result without creating movements.
4. Require current status `aprobado`; other transitions do not trigger production deduction.
5. Read `workshop_settings.auto_stock_discount` at execution time.
6. If setting is off: update quote to `en_produccion`, create no batch/movements, and return preview/warning summary with `movements_created = 0`.
7. If setting is on: require `p_confirm_deduction = true`; otherwise reject with a confirmation-required error.
8. If a batch for the quote already exists, return it idempotently and do not create movements.
9. Insert one `quote_production_stock_deductions` row before movements. The unique `(workshop_id, quote_id)` constraint is the final duplicate guard under concurrency.
10. For each complete approved BOM line with `material_id` and positive `deduction_quantity`, lock the material row, update `materials.stock = stock - deduction_quantity` even if negative, and insert a `stock_movements` row with `delta = -deduction_quantity`, `reason = 'consumo_produccion'`, `quote_id`, `production_deduction_id`, `created_by = auth.uid()`, and a note like `Inicio de producción presupuesto <quote_number>`.
11. Incomplete lines do not create movement rows, but their warning codes are copied to the batch `warning_summary` and returned.
12. Update quote status to `en_produccion` in the same transaction.
13. Return batch id, movements created, lines skipped due to incomplete data, shortage warnings, and projected negative stock lines.

All-or-nothing means the transaction either updates the quote and all applicable complete movement lines, or it rolls back entirely. The only allowed "partial" semantic is audited incomplete BOM lines that were shown before confirmation and intentionally skipped because no safe material/quantity exists.

### Whole-batch reversal RPC

Add `reverse_production_stock_deduction(p_deduction_id uuid, p_reversal_reason text, p_reversal_request_id uuid default null) returns uuid`.

Contract:

- Authorized for existing reversal roles (`admin`, `operational`) using the same role derivation as `reverse_stock_movement`.
- Locks the batch and all original `consumo_produccion` movements for the batch.
- If already reversed, returns/raises idempotently based on `p_reversal_request_id`; never creates duplicate compensating rows.
- Creates one `reversion` movement per original movement with `reversal_of_movement_id`, `reversed_original_reason = 'consumo_produccion'`, `quote_id`, and the same `production_deduction_id`.
- Updates material stock by the compensating delta using the existing strict reversal semantics; if reversal would make stock negative, reject like current `reverse_stock_movement`.
- Marks the batch `status = 'reversed'`, `reversed_by`, `reversed_at`, and `reversal_reason`.
- Original movement rows remain immutable.

Individual movement reversal remains available for audit/admin needs, but production-origin detail pages should guide users to the batch reversal path first.

## Replacing approval-time behavior

Remove the approval-time side effect from the quote update mutation:

- Delete or deprecate `src/features/quotes/api/stockDiscount.ts`.
- Remove `maybeAutoDiscountStock()` import/call from `src/features/quotes/hooks/useQuotes.ts`.
- Add a dedicated status/transition API instead of using `updateQuote()` with missing snapshots:
  - `approveQuoteAndCaptureBom(quoteId, quoteUpdate, extras, recipeSnapshots, laborSnapshots)` for the form save path that transitions into `aprobado`.
  - `startQuoteProduction(...)` for `aprobado -> en_produccion` from list, pipeline, and form status controls.
  - A status-only update helper for non-production transitions that does not replace extras/snapshots.
- Settings copy in `src/features/settings/components/WorkshopSettings.tsx` must say production start, not quote approval.
- Tests must prove changing to `aprobado` creates no stock movements.

## UI flow

### Entry points

Production start can be triggered from:

- `src/features/quotes/components/QuoteList.tsx` list status selector.
- Quote pipeline drag/drop.
- `src/features/quotes/components/QuoteForm.tsx` status selector when editing an approved quote.

All entry points should route `aprobado -> en_produccion` through one shared component/hook, not direct `updateQuote()`.

### Review/confirmation modal

Add `ProductionStartReviewDialog` under `src/features/quotes/components/`.

Flow:

1. User selects/drops quote into `en_produccion`.
2. UI calls preview RPC and opens dialog.
3. Dialog shows:
   - quote number/name;
   - setting state: automatic deduction on/off;
   - material table: material, required quantity, current stock, projected stock;
   - strong shortage banner for projected negative stock;
   - strong incomplete-snapshot banner for unresolved/skipped lines;
   - existing batch/result state if already deducted;
   - all-or-nothing confirmation copy.
4. If automatic mode is on, primary action is `Confirmar e iniciar producción`; it calls `start_quote_production(..., p_confirm_deduction = true, request_id)`.
5. If automatic mode is off, primary action is `Iniciar producción sin descontar stock`; it calls `start_quote_production(..., p_confirm_deduction = false, request_id)` and creates no movements.
6. Success state/toast shows status update plus movement count, skipped incomplete lines, and warning count. It should link to inventory movements filtered by quote/reason if routing supports it; otherwise link to `/inventory/movements`.
7. Cancel leaves quote status unchanged.

### Result visibility

- Quote list/detail should show a compact production deduction state when available: `Stock descontado`, `Sin descuento automático`, `Advertencias`, or `Revertido`.
- First scope does not add dashboard widgets.

## Ledger, detail, CSV, and reporting

Update inventory surfaces:

- `stock_movement_reason` labels: add `consumo_produccion = "Consumo producción"`.
- `get_stock_movement_ledger` return columns: `production_deduction_id`, `is_production_deduction boolean`, `production_deduction_status`, and existing `quote_id`/`quote_number`.
- `get_stock_movement_detail` return the same production fields and, for production-origin rows, a message/CTA to reverse the whole batch.
- `StockMovementLedgerTable` should display a production indicator and quote reference for production-origin rows.
- `src/features/inventory/lib/stockMovementCsv.ts` should add columns: `origen_produccion`, `presupuesto`, `production_deduction_id`.
- Inventory/admin reports that aggregate movements must include/filter `consumo_produccion` distinctly from generic `consumo` and legacy `descuento_presupuesto`.

## TypeScript and React design constraints

- Use const objects plus extracted types for new string states (`PRODUCTION_DEDUCTION_STATUS`, `BOM_CALCULATION_METHOD`); avoid direct union types in new code.
- Keep interfaces flat; split nested preview/result shapes into named interfaces.
- Do not use `any`; use generated Supabase types, `unknown` with guards, or explicit interfaces.
- React components use named exports and named React imports. Do not add manual `useMemo`/`useCallback` unless an existing component already requires it for a library contract.
- Respect feature boundaries: quotes feature owns production-start command/UI; inventory feature owns ledger/detail/export/reversal display; shared code only for generic utilities/types.

## Work-unit / chained PR strategy

This change is larger than the 400 changed-line review budget. Use chained PRs; each PR carries its own tests.

1. **PR 1 — stop approval deduction and fix safe status foundations**
   - Remove `maybeAutoDiscountStock` call.
   - Update settings copy.
   - Add status-only quote update helper so status changes no longer delete snapshots/extras.
   - Tests: approval no longer creates movements; status-only update preserves snapshots.
   - Rollback: restore old hook call/copy if needed; no irreversible schema.

2. **PR 2 — approved BOM schema and capture**
   - Add `quote_approved_bom_lines` migration/RLS/types.
   - Capture on transition into `aprobado` after quote snapshots are saved.
   - Include plate/cut-piece final quantity/context and incomplete warnings.
   - Tests: template/cut-piece edits after approval do not change captured deduction; incomplete capture records warnings.
   - Rollback: table can be dropped before dependent PRs; data is derived from quote approval.

3. **PR 3 — production deduction batch/RPCs**
   - Add `quote_production_stock_deductions`, `production_deduction_id`, `consumo_produccion`.
   - Add preview/start RPCs with negative-stock allowance only in production path.
   - Add whole-batch reversal RPC or at minimum batch data and server contract if UI lands in PR 5.
   - Tests: strict manual RPC still rejects negative; production RPC allows confirmed negative; network retry/idempotency; whole-batch rollback on error.
   - Rollback: disable UI entry to RPC; enum value remains as legacy/unused if rollback cannot remove it safely.

4. **PR 4 — production-start UI**
   - Shared review dialog and hooks.
   - Wire QuoteList, pipeline, and QuoteForm `aprobado -> en_produccion` through preview/confirm.
   - Manual mode preview creates no movements.
   - Tests: enabled confirmation, disabled preview, cancel leaves status unchanged, warnings visible.
   - Rollback: route transition back to status-only helper, leaving schema dormant.

5. **PR 5 — ledger/export/reporting and reversal guidance**
   - Extend ledger/detail RPC returns and generated/manual database types.
   - Add labels, badges, CSV columns, quote/batch context, and batch reversal guidance/action.
   - Tests: ledger marks production rows; CSV includes production context; batch reversal creates compensating rows.
   - Rollback: hide batch reversal CTA and production badges; keep audit columns dormant.

## Verification strategy

### Database / RPC tests

Add migration-level assertions or pgTAP-style tests for:

- RLS isolation on new tables.
- `apply_stock_movement` still rejects manual negative stock.
- `start_quote_production` rejects cross-workshop quote access.
- Only `aprobado -> en_produccion` can create a batch.
- Unique quote batch prevents duplicate movements under retry/concurrency.
- `p_request_id` retry returns existing result.
- Confirmed production deduction can take material stock negative.
- Incomplete approved BOM lines are recorded in batch warnings and do not silently create bogus movements.
- Whole-batch reversal creates one compensating row per original movement and marks the batch reversed.

### Frontend tests

Use Vitest + Testing Library for:

- Settings copy says production start.
- Approval status update does not call stock movement RPC and preserves quote snapshots.
- Production-start dialog shows material preview in both automatic and manual modes.
- Shortage/incomplete warnings are visible and strong.
- Automatic mode requires confirmation and shows movement result.
- Manual mode starts production without movements.
- Ledger/detail/CSV show `consumo_produccion`, quote reference, and production batch context.

### Manual checklist

- Approve a quote, edit its source template, start production: deduction remains from approved BOM.
- Start production with stock shortage: warning appears, confirmation succeeds, material stock becomes negative, movement is reversible.
- Retry production start after a simulated network failure: no duplicate rows.
- Disable automatic deduction: preview appears, status changes, no stock movements.
- Reverse a production batch: all original movement rows remain unchanged and compensating rows appear.

## Rollback plan

- Feature-level rollback: hide/disable the production-start dialog and use the status-only update helper for `aprobado -> en_produccion`; no automatic production movements occur.
- Data rollback: new tables are append-only/dormant if UI/RPCs are disabled. Do not delete audit rows after production data exists.
- Enum rollback: `ALTER TYPE ... ADD VALUE 'consumo_produccion'` is not safely reversible in all Postgres versions; treat it like existing `reversion` rollback guidance and leave the value unused or rename to an unused legacy value if absolutely necessary.
- Movement rollback: never edit/delete original `stock_movements`; use batch reversal for operational correction.
- Setting rollback: copy can be reverted independently, but approval-time deduction code should not be restored unless product explicitly reverses the decision.

## Residual risks

- Capturing plate/cut-piece context depends on source data still being reachable at approval time; if current quote snapshots cannot identify the needed cut-piece rows, first implementation must record incomplete BOM warnings rather than guessing.
- Existing quote editing allows status changes in multiple places; all production-start entry points must be audited to avoid bypassing the dialog/RPC.
- `jsonb` audit context is intentionally flexible; keep user-facing logic based on typed columns, not JSON parsing.
- Batch reversal may be larger than one PR if existing reversal UI is movement-centric; if needed, ship server batch reversal first and UI guidance/action in the reporting PR.
