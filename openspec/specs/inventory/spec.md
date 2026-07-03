# Inventory — Canonical Spec

> This spec is the authoritative canonical record for the **inventory** feature domain. It covers material management, stock movements, pricing history, and the workshop-wide movement ledger. It is maintained as requirements are added, modified, or removed by SDD changes.

## Domain: Material Management

### Purpose

Manage workshop materials: create, update, delete, track stock levels and minimum thresholds, and record price history. Every material belongs to exactly one workshop via `workshop_id uuid NOT NULL`. RLS is enabled on the `materials` table.

### Requirements

### Requirement: Materials Table

The system MUST provide a `materials` table with columns: `id uuid PK`, `workshop_id uuid NOT NULL REFERENCES workshops(id)`, `name text NOT NULL`, `category text NOT NULL`, `unit unit_of_measure NOT NULL`, `price_per_unit NUMERIC`, `stock NUMERIC NOT NULL DEFAULT 0`, `min_stock NUMERIC`, `updated_at timestamptz`, `created_at timestamptz`. RLS MUST be enabled with policies scoped by `get_current_workshop_id()`. Every material MUST include `workshop_id uuid NOT NULL`.

#### Scenario: Stock adjustment updates the value

- GIVEN a material with `stock = 10` and `price_per_unit = 5`
- WHEN stock is adjusted by `+3`
- THEN the material's `stock` becomes `13` and `updated_at` is set to `now()`

### Requirement: Per-material Price History

The system MUST provide a way to record and query historical prices for a material. The price history MUST be workshop-scoped via RLS and MUST NOT expose data from other workshops.

#### Scenario: Price history is workshop-scoped

- GIVEN workshop A and workshop B each have materials
- WHEN price history for a material in workshop A is queried
- THEN no price data from workshop B is returned

## Domain: Stock Movements

### Purpose

Record every stock change (purchase, consumption, shrinkage, adjustment, quote discount) as an immutable audit row in `stock_movements`, derive the current stock from `materials.stock`, and provide both per-material history and a workshop-wide ledger with filtering and export. All stock mutations flow through the trusted `apply_stock_movement` RPC which enforces tenant isolation and records the creator.

### Requirements

### Requirement: Stock Movements Table

The system MUST provide a `stock_movements` table with columns: `id uuid PK`, `workshop_id uuid NOT NULL`, `material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE`, `delta NUMERIC(12,2) NOT NULL CHECK (delta <> 0)`, `reason stock_movement_reason NOT NULL`, `note text`, `quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL`, `production_deduction_id uuid REFERENCES quote_production_stock_deductions(id) ON DELETE SET NULL`, and reversal audit columns `reversal_of_movement_id uuid`, `reversal_reason text`, `reversed_original_reason stock_movement_reason`, `reversal_request_id uuid`, and the `created_at` / `created_by` audit columns. The `stock_movement_reason` enum MUST include `consumo_produccion` for production-start deductions and MUST retain `descuento_presupuesto` as a legacy value for historical rows. The table MUST have indexes on `(material_id, created_at DESC)`, `(workshop_id, created_at DESC)`, `(workshop_id, production_deduction_id)` where not null, and reversal lookup/idempotency indexes. RLS MUST be enabled with all four policies (S/I/U/D) scoped by `get_current_workshop_id()`.

(Previously: production-origin movement linkage existed only via `production_deduction_id`; this change keeps that linkage and introduces an additional nullable production-order reference on the deduction batch — see Requirement: Production-Deduction Order Linkage. The new linkage is at the deduction-batch level, not the movement level, because the deduction is the right granularity for "which production order caused this set of movements".)

#### Scenario: Movement carries production_deduction_id

- GIVEN a production-start deduction creates movements
- WHEN a movement row is inserted
- THEN `production_deduction_id` references the producing
  `quote_production_stock_deductions` row

### Requirement: Production-Deduction Order Linkage

The system MUST expose a nullable
`quote_production_stock_deductions.production_order_id uuid NULL
REFERENCES production_orders(id) ON DELETE SET NULL` column. The
column MUST be nullable so a deduction created before its
corresponding production order is linked (or before the production
order concept existed) remains valid. A SQL trigger MUST enforce
that when `production_order_id` is non-null, the referenced
production order belongs to the same workshop as the deduction
batch; a mismatch MUST raise 23514. The system MUST enforce an
`ON DELETE SET NULL` semantic: deleting a `production_orders` row
MUST NOT cascade-delete the deduction batch, only null the link.

