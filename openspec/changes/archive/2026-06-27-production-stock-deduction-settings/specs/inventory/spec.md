# Delta for Inventory

## ADDED Requirements

### Requirement: Setting Semantics — Automatic Production-Start Deduction

The system MUST interpret `workshop_settings.auto_stock_discount` as automatic stock deduction when production starts, not when a quote is approved. User-facing copy MUST reflect this meaning (for example, "Descontar stock automáticamente al iniciar producción"). The system MUST read the setting value at production-start time and MUST NOT use it to deduct stock on quote approval.

#### Scenario: Enabled setting triggers production-start review

- GIVEN a workshop with `auto_stock_discount = true`
- WHEN a user starts production on an approved quote
- THEN the system presents a production-start review/confirmation flow before creating any stock movements.

#### Scenario: Disabled setting allows manual production start

- GIVEN a workshop with `auto_stock_discount = false`
- WHEN a user starts production on an approved quote
- THEN no automatic stock movements are created
- AND the quote status can still become `en_produccion`.

### Requirement: Production-Start Trigger

Automatic stock deduction MUST be attempted only when a quote transitions from `aprobado` to `en_produccion`. The system MUST verify that the quote's current status is `aprobado` and the target status is `en_produccion` before treating the transition as production start.

#### Scenario: Approved quote enters production

- GIVEN a quote with `status = 'aprobado'`
- AND the workshop has automatic production-start deduction enabled
- WHEN the user changes the quote status to `en_produccion`
- THEN the production deduction review flow runs.

#### Scenario: Non-approved quote cannot trigger deduction

- GIVEN a quote with `status = 'presupuesto'`
- WHEN the user changes the quote status directly to `en_produccion`
- THEN the system does not treat this as production-start deduction
- AND no automatic stock movements are created for that transition.

### Requirement: Manual-Mode Preview

When automatic production-start deduction is disabled, the system MUST still display a read-only preview of expected material consumption and stock shortages before the quote enters `en_produccion`. The preview MUST be computed from the approved/frozen quote material data and MUST NOT create any `stock_movements` rows.

#### Scenario: Preview without automatic deduction

- GIVEN a workshop with `auto_stock_discount = false`
- AND an approved quote whose snapshot requires 5 units of material A and 3 units of material B
- AND material A has only 2 units in stock
- WHEN the user starts production
- THEN the system shows expected consumption and a strong shortage warning for material A
- AND no `stock_movements` rows are inserted.

### Requirement: Approved BOM/Snapshot Source of Truth

Production deduction quantities MUST be calculated from the approved/frozen quote snapshot or a dedicated approved BOM snapshot. The system MUST NOT use the currently editable recipe or template rows as the source of truth for deduction. Changing a recipe or template after quote approval MUST NOT affect the stock deducted for that approved quote.

#### Scenario: Template change after approval does not alter deduction

- GIVEN an approved quote whose snapshot requires 4 units of material X
- AND the workshop later edits the source recipe to require 6 units of material X
- WHEN production starts and automatic deduction is confirmed
- THEN the system deducts exactly 4 units of material X.

#### Scenario: Snapshot is frozen at approval time

- GIVEN a quote is approved at time T1 with a captured material snapshot
- WHEN the user starts production at time T2
- THEN deduction uses the snapshot values from T1.

### Requirement: Incomplete Snapshot Warning

If the approved snapshot/BOM is incomplete or cannot be fully resolved for deduction, the system MUST show a strong warning and MUST allow production to start. The system MUST NOT silently omit missing lines or present the deduction as complete. The limitation MUST be recorded in the production audit context.

#### Scenario: Missing snapshot line warns but allows start

- GIVEN an approved quote whose snapshot lacks a required quantity for one material line
- WHEN the user starts production with automatic deduction enabled
- THEN the system shows a strong warning that deduction cannot be fully calculated
- AND allows the user to confirm production start
- AND records the incomplete state in the production audit context.

### Requirement: Insufficient Stock Warning and Controlled Negative Stock

If any required material has less stock than the deduction quantity, the system MUST show a strong shortage warning before production starts. The user MUST still be able to confirm production start, and the system MUST allow the resulting stock to become negative for the controlled production-deduction path. The generated stock movements MUST remain auditable and reversible.

