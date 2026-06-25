# Editable Stock Movement Ledger

Enable authorized workshop users to correct stock movement mistakes through auditable append-only reversals, while preserving the existing immutable stock movement audit trail.

## Problem

Inventory stock movements are currently treated as immutable audit rows. That protects traceability, but it leaves operations without a sanctioned way to correct an erroneous historical movement. Prior inventory-ledger work explicitly deferred reversal/cancellation/compensating-entry workflows and historical note/reason editing, so teams need a separate change that defines how corrections work without weakening audit guarantees.

## Goal

Provide a role-gated correction workflow where authorized operational/admin users can open a dedicated movement detail surface, review the movement history, and create an append-only reversal or compensating movement instead of mutating the original row.

## Scope

- Define stock movement reversal as an append-only ledger operation.
- Preserve the original stock movement row and its original audit fields.
- Require authorization for reversal actions, limited to operational/admin workshop users.
- Maintain tenant isolation for movement detail, history, and reversal operations.
- Add a dedicated movement detail view/panel/page that shows movement context, related history, and a reversal action.
- Ensure reporting and CSV exports can represent original and reversal/compensating movements clearly.
- Update the future spec so canonical immutable/deferred requirements allow append-only reversals, while still forbidding in-place mutation.

## Non-goals

- No in-place editing of historical movement quantity, item, reason, notes, timestamps, or other metadata.
- No general free-form ledger rewrite or delete workflow.
- No inline-only per-row reversal UX as the primary surface.
- No broad redesign of inventory reporting beyond making reversal entries understandable and consistent.
- No implementation-level SQL/API/UI design in this proposal; that belongs in the design phase.

## Business rules

- **Append-only reversal:** corrections must create a new stock movement or reversal record that offsets the original effect.
- **Original preservation:** the original stock movement row remains unchanged and visible for audit.
- **Authorization:** only role-gated operational/admin workshop users may initiate reversals.
- **Tenant isolation:** users may only view or reverse movements within their own workshop; RLS and API checks must preserve this invariant.
- **Dedicated detail UI:** reversal must be initiated from a movement detail surface that exposes enough context and history to reduce accidental corrections.
- **Traceability:** reversal entries must be linked or otherwise traceable to the original movement.
- **Spec alignment:** the implementation spec must MODIFY the canonical inventory requirements that currently describe `stock_movements` as immutable/deferred-only, clarifying that append-only reversals are allowed and in-place mutation remains forbidden.

## Acceptance criteria

- Authorized users can access a dedicated stock movement detail surface with movement context and history.
- Authorized users can reverse an eligible movement without mutating the original movement row.
- Unauthorized users cannot perform reversal actions.
- Reversal data remains workshop-scoped and cannot cross tenant boundaries.
- Inventory stock totals remain consistent after reversal entries are applied.
- Reports/CSV exports distinguish original movements from reversal/compensating entries enough for audit and reconciliation.
- The future OpenSpec spec changes explicitly modify the immutable/deferred stock movement requirements to permit append-only reversal workflows only.

## Affected areas

- Inventory stock movement domain model and canonical OpenSpec requirements.
- Supabase/RLS authorization model for movement reversal operations.
- Inventory API layer for movement detail/history/reversal commands.
- Inventory UI for the dedicated movement detail surface.
- Reporting and CSV export presentation for reversal/compensating entries.

## Risks and implications

- **Audit trail risk:** unclear reversal linkage could make corrections harder to audit than the original immutable ledger.
- **RLS/permission risk:** reversal authorization must be enforced server-side and not only hidden in the UI.
- **Reporting/CSV impact:** exports and summaries may double-count unless they understand reversal semantics.
- **Stock consistency risk:** reversal entries must offset inventory totals predictably, including partial or already-compensated cases if allowed later.
- **Dirty carryover risk:** the working tree already contains uncommitted prior inventory-ledger work; later phases must avoid accidentally absorbing unrelated changes.

## Rollback

If the change is implemented and must be backed out, disable the reversal action and dedicated reversal entry point first. Existing original movement rows remain intact because the workflow is append-only. Any created reversal/compensating entries should remain visible as audit history unless a later approved data correction plan explicitly handles them.

## Success criteria

- Operational/admin users have a safe, understandable correction path for erroneous stock movements.
- The ledger remains append-only and auditable.
- Tenant and role boundaries remain enforceable at the data/API layer.
- Stock totals, reports, and exports stay reconcilable after reversals.
- The canonical spec clearly distinguishes allowed append-only reversals from forbidden in-place edits.

## Proposal question round

The interactive proposal round was effectively pre-answered by the provided product decisions:

- Reversals are append-only and auditable, not mutations.
- Only authorized operational/admin workshop users may reverse movements.
- In-place metadata edits are out of scope.
- The primary UX is a dedicated movement detail surface with history and reversal action.

Open product questions for the design phase may include reversal eligibility rules, required reversal reason fields, whether partial reversals are allowed, and how reversal entries should appear in aggregate reports.