#### Scenario: Nullable link allows legacy deductions

- GIVEN a `quote_production_stock_deductions` row created before
  production orders existed
- WHEN the new column is added
- THEN existing rows keep `production_order_id = NULL` without
  constraint violations

#### Scenario: Same-workshop check rejects mismatch

- GIVEN a deduction batch in workshop A
- WHEN the system attempts to UPDATE
  `production_order_id` to a `production_orders.id` belonging to
  workshop B
- THEN the trigger raises 23514 and the update is rejected

#### Scenario: ON DELETE SET NULL preserves the batch

- GIVEN a deduction batch with `production_order_id` set
- WHEN the referenced production order is deleted
- THEN the deduction batch remains and `production_order_id` becomes
  NULL (no cascade delete)

### Requirement: Apply Stock Movement RPC

The system MUST provide `apply_stock_movement(p_material_id, p_delta, p_reason, p_note, p_quote_id) RETURNS NUMERIC` as a `SECURITY INVOKER` function that atomically updates `materials.stock`, rejects `delta = 0`, raises `42501` on cross-workshop material access, rejects negative resulting stock, inserts an `stock_movements` row, and sets `created_by = auth.uid()` for every new movement.

#### Scenario: Manual adjustment records creator

- GIVEN an authenticated user creates a manual stock adjustment
- WHEN the system invokes `apply_stock_movement`
- THEN the new `stock_movements` row has `created_by` equal to the authenticated user's UUID

#### Scenario: Approval does not invoke stock movement RPC

- GIVEN a quote transitions to `aprobado`
- WHEN the system processes the status change
- THEN `apply_stock_movement` is NOT called
- AND no stock movement is created for the approval transition

#### Scenario: Cross-workshop mutation is rejected

- GIVEN an authenticated user belongs to workshop A
- WHEN `apply_stock_movement` is invoked for a material belonging to workshop B
- THEN the function raises a tenant-access error and no movement row is inserted

#### Scenario: Historical rows remain null

- GIVEN existing `stock_movements` rows with `created_by = null`
- WHEN `apply_stock_movement` is used for new movements
- THEN those historical rows keep `created_by = null`

### Requirement: Per-material Stock History Dialog

The system MUST provide a per-material stock history dialog that shows movements for a single material, scoped to the current workshop via RLS. The dialog MUST show delta, reason label, note, and timestamp. It MUST NOT show movements from other workshops.

#### Scenario: Per-material history shows only that material's movements

- GIVEN a material with stock movements
- WHEN the user opens the stock history dialog
- THEN the dialog shows movements for that material only

### Requirement: Workshop-wide Stock Movement Ledger

The system MUST provide a workshop-scoped ledger page at `/inventory/movements` that lists stock movements across all materials in the current workshop. Each row MUST display: material, signed delta, reason label, note, quote reference when available, creation timestamp, and creator name when available (or "Sin registrar" when `created_by` is null). Ledger rows MUST link to the dedicated movement detail surface. The ledger MUST be reachable from the inventory area and MUST use Spanish UI copy.

#### Scenario: Open the ledger from the inventory area

- GIVEN an authenticated user in a workshop with stock movements
- WHEN the user navigates to `/inventory/movements`
- THEN the ledger displays rows scoped to the current workshop

#### Scenario: Ledger shows creator or "Sin registrar"

- GIVEN a new movement row with `created_by` set
- WHEN the row appears in the ledger
- THEN the ledger shows the creator's display name
- AND given a historical row with `created_by = null`
- WHEN it appears in the ledger
- THEN the ledger shows "Sin registrar"

### Requirement: Server-side Filtering and Bounded Retrieval

The system MUST support server-side filtering of the workshop-wide ledger by reason, material search, date range, and creator when available. The `get_stock_movement_ledger` RPC MUST enforce a limit clamped to `[1, 500]`, offset clamped to `>= 0`, and derive the current workshop from `auth.uid() -> profiles.workshop_id`. Filters MUST be applied server-side; the client MUST NOT filter across unbounded tenant data.

#### Scenario: Tenant isolation under filters

- GIVEN two workshops each with stock movements
- WHEN an authenticated user of workshop A applies a filter that would match movements in workshop B
- THEN the result contains only workshop A movements

