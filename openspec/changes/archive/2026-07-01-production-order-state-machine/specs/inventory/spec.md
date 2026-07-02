# Delta for Inventory

## MODIFIED Requirements

### Requirement: Stock Movements Table

The system MUST provide a `stock_movements` table with columns: `id
uuid PK`, `workshop_id uuid NOT NULL`, `material_id uuid NOT NULL
REFERENCES materials(id) ON DELETE CASCADE`, `delta NUMERIC(12,2) NOT
NULL CHECK (delta <> 0)`, `reason stock_movement_reason NOT NULL`,
`note text`, `quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL`,
`production_deduction_id uuid REFERENCES
quote_production_stock_deductions(id) ON DELETE SET NULL`, and
reversal audit columns `reversal_of_movement_id uuid`,
`reversal_reason text`, `reversed_original_reason stock_movement_reason`,
`reversal_request_id uuid`, and the `created_at` / `created_by` audit
columns. The `stock_movement_reason` enum MUST include
`consumo_produccion` for production-start deductions and MUST retain
`descuento_presupuesto` as a legacy value for historical rows. The
table MUST have indexes on `(material_id, created_at DESC)`, `(workshop_id,
created_at DESC)`, `(workshop_id, production_deduction_id)` where not
null, and reversal lookup/idempotency indexes. RLS MUST be enabled
with all four policies (S/I/U/D) scoped by
`get_current_workshop_id()`.

(Previously: production-origin movement linkage existed only via
`production_deduction_id`; this change keeps that linkage and
introduces an additional nullable production-order reference on the
deduction batch — see Requirement: Production-Deduction Order
Linkage. The new linkage is at the deduction-batch level, not the
movement level, because the deduction is the right granularity for
"which production order caused this set of movements".)

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

### Requirement: New-Flow Persistence of Production-Order Link

The system MUST update `quote_production_stock_deductions` to write
the link during the new `start_production_order` and
`transition_production_order_state` flows so the deduction can be
traced from inventory surfaces back to the order that produced it.

#### Scenario: Start production order writes the link

- GIVEN an approved quote and a production start confirmed by the
  user
- WHEN `start_production_order` runs the deduction transaction
- THEN the resulting `quote_production_stock_deductions` row has its
  `production_order_id` set to the new order's id

#### Scenario: Transition does not overwrite the link

- GIVEN a deduction already linked to a production order
- WHEN a `transition_production_order_state` runs against the same
  order
- THEN the existing `production_order_id` is preserved (not
  nulled, not changed)

#### Scenario: Idempotent start does not duplicate the link

- GIVEN a quote already has a deduction batch linked to a production
  order
- WHEN the start flow runs again with the same `p_request_id`
- THEN the RPC returns the existing batch and does not create a
  second link row

### Requirement: Cross-Workshop Safety on INSERT and UPDATE

The system MUST refuse any INSERT or UPDATE that would set
`quote_production_stock_deductions.production_order_id` to a
production order in a different workshop, whether the write comes
from the service role, a SECURITY DEFINER RPC, or any other path.

#### Scenario: Service role cannot set cross-workshop link

- GIVEN a deduction in workshop A and a production order in workshop
  B
- WHEN the service role attempts `UPDATE production_order_id` to the
  workshop B order id
- THEN the same-workshop trigger raises 23514

#### Scenario: Partial index supports the inventory join

- GIVEN the migration creates a partial index
  `idx_qpsd_production_order` on `(workshop_id, production_order_id)
  WHERE production_order_id IS NOT NULL`
- WHEN inventory surfaces filter deductions by production order
- THEN the index covers the filter and the query plan uses it

### Requirement: Legacy `start_quote_production` Preserves Null

The system MUST keep the legacy
`start_quote_stock_deduction_id` writer path functional for the
duration of the deprecation window. When the legacy
`start_quote_production` RPC is used (and no production order flow
exists yet for that quote), the resulting deduction batch MUST keep
`production_order_id = NULL`. The new flow's link write MUST NOT
affect the legacy writer.

#### Scenario: Legacy writer keeps null

- GIVEN a quote with no production order
- WHEN the legacy `start_quote_production` runs
- THEN the deduction batch is created with
  `production_order_id = NULL`

#### Scenario: Legacy writer does not break under new schema

- GIVEN the new `production_order_id` column exists
- WHEN the legacy writer is exercised
- THEN the writer succeeds and the column stays null

## ADDED Requirements

### Requirement: Inventory Deep-Link Surface (PR 7, deferred)

The system MUST provide an inventory deep-link surface that, given a
production-origin movement row, navigates the user to the production
order detail page. This requirement is added to the canonical spec
to mark the contract, but is NOT verified by the current PR 1-6
scope. PR 7 will implement and verify it.

#### Scenario: Deep-link is exposed for production-origin movements

- GIVEN a movement row with `production_deduction_id` set and that
  deduction has a non-null `production_order_id`
- WHEN the inventory detail surface renders
- THEN a "Ver orden de producción" link is visible

#### Scenario: Deep-link is hidden for non-production movements

- GIVEN a movement row with `reason != 'consumo_produccion'`
- WHEN the inventory detail surface renders
- THEN no production-order deep-link is shown