#### Scenario: Shortage allows production start

- GIVEN material A has a stock of 3
- AND the approved snapshot requires 8 units of material A
- WHEN the user confirms production start
- THEN the system shows a strong shortage warning
- AND creates a movement that reduces material A stock to -5.

#### Scenario: Manual movement RPC remains strict

- GIVEN a user attempts a manual `consumo` movement through `apply_stock_movement`
- WHEN the resulting stock would be negative
- THEN the RPC rejects the movement.

### Requirement: Idempotent Production Deduction

The system MUST ensure that production stock deduction for a given quote happens at most once. Retrying the transition, refreshing the page, or re-entering `en_produccion` MUST NOT create duplicate movements.

#### Scenario: Retry does not double deduct

- GIVEN a quote already has production stock deducted
- WHEN the user retries the transition to `en_produccion`
- THEN the system recognizes the existing deduction
- AND does not create new stock movements.

#### Scenario: Network retry is safe

- GIVEN the first production-start request succeeds but the client does not receive the response
- WHEN the client retries the request
- THEN the idempotency check prevents duplicate movements.

### Requirement: Auditable Production-Context Movements

Production-start deductions MUST be recorded as append-only stock movements linked to the originating quote. The system MUST record enough context to identify the production deduction batch and distinguish production-origin movements from manual movements. Original movement rows MUST NOT be edited in place.

#### Scenario: Production movement links to quote and batch

- GIVEN automatic production-start deduction is confirmed
- WHEN the system creates stock movements
- THEN each movement has a reason identifying production consumption
- AND references the originating quote
- AND belongs to a traceable production deduction batch.

### Requirement: Ledger, Detail, Export, and Report Visibility

Production-origin stock movements MUST be distinguishable in the inventory/admin ledger, movement detail surface, CSV export, and inventory/admin reports. They MUST display the originating quote reference and a production-origin indicator.

#### Scenario: Ledger marks production-origin rows

- GIVEN production stock movements exist for a quote
- WHEN a user views `/inventory/movements`
- THEN production-origin rows show a production indicator and link to the originating quote.

#### Scenario: CSV export includes production context

- GIVEN production stock movements exist
- WHEN the user exports the filtered ledger
- THEN the CSV includes a production-origin indicator and quote reference for each relevant row.

### Requirement: Batch Reversal Guidance

The system MUST guide users to reverse the whole quote production-deduction batch when correcting a production-start mistake. Individual material movements MUST remain reversible through the existing append-only reversal flow, but the primary correction path MUST target the batch. Reversal MUST create compensating movements and MUST NOT edit original rows.

#### Scenario: Reverse production deduction batch

- GIVEN a quote has production stock deducted
- WHEN an authorized user chooses to reverse the production deduction
- THEN the system creates a compensating reversal movement for every original movement in the batch
- AND the original movements remain unchanged.

#### Scenario: Original production movement stays immutable

- GIVEN a production-origin movement exists
- WHEN a user attempts to edit its quantity, reason, or note in place
- THEN the system rejects the operation.

## MODIFIED Requirements

### Requirement: Apply Stock Movement RPC

The system MUST provide `apply_stock_movement(p_material_id, p_delta, p_reason, p_note, p_quote_id) RETURNS NUMERIC` as a `SECURITY INVOKER` function that atomically updates `materials.stock`, rejects `delta = 0`, raises `42501` on cross-workshop material access, rejects negative resulting stock, inserts a `stock_movements` row, and sets `created_by = auth.uid()` for every new movement.
(Previously: the requirement included a scenario describing automatic discount on quote approval; that behavior is removed and replaced by production-start deduction using a separate production-deduction path.)

#### Scenario: Manual adjustment records creator

- GIVEN an authenticated user creates a manual stock adjustment
- WHEN the system invokes `apply_stock_movement`
- THEN the new `stock_movements` row has `created_by` equal to the authenticated user's UUID.

#### Scenario: Cross-workshop mutation is rejected