#### Scenario: Date range filter is inclusive

- GIVEN a movement created on `2026-06-25`
- WHEN the user selects "Hasta: 2026-06-25" in the UI
- THEN the ledger includes movements from that day

### Requirement: CSV Export for Filtered Ledger Results

The system MUST provide a CSV export action that downloads the currently filtered ledger results. The export MUST use the same RLS-safe, tenant-scoped query path. The CSV MUST include stable columns: timestamp, material, delta, reason (Spanish label), note, quote reference, creator, reversal indicator, original movement id when applicable, reversal reason, and reversed-by movement id when applicable. The CSV MUST contain only data the authenticated user is allowed to see. The export limit MUST be capped at 500 rows.

#### Scenario: Export respects tenant boundaries

- GIVEN a user with access only to workshop A
- WHEN the user exports the ledger
- THEN the CSV contains no rows from workshop B

### Requirement: Query-Key Cache Privacy

All `stock_movements` query-key families (per-material, workshop-wide ledger, and movement detail) MUST be non-persistable in the client-side cache, consistent with the cache-privacy policy for tenant-scoped inventory data.

#### Scenario: Ledger query key is non-persistable

- GIVEN a new query key is introduced for the workshop-wide ledger
- WHEN `cachePrivacy.test.ts` evaluates persistability
- THEN the key is classified as non-persistable

### Requirement: Inventory Public API Exports

The system MUST expose stock-movement hooks and API functions from `src/features/inventory/index.ts` for app-level or future cross-feature composition. The public API MUST include `useStockMovements`, `useApplyStockMovement`, `useStockMovementLedger`, `useStockMovementDetail`, `useReverseStockMovement`, `applyStockMovement`, `fetchStockMovements`, `fetchStockMovementLedger`, `fetchStockMovementDetail`, and `reverseStockMovement`. Cross-feature consumers MUST import through this seam and MUST NOT import from internal `hooks/*` or `api/*` paths.

#### Scenario: Public API exposes stock movement hooks

- GIVEN a consumer imports from `src/features/inventory/index.ts`
- WHEN the consumer imports stock movement hooks
- THEN the import resolves without crossing feature-internal paths

### Requirement: Append-only Reversal Eligibility and Idempotency

The system MUST provide a reversal workflow that creates a new compensating stock movement row. The system MUST allow reversal only of original stock movement rows that are eligible and have not already been reversed. The system MUST reject attempts to reverse the same original movement more than once.

#### Scenario: Eligible original movement can be reversed

- GIVEN an original stock movement row exists for a material in the current workshop
- AND the movement has not been reversed
- WHEN an authorized user initiates a reversal with a required reason
- THEN the system creates a compensating reversal row
- AND the original row remains unchanged

#### Scenario: Double reversal is rejected

- GIVEN an original stock movement has already been reversed
- WHEN an authorized user attempts to reverse it again
- THEN the system rejects the request
- AND no new reversal row is created

### Requirement: Reversal Row Linkage to Original Movement

The system MUST link every reversal row to its original movement so the correction is fully auditable. The reversal row MUST reference the original `stock_movements.id`, carry a reversal reason, and preserve the original reason in audit context.

#### Scenario: Reversal row references the original movement

- GIVEN an authorized user reverses a stock movement
- WHEN the reversal row is inserted
- THEN the reversal row contains a non-null reference to the original movement
- AND the reversal reason distinguishes it as a correction

### Requirement: Stock Totals Impacted via Compensating Delta

The system MUST compute the reversal's compensating delta as the arithmetic inverse of the original movement's delta. The system MUST apply that compensating delta to the material's current stock through the trusted server-side reversal RPC. The resulting stock MUST NOT become negative.

#### Scenario: Positive original movement is reversed

- GIVEN an original movement with `delta = +5` increased material stock from 10 to 15
- WHEN the movement is reversed
- THEN the reversal row has `delta = -5`
- AND the material stock returns to 10

#### Scenario: Negative original movement is reversed

- GIVEN an original movement with `delta = -3` decreased material stock from 10 to 7
- WHEN the movement is reversed
- THEN the reversal row has `delta = +3`
- AND the material stock returns to 10

#### Scenario: Reversal that would cause negative stock is rejected

