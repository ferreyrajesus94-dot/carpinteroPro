# Proposal: Production Stock Deduction Settings

## Status

Proposed.

## Summary

CarpinteroPro should move automatic stock consumption from quote approval to production start. A workshop can enable `auto_stock_discount`; when an approved quote enters `en_produccion`, the app shows a review/shortage warning and, after confirmation, creates auditable stock movements from the frozen approved quote snapshot. Workshops that disable the setting continue using manual inventory movements.

## Problem

Today the system already has an `auto_stock_discount` setting, but its behavior is not aligned with real workshop operations:

- It discounts stock when a quote becomes `aprobado`.
- It calculates consumption from the current recipe/template, not from a frozen approved quote snapshot.
- It can block on negative stock through the generic stock movement RPC.
- It does not provide a production-start review step with shortage warnings.

For a carpentry workshop, quote approval and production start are not the same event. Stock should be consumed when the shop actually starts producing, while still allowing manual stock workflows for teams that prefer them.

## Product decisions

| Topic | Decision |
| --- | --- |
| Setting | Reuse `workshop_settings.auto_stock_discount`, but change its meaning to production-start deduction. |
| Trigger | Deduct when an approved quote transitions from `aprobado` to `en_produccion`. |
| Manual mode | If the setting is off, production can start without automatic stock movements. |
| Calculation source | Use the approved/frozen quote snapshot or a newly defined approved BOM snapshot, not current editable recipe/template data. |
| Insufficient stock | Show a strong warning, but allow production to start and allow stock to go negative for this controlled path. |
| Confirmation | All-or-nothing review. The user can review the calculated deduction and shortages, then confirm the full deduction. No per-material exclusion or quantity editing in this SDD. |
| Manual-mode preview | When automatic deduction is off, still show a read-only expected-consumption/shortage preview before production start, but create no automatic movements. |
| Incomplete snapshot | Warn strongly and allow production start. Do not silently omit missing lines; surface that deduction cannot be fully calculated and preserve audit context. |
| Visibility | Show the immediate result to the production user and expose production deduction context in inventory/admin ledger, detail, and reports. Dashboard widgets are not required for the first scope. |
| Corrections | Guide users to reverse the whole quote production-deduction batch. Individual material movements remain auditable underneath; original movement rows are never edited in place. |
| Existing users | Current users/data are test-only, so preserving approval-time discount behavior is not a production compatibility requirement. |

## Goals

- Make `auto_stock_discount` match the real production workflow.
- Prevent stock from being deducted before production actually starts.
- Deduct from a stable approved quote material snapshot.
- Make stock shortages visible without blocking real-world operations.
- Preserve auditability through `stock_movements` and existing reversal flows.
- Make duplicate production deductions impossible.
- Surface production-origin stock movements clearly in ledger/detail/export/reporting UI.

## Non-goals

- Full production order management.
- In-place editing of historical stock movements.
- Per-material editing/exclusion in the production-start confirmation dialog.
- Purchasing/replenishment automation.
- External accounting integration.
- Rebuilding the quote/task workflow beyond the production-start transition needed here.

## Proposed behavior

### Settings

The existing Settings switch should be relabeled and redefined from approval-time copy to production-start copy.

Example user-facing meaning:

> Descontar stock automáticamente al iniciar producción.

When off:

- Quote status can still move to `en_produccion`.
- A read-only expected-consumption/shortage preview is still shown for operational awareness.
- No automatic stock movements are created.
- The workshop can use manual adjustments/movements.

When on:

- Moving an approved quote to `en_produccion` opens a confirmation/review flow.
- The review shows expected material consumption and shortage warnings.
- Confirming starts production and creates stock movements.

### Production start rule

Automatic deduction only applies when:

- the quote currently has status `aprobado`; and
- the target status is `en_produccion`; and
- `auto_stock_discount` is enabled; and
- the quote has not already had production stock deducted.

If those conditions are not met, the system must not create automatic stock movements.

### Snapshot rule

Production deduction must be based on approved/frozen quote material data. It must not read mutable recipe/template rows as the source of truth.

The spec/design phase must decide the exact technical contract:

- extend quote snapshots so they are sufficient for deduction; or
- introduce a dedicated approved BOM/production deduction snapshot; or
- formally constrain what can be deducted from existing snapshot fields.

The key acceptance criterion is semantic, not implementation-specific: changing a recipe/template after quote approval must not alter the stock deducted for that approved quote.

If the approved snapshot/BOM is incomplete, production start should still be allowed after a strong warning. The system must not silently pretend the deduction is complete; the limitation must be visible to the user and preserved in audit/review context.