- GIVEN an authenticated user belongs to workshop A
- WHEN `apply_stock_movement` is invoked for a material belonging to workshop B
- THEN the function raises a tenant-access error and no movement row is inserted.

#### Scenario: Historical rows remain null

- GIVEN existing `stock_movements` rows with `created_by = null`
- WHEN `apply_stock_movement` is used for new movements
- THEN those historical rows keep `created_by = null`.

### Requirement: Stock Movements Table

The system MUST provide a `stock_movements` table with columns: `id uuid PK`, `workshop_id uuid NOT NULL`, `material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE`, `delta NUMERIC(12,2) NOT NULL CHECK (delta <> 0)`, `reason stock_movement_reason NOT NULL`, `note text`, `quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `created_by uuid`, and reversal audit columns `reversal_of_movement_id uuid`, `reversal_reason text`, `reversed_original_reason stock_movement_reason`, and `reversal_request_id uuid`. The `stock_movement_reason` enum MUST include `consumo_produccion` for production-start deductions and MUST retain `descuento_presupuesto` as a legacy value for historical rows. The table MUST have indexes on `(material_id, created_at DESC)`, `(workshop_id, created_at DESC)`, and reversal lookup/idempotency indexes. RLS MUST be enabled with all four policies (S/I/U/D) scoped by `get_current_workshop_id()`.
(Previously: `descuento_presupuesto` was the only reason related to quote discount; this change introduces `consumo_produccion` for production-start consumption.)

#### Scenario: Production deduction uses new reason

- GIVEN automatic production-start deduction is confirmed
- WHEN a stock movement is inserted
- THEN its `reason` is `consumo_produccion`.

### Requirement: Deferred Scope

Reversal/compensating-entry workflows are permitted only as append-only reversals that preserve the original `stock_movements` row. Dashboard recent-movements widgets remain explicitly out of scope for this canonical spec. In-place editing of historical movement quantity, item, reason, notes, timestamps, or other metadata remains forbidden.
(Previously: this requirement also listed `workshop_settings.auto_stock_discount` and `workshop_settings.stock_alert_enabled` settings UI toggles as out of scope; `auto_stock_discount` is now in scope with defined production-start semantics.)

#### Scenario: Reversal is supported as an append-only correction

- GIVEN a movement row exists in the ledger
- WHEN an authorized user opens the movement detail
- THEN an append-only reversal action is available
- AND the original movement row is never modified.

#### Scenario: In-place editing remains unsupported

- GIVEN a movement row exists in the ledger
- WHEN the user looks for an edit action on the movement's quantity, product, reason, note, or timestamp
- THEN no in-place edit action is available.

#### Scenario: Dashboard widget is not added

- GIVEN the inventory area is open
- WHEN the user looks for a dashboard recent-movements widget
- THEN no such widget is added.

#### Scenario: Setting semantics are now defined

- GIVEN the inventory canonical spec previously deferred `auto_stock_discount` wiring
- WHEN this change is applied
- THEN the `auto_stock_discount` setting has defined production-start semantics.

## REMOVED Requirements

### Requirement: Approval-Time Quote Auto-Discount

The system MUST NOT automatically deduct stock when a quote becomes `aprobado`. Historical movements with `reason = 'descuento_presupuesto'` remain in the ledger as legacy audit records.
(Reason: The product workflow requires stock deduction at production start, not quote approval.)
(Migration: None required; current users and data are test-only, and historical `descuento_presupuesto` rows remain as legacy audit records.)

#### Scenario: Approving a quote no longer deducts stock

- GIVEN `auto_stock_discount` is enabled
- WHEN a user changes a quote status to `aprobado`
- THEN no automatic stock movement is created.

## Out-of-Scope Constraints

The following items are explicitly out of scope for this change:

- Full production-order management or a separate production-order entity.
- In-place editing of historical stock movements.
- Per-material exclusion or quantity editing in the production-start confirmation dialog.
- Automatic purchase orders or replenishment automation for shortages.
- External accounting integration.
- Dashboard widgets for production deduction.
- Changing the strict negative-stock behavior of the generic manual `apply_stock_movement` RPC.
- Rebuilding the quote/task workflow beyond the production-start transition needed here.