- GIVEN a material with current stock of 2
- AND an original movement with `delta = +5` that was already applied
- WHEN a reversal is attempted
- THEN the system rejects the reversal
- AND no reversal row is inserted
- AND the material stock remains 2

### Requirement: Original Movement Preservation

The system MUST preserve every field of the original stock movement row after a reversal. No in-place update of `delta`, `material_id`, `reason`, `note`, `quote_id`, `created_at`, `created_by`, or any other column of the original row is permitted.

#### Scenario: Original row remains immutable after reversal

- GIVEN an original stock movement row with `delta = +5`, `reason = 'compra'`, and `note = 'Entrega parcial'`
- WHEN the movement is reversed
- THEN the original row still has `delta = +5`, `reason = 'compra'`, and `note = 'Entrega parcial'`
- AND only a new reversal row reflects the correction

### Requirement: Role-gated Reversal Authorization

The system MUST restrict reversal initiation to users whose workshop role is operational or admin. The authorization check MUST be enforced server-side in the reversal RPC and MUST NOT rely solely on UI hiding. The system MUST reject reversal requests from unauthorized users with a permission error.

#### Scenario: Admin user can reverse a movement

- GIVEN an authenticated user with an admin workshop role
- AND an eligible original movement in the same workshop
- WHEN the user initiates a reversal
- THEN the system creates the reversal row

#### Scenario: Non-admin user cannot reverse a movement

- GIVEN an authenticated user without an operational or admin workshop role
- AND an eligible original movement in the same workshop
- WHEN the user attempts to initiate a reversal
- THEN the system rejects the request with a permission error
- AND no reversal row is created

### Requirement: Tenant Isolation for Reversal Operations

The system MUST enforce that reversal detail, history, and reversal actions are scoped to the user's current workshop. The reversal RPC MUST derive the workshop from `auth.uid() -> profiles.workshop_id`, reject cross-workshop movement access, and raise `42501` or an equivalent tenant-access error. RLS policies on `stock_movements` MUST continue to scope reads and inserts by workshop.

#### Scenario: Cross-workshop reversal is rejected

- GIVEN an authenticated user belongs to workshop A
- WHEN the user attempts to reverse a movement belonging to workshop B
- THEN the function raises a tenant-access error
- AND no reversal row is inserted

#### Scenario: Movement detail only shows same-workshop context

- GIVEN a user belongs to workshop A
- WHEN the user opens the movement detail surface using a workshop B movement identifier
- THEN no movement data is returned
- AND the reversal action is unavailable

### Requirement: Dedicated Movement Detail UI for Reversal Review

The system MUST provide a dedicated stock movement detail surface that is reachable from the workshop-wide ledger. The detail surface MUST display the movement context, reversal linkage/history, immutable-audit copy, and a reversal action available only to authorized users when the movement is eligible for reversal. The reversal action MUST require a non-empty reason before submission.

#### Scenario: Authorized user sees reversal action in detail

- GIVEN an authenticated admin user opens the detail of an eligible, unreversed movement
- THEN the detail surface shows movement context and related reversal history
- AND a reversal action is visible and enabled

#### Scenario: Unauthorized user does not see reversal action

- GIVEN an authenticated non-admin user opens the detail of an eligible, unreversed movement
- THEN the detail surface shows movement context and history
- AND no reversal action is exposed

#### Scenario: Reversal requires reason

- GIVEN an authorized user initiates a reversal from the detail surface
- WHEN the user submits without a reason
- THEN the system rejects the submission
- AND no reversal row is created

### Requirement: Ledger, Reporting, and CSV Presentation of Reversals

The system MUST display reversal rows distinctly from original rows in the workshop-wide ledger and per-material history. The CSV export MUST include a reversal indicator and, when applicable, the identifier of the original movement. Aggregate stock totals and ledger summaries MUST account for reversal semantics and MUST NOT double-count original and compensating movements.

#### Scenario: Ledger distinguishes reversal rows

- GIVEN a reversed movement exists in the workshop ledger
- WHEN the ledger is rendered
- THEN reversal rows are textually marked as corrections
- AND linked to their original movements through the dedicated detail surface

#### Scenario: CSV export includes reversal linkage

- GIVEN a reversed movement exists
- WHEN the user exports the filtered ledger to CSV
- THEN the CSV includes a column or flag indicating the row is a reversal
- AND includes the original movement identifier when the row is a reversal

#### Scenario: Stock total remains consistent after reversal

