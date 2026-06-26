# Delta for Inventory

## ADDED Requirements

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

The system MUST link every reversal row to its original movement so the correction is fully auditable. The reversal row MUST reference the original `stock_movements.id`, carry a reversal reason or reason variant, and preserve the original reason in audit context.

#### Scenario: Reversal row references the original movement

- GIVEN an authorized user reverses a stock movement
- WHEN the reversal row is inserted
- THEN the reversal row contains a non-null reference to the original movement
- AND the reversal reason distinguishes it as a correction

### Requirement: Stock Totals Impacted via Compensating Delta

The system MUST compute the reversal's compensating delta as the arithmetic inverse of the original movement's delta. The system MUST apply that compensating delta to the material's current stock through the trusted server-side movement path. The resulting stock MUST NOT become negative.

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

- GIVEN an original stock movement row with `delta = +5`, `reason = 'ajuste_manual'`, and `note = 'Entrega parcial'`
- WHEN the movement is reversed
- THEN the original row still has `delta = +5`, `reason = 'ajuste_manual'`, and `note = 'Entrega parcial'`
- AND only a new reversal row reflects the correction

### Requirement: Role-gated Reversal Authorization

The system MUST restrict reversal initiation to users whose role is operational or admin within the workshop. The authorization check MUST be enforced server-side in the reversal command or RPC and MUST NOT rely solely on UI hiding. The system MUST reject reversal requests from unauthorized users with a permission error.

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

The system MUST enforce that reversal detail, history, and reversal actions are scoped to the user's current workshop. The reversal RPC MUST derive the workshop from `auth.uid() -> profiles.workshop_id`, reject cross-workshop material or movement access, and raise `42501` or an equivalent tenant-access error. RLS policies on `stock_movements` MUST continue to scope reads and inserts by workshop.

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

The system MUST provide a dedicated stock movement detail surface that is reachable from the workshop-wide ledger. The detail surface MUST display the movement context, related movement history, and a reversal action available only to authorized users when the movement is eligible for reversal. The reversal action MUST require confirmation and a reason before submission.

#### Scenario: Authorized user sees reversal action in detail

- GIVEN an authenticated admin user opens the detail of an eligible, unreversed movement
- THEN the detail surface shows movement context and related history
- AND a reversal action is visible and enabled

#### Scenario: Unauthorized user does not see reversal action

- GIVEN an authenticated non-admin user opens the detail of an eligible, unreversed movement
- THEN the detail surface shows movement context and history
- AND no reversal action is exposed

#### Scenario: Reversal requires confirmation and reason

- GIVEN an authorized user initiates a reversal from the detail surface
- WHEN the confirmation prompt appears
- THEN the user MUST provide a reversal reason
- AND the system MUST create the reversal row only after confirmation

### Requirement: Ledger, Reporting, and CSV Presentation of Reversals

The system MUST display reversal rows distinctly from original rows in the workshop-wide ledger and per-material history. The CSV export MUST include a reversal indicator and, when applicable, the identifier of the original movement. Aggregate stock totals and ledger summaries MUST account for reversal semantics and MUST NOT double-count original and compensating movements.

#### Scenario: Ledger distinguishes reversal rows

- GIVEN a reversed movement exists in the workshop ledger
- WHEN the ledger is rendered
- THEN reversal rows are visually or textually marked as corrections
- AND linked to their original movements

#### Scenario: CSV export includes reversal linkage

- GIVEN a reversed movement exists
- WHEN the user exports the filtered ledger to CSV
- THEN the CSV includes a column or flag indicating the row is a reversal
- AND includes the original movement identifier when the row is a reversal

#### Scenario: Stock total remains consistent after reversal

- GIVEN a material with an original movement and its reversal
- WHEN the current stock is computed
- THEN the net effect equals the state before the original movement was applied

## MODIFIED Requirements

### Requirement: Deferred Scope

Reversal/compensating-entry workflows are now permitted only as append-only reversals that preserve the original `stock_movements` row. Dashboard recent-movements widgets and settings UI wiring for `workshop_settings.auto_stock_discount` and `workshop_settings.stock_alert_enabled` remain explicitly out of scope for this canonical spec. In-place editing of historical movement quantity, item, reason, notes, timestamps, or other metadata remains forbidden.

(Previously: all reversal/compensating-entry workflows were deferred; the new scope allows append-only reversals while still forbidding in-place mutation.)

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