### Shortage rule

If stock is insufficient:

- the confirmation UI must show a strong warning before production starts;
- production can still be started;
- the resulting stock may become negative for the affected materials;
- the generated stock movements must remain auditable and reversible.

This negative-stock allowance is scoped to the production deduction path. The spec/design phase must decide whether the generic manual movement RPC remains strict.

### Audit and reversal rule

Production deduction must create append-only stock movements linked to the quote. Corrections use the existing reversal model or a compatible append-only correction model.

The original production deduction movement must not be edited or deleted by normal authenticated users. Correction UX should prefer reversing the whole quote production-deduction batch so operators do not have to reason about isolated material movements when correcting a production-start mistake.

## Acceptance criteria

- [ ] Settings copy and behavior define `auto_stock_discount` as production-start deduction, not approval-time deduction.
- [ ] Moving from `aprobado` to `en_produccion` with the setting off shows a read-only consumption/shortage preview but creates no automatic stock movements.
- [ ] Moving from `aprobado` to `en_produccion` with the setting on shows an all-or-nothing material review before deduction.
- [ ] Insufficient stock is clearly warned but does not block production start.
- [ ] Incomplete approved snapshot/BOM data is clearly warned, does not silently omit audit context, and does not block production start.
- [ ] Confirming production start creates auditable quote-linked stock movements.
- [ ] Repeating or retrying the production-start action cannot deduct stock twice.
- [ ] Deduction is calculated from frozen approved quote material data, not current recipe/template rows.
- [ ] Production-origin movements are distinguishable in inventory/admin ledger/detail/export/reporting surfaces.
- [ ] Corrections are handled through append-only reversals/corrections, not in-place edits.
- [ ] Correction UX guides users to reverse the whole quote production-deduction batch.
- [ ] Tests cover setting behavior, status transition, insufficient stock warning, negative-stock allowance, idempotency, snapshot-source protection, and ledger/reporting visibility.
- [ ] Work is split into reviewable PRs if forecast exceeds the 400 changed-line budget.

## Risks and tradeoffs

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing approval-time discount code conflicts with new behavior | Double deduction or surprising behavior | Replace approval trigger with production trigger and add idempotency checks. |
| Existing snapshots may not be sufficient for all material calculations | Incorrect deduction for board/cut-piece cases | Make snapshot/BOM contract an explicit spec/design requirement before implementation. |
| Allowing negative stock changes inventory semantics | Stock can go below zero when reality and system differ | Limit negative allowance to confirmed production deduction and make warnings/audit clear. |
| No production-order entity exists | Quote status may carry too much meaning | Keep first version quote-based; defer full production orders unless spec proves they are required. |
| Complete operational scope is large | Reviewer overload and regression risk | Use chained PRs by behavior slice with tests in each slice. |

## Suggested delivery strategy

This should be planned as chained PRs unless the spec/design forecast proves otherwise.

1. **Setting and trigger cleanup**
   - Redefine `auto_stock_discount` UI/copy.
   - Remove approval-time deduction behavior.
   - Add tests proving approval no longer deducts.

2. **Approved BOM / snapshot contract**
   - Ensure production deduction can use frozen approved material data.
   - Add tests proving template changes after approval do not change deduction.

3. **Production deduction command**
   - Add idempotent server/API path for production-start deduction.
   - Support shortage warning plus allowed negative stock for this controlled path.

4. **Production-start confirmation UI**
   - All-or-nothing review modal/flow.
   - Only from `aprobado` to `en_produccion`.
   - Manual mode still works when the setting is off.

5. **Ledger/reporting/reversal guidance**
   - Mark production-origin movements.
   - Include context in ledger/detail/CSV.
   - Link correction guidance to existing reversal flow.

6. **Verification slice**
   - Full test suite.
   - Focused integration/E2E-style coverage for enabled, disabled, shortage, and retry/idempotency flows.

## Out of scope / deferred

- Production orders with separate lifecycle and assignment.
- Editable production consumption quantities.
- Partial material exclusion from the automatic deduction review.
- Automatic purchase orders for shortages.
- Advanced stock valuation/accounting.

## Next phase

Proceed to `spec`.

The spec should define exact requirements and scenarios for:

- setting semantics;
- allowed quote status transition;
- approved BOM/snapshot source;
- idempotent production deduction;
- insufficient-stock warning and negative stock allowance;
- ledger/detail/export visibility;
- reversal/correction behavior;
- test expectations and migration impact.