- GIVEN a material with an original movement and its reversal
- WHEN the current stock is computed
- THEN the net effect equals the state before the original movement was applied

## Domain: Production-Start Stock Deduction

### Purpose

Automate material consumption when a quote enters production (`aprobado` → `en_produccion`) through a controlled, auditable, and reversible production-deduction batch. The deduction source is an immutable approved BOM captured at quote-approval time, not the currently editable recipe or template rows. All production-deduction movements are distinct from manual stock movements and are visible in the inventory ledger with quote context and batch reversal guidance.

### Requirements

### Requirement: Setting Semantics — Automatic Production-Start Deduction

The system MUST interpret `workshop_settings.auto_stock_discount` as automatic stock deduction when production starts, not when a quote is approved. User-facing copy MUST reflect this meaning (for example, "Descontar stock automáticamente al iniciar producción"). The system MUST read the setting value at production-start time and MUST NOT use it to deduct stock on quote approval.

#### Scenario: Enabled setting triggers production-start review

- GIVEN a workshop with `auto_stock_discount = true`
- WHEN a user starts production on an approved quote
- THEN the system presents a production-start review/confirmation flow before creating any stock movements

#### Scenario: Disabled setting allows manual production start

- GIVEN a workshop with `auto_stock_discount = false`
- WHEN a user starts production on an approved quote
- THEN no automatic stock movements are created
- AND the quote status can still become `en_produccion`

### Requirement: Production-Start Trigger

Automatic stock deduction MUST be attempted only when a quote transitions from `aprobado` to `en_produccion`. The system MUST verify that the quote's current status is `aprobado` and the target status is `en_produccion` before treating the transition as production start.

#### Scenario: Approved quote enters production

- GIVEN a quote with `status = 'aprobado'`
- AND the workshop has automatic production-start deduction enabled
- WHEN the user changes the quote status to `en_produccion`
- THEN the production deduction review flow runs

#### Scenario: Non-approved quote cannot trigger deduction

- GIVEN a quote with `status = 'presupuesto'`
- WHEN the user changes the quote status directly to `en_produccion`
- THEN the system does not treat this as production-start deduction
- AND no automatic stock movements are created for that transition

### Requirement: Approved BOM Snapshot Source of Truth

Production deduction quantities MUST be calculated from the approved BOM snapshot captured at quote-approval time. The system MUST NOT use the currently editable recipe or template rows as the source of truth for deduction. Changing a recipe or template after quote approval MUST NOT affect the stock deducted for that approved quote.

#### Scenario: Template change after approval does not alter deduction

- GIVEN an approved quote whose approved BOM requires 4 units of material X
- AND the workshop later edits the source recipe to require 6 units of material X
- WHEN production starts and automatic deduction is confirmed
- THEN the system deducts exactly 4 units of material X

#### Scenario: BOM is frozen at approval time

- GIVEN a quote is approved at time T1 and its approved BOM is captured
- WHEN the user starts production at time T2
- THEN deduction uses the approved BOM values from T1

### Requirement: Incomplete BOM Line Handling

If the approved BOM contains incomplete or unresolved lines (missing material, missing plate dimensions, invalid quantity), the system MUST show a strong warning and MUST allow production to start. Incomplete lines MUST NOT create stock movements. The incomplete state MUST be recorded in the production deduction batch audit context.

#### Scenario: Missing BOM line warns but allows start

- GIVEN an approved quote whose BOM lacks a required quantity for one material line
- WHEN the user starts production with automatic deduction enabled
- THEN the system shows a strong warning that deduction cannot be fully calculated
- AND allows the user to confirm production start
- AND records the incomplete state in the batch audit context
- AND no movement is created for the incomplete line

### Requirement: Insufficient Stock Warning and Controlled Negative Stock

If any required material has less stock than the deduction quantity, the system MUST show a strong shortage warning before production starts. The user MUST still be able to confirm production start, and the system MUST allow the resulting stock to become negative for the controlled production-deduction path. The generated stock movements MUST remain auditable and reversible.

#### Scenario: Shortage allows production start

- GIVEN material A has a stock of 3
- AND the approved BOM requires 8 units of material A
- WHEN the user confirms production start
- THEN the system shows a strong shortage warning
- AND creates a movement that reduces material A stock to -5

#### Scenario: Manual movement RPC remains strict

- GIVEN a user attempts a manual `consumo` movement through `apply_stock_movement`
- WHEN the resulting stock would be negative
- THEN the RPC rejects the movement

### Requirement: Idempotent Production Deduction

The system MUST ensure that production stock deduction for a given quote happens at most once. Retrying the transition, refreshing the page, or re-entering `en_produccion` MUST NOT create duplicate movements.

#### Scenario: Retry does not double deduct

- GIVEN a quote already has a production deduction batch
- WHEN the user retries the transition to `en_produccion`
- THEN the system recognizes the existing batch
- AND does not create new stock movements

#### Scenario: Network retry is safe

- GIVEN the first production-start request succeeds but the client does not receive the response
- WHEN the client retries the request with the same request_id
- THEN the idempotency check prevents duplicate movements

### Requirement: Production-Origin Movement Auditability

Production-start deductions MUST be recorded as append-only stock movements linked to the originating quote and production deduction batch. Each movement MUST have `reason = 'consumo_produccion'`, a non-null `production_deduction_id`, and a reference to the originating quote. Original movement rows MUST NOT be edited in place.

#### Scenario: Production movement links to quote and batch

- GIVEN automatic production-start deduction is confirmed
- WHEN the system creates stock movements
- THEN each movement has `reason = 'consumo_produccion'`
- AND references the originating quote
- AND belongs to a traceable production deduction batch

### Requirement: Ledger and Detail Visibility for Production Movements

Production-origin stock movements MUST be distinguishable in the inventory ledger and movement detail surface. They MUST display a production-origin indicator and the originating quote reference.

#### Scenario: Ledger marks production-origin rows

- GIVEN production stock movements exist for a quote
- WHEN a user views the workshop-wide ledger
- THEN production-origin rows show a production indicator and link to the originating quote

### Requirement: CSV Export Includes Production Context

The CSV export of the filtered ledger MUST include a production-origin indicator, the originating quote reference, and the production deduction batch identifier for each production-origin row.

#### Scenario: CSV export preserves production context

- GIVEN production stock movements exist
- WHEN the user exports the filtered ledger to CSV
- THEN the CSV includes production origin, quote reference, and production deduction batch columns

### Requirement: Batch Reversal Guidance and Whole-Batch Reversal

The system MUST guide users to reverse the whole quote production-deduction batch when correcting a production-start mistake. Reversal MUST create one compensating movement per original movement in the batch and MUST mark the batch as reversed. Individual movement reversal remains available for audit needs, but the primary correction path MUST target the batch.

#### Scenario: Reverse production deduction batch

- GIVEN a quote has a production deduction batch with multiple movements
- WHEN an authorized user reverses the batch
- THEN the system creates one compensating movement for each original movement in the batch
- AND the original movements remain unchanged
- AND the batch is marked as reversed

#### Scenario: Individual reversal is still available

- GIVEN a production-origin movement exists in the ledger
- WHEN an authorized user reverses it individually through the movement detail
- THEN a compensating movement is created for that movement only
- AND the production deduction batch status remains unchanged

### Requirement: Deferred Scope

Reversal/compensating-entry workflows are now permitted only as append-only reversals that preserve the original `stock_movements` row. Dashboard recent-movements widgets remain explicitly out of scope for this canonical spec. In-place editing of historical movement quantity, item, reason, notes, timestamps, or other metadata remains forbidden. `workshop_settings.auto_stock_discount` now has defined production-start semantics as documented above; the `stock_alert_enabled` toggle remains unwired and out of scope.

#### Scenario: Reversal is supported as an append-only correction

- GIVEN a movement row exists in the ledger
- WHEN an authorized user opens the movement detail
- THEN an append-only reversal action is available
- AND the original movement row is never modified

#### Scenario: In-place editing remains unsupported

- GIVEN a movement row exists in the ledger
- WHEN the user looks for an edit action on the movement's quantity, product, reason, note, or timestamp
- THEN no in-place edit action is available

#### Scenario: Dashboard widget is not added

- GIVEN the inventory area is open
- WHEN the user looks for a dashboard recent-movements widget
- THEN no such widget is added

#### Scenario: Settings toggles remain unwired

- GIVEN the workshop settings page is open
- WHEN the user looks for UI toggles for `auto_stock_discount` or `stock_alert_enabled`
- THEN those toggles are not wired as part of this change
