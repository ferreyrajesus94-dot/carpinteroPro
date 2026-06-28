# Explore: Production Stock Deduction Settings

## Status

Exploration completed after recovering from an initial SDD explore timeout with a narrower read-only scout pass.

## Product intent

Workshops should be able to decide whether stock is deducted automatically when production starts.

Confirmed product decisions:

- If automatic deduction is enabled, deduction happens when a quote/project enters `en_produccion` / production started.
- If automatic deduction is disabled, users continue recording inventory movements manually.
- Insufficient stock should show a strong warning but still allow production to start.
- Consumption must be calculated from the approved/frozen quote snapshot, not from the currently editable recipe/template.
- Corrections must remain append-only through stock movements/reversals; original movement rows must never be edited in place.
- Desired scope is a complete operational slice, likely split into chained PRs.

## Current system map

### Quote and production status

The current production marker is the quote status enum:

```text
presupuesto -> enviado -> aprobado -> en_produccion -> entregado
                                            \-> cancelado
```

Relevant files:

- `supabase/migrations/0003_quotes.sql`
- `src/shared/types/quotes.ts`
- `src/features/quotes/components/QuoteStatusBadge.tsx`
- `src/features/quotes/components/QuoteList.tsx`
- `src/features/quotes/components/QuoteForm.tsx`
- `src/features/quotes/hooks/useQuotes.ts`

There is no separate production order entity. Production is represented mainly by `quotes.status = 'en_produccion'`. Tasks have only `pendiente` / `hecha`, with a `produccion` category, but they are not a production state machine.

### Existing automatic stock discount

There is already an automatic stock discount path:

- `src/features/quotes/api/stockDiscount.ts`
- `src/features/quotes/hooks/useQuotes.ts`

Current behavior:

- `maybeAutoDiscountStock(workshopId, quoteId, newStatus)` runs before `updateQuote`.
- It only runs when `newStatus === 'aprobado'`.
- It checks `workshop_settings.auto_stock_discount`.
- It prevents a repeated approval transition from discounting again.
- It creates `stock_movements` through `apply_stock_movement` with reason `descuento_presupuesto`.

Important mismatch with the new product intent:

- Current discount happens on `aprobado`, not `en_produccion`.
- Current calculation reads current recipe/template data, not the quote snapshot.
- The product wants deduction from the approved/frozen quote snapshot when production starts.

### Quote snapshots

Quote snapshots exist:

- `supabase/migrations/0012_quote_recipe_snapshots.sql`
- `src/features/quotes/api/quotes.ts` (`replaceSnapshots()`)

Tables:

- `quote_recipe_snapshots`
- `quote_labor_snapshots`

Useful fields include:

- `quote_id`
- `material_id`
- `material_name`
- `material_unit`
- `material_category`
- `quantity`
- `waste_pct`
- `price_per_unit`

Current gaps:

- Snapshots are replaced on quote update, so they are not a separate immutable approval snapshot.
- Plate/cut-piece dimensions are not snapshotted, so current nesting/cut calculations cannot always be reconstructed from snapshots alone.
- The existing automatic discount can use `cut_pieces` from current templates, but that violates the desired approved-snapshot rule.

### Inventory stock movements and reversals

Relevant files:

- `supabase/migrations/0007_stock_movements.sql`
- `supabase/migrations/20260624120000_*`
- `supabase/migrations/20260625183000_stock_movement_reversals.sql`
- `src/features/inventory/api/stockMovements.ts`
- `src/features/inventory/hooks/useStockMovements.ts`
- `src/features/inventory/components/StockMovementLedgerPage.tsx`
- `src/features/inventory/components/StockMovementDetailPage.tsx`
- `src/features/inventory/lib/stockMovementCsv.ts`

Existing primitives:

- `apply_stock_movement` atomically updates `materials.stock` and inserts a movement.
- `reverse_stock_movement` creates append-only compensating movements.
- `get_stock_movement_ledger` returns denormalized ledger data.
- `get_stock_movement_detail` exposes reversal linkage and `can_reverse`.

Current movement reasons include:

- `compra`
- `consumo`
- `merma`
- `ajuste`
- `descuento_presupuesto`
- `reversion`

The reversal/audit foundation is strong and should be reused.

### Workshop settings

Relevant files:

- `supabase/migrations/0003_quotes.sql`
- `supabase/migrations/0007_stock_movements.sql`
- `supabase/migrations/0011_stock_alert_toggle.sql`
- `src/shared/api/workshopSettings.ts`
- `src/shared/hooks/useWorkshopSettings.ts`
- `src/features/settings/api/workshopSettings.ts`
- `src/features/settings/hooks/useWorkshopSettings.ts`
- `src/features/settings/components/WorkshopSettings.tsx`

Existing fields:

- `workshop_settings.auto_stock_discount boolean default false`
- `workshop_settings.stock_alert_enabled boolean default false`

Current Settings UI already has switches for:

- automatic stock discount on quote approval
- stock alerts when opening furniture/recipes

However, the automatic discount copy/behavior is approval-based, not production-start-based.

## Key risks

1. **Approval discount vs production discount**
   The existing `auto_stock_discount` behavior may conflict with the desired trigger. The new SDD must decide whether to migrate the setting semantics, introduce a new setting, or support both with strong double-deduction guards.

2. **Double deduction**
   If any quote already received `descuento_presupuesto` movements on approval, moving to production must not deduct the same materials again.

3. **Snapshot insufficiency**
   Current snapshots may not contain enough data to reproduce plate/cut-piece consumption from the quote alone. The design must either extend snapshots before relying on them, constrain supported deduction math, or introduce an approval BOM snapshot.

4. **No production order entity**
   The simplest model is quote-based production deduction. A separate production-order table may be cleaner long-term but increases scope.

5. **Negative stock policy**
   The existing `apply_stock_movement` RPC raises on negative stock. The product decision is to warn but allow production. This likely requires a new RPC or a controlled option that allows production consumption to take stock below zero while preserving auditability.

6. **Review workload**
   Complete operational scope will likely exceed the 400 changed-line review budget and should be planned as chained PRs.

## Suggested scope for proposal

### In scope

- Define production-start stock deduction semantics.
- Decide whether `auto_stock_discount` changes meaning or whether a new setting is introduced.
- Use quote status transition to `en_produccion` as the trigger.
- Build a review/confirmation UI before starting production when deduction is enabled.
- Show strong stock-shortage warnings but allow continuation.
- Create auditable stock movements linked to the quote.
- Prevent duplicate deduction for the same quote/production start.
- Surface deduction status in quote/production UI and inventory ledger/CSV.
- Reuse append-only reversal workflows for corrections.
- Add tests for settings, status transition, deduction idempotency, insufficient stock, ledger/reporting, and reversal guidance.

### Out of scope candidates

- Full production-order management unless needed for idempotency/audit.
- In-place editing of historical stock movements.
- Replacing the whole quote/task workflow.
- Advanced purchasing/replenishment automation.
- External accounting integration.

## Suggested chained PR / work-unit shape

1. **Foundation and data model**
   - Clarify/migrate setting semantics.
   - Add production deduction tracking/idempotency storage.
   - Extend movement reason/context if needed.
   - Update database types.

2. **Snapshot/BOM contract**
   - Ensure approved quote material consumption is frozen enough for deduction.
   - Add tests proving deduction does not read mutable current recipe data.

3. **Production deduction command**
   - Server-side/RPC or feature API command for quote production deduction.
   - Warning data for insufficient stock.
   - Idempotency and no double deduction.

4. **Quote production UI**
   - Review/confirmation flow when moving to `en_produccion`.
   - Strong shortage warnings.
   - Manual mode keeps status transition without automatic movements.

5. **Ledger/reporting/reversal guidance**
   - Mark production-origin movements clearly.
   - Include production context in ledger/detail/CSV.
   - Link users to existing reversal flow for corrections.

6. **Verification and E2E/integration coverage**
   - Status transition to production with deduction enabled.
   - Status transition with deduction disabled.
   - Insufficient stock warning and allowed continuation.
   - Idempotency / no double deduction.
   - Reversal of a production-origin movement.

## Open proposal questions

Most core product decisions are already answered. Remaining proposal-level questions:

1. Should the existing `auto_stock_discount` setting be redefined from "approval discount" to "production-start deduction", or should a new setting be added while preserving the old approval behavior?
2. Should old `descuento_presupuesto` movements be treated as already-deducted when a quote later moves to `en_produccion`?
3. Does a quote become production-started directly from any previous status, or only from `aprobado`?
4. Should production deduction be all-or-nothing per quote, or can users exclude individual materials in the confirmation UI?
5. Should negative stock be allowed only for automatic production deductions, or also for manual inventory movements?

## Recommendation

Proceed to proposal, but constrain the first formal implementation plan around quote-based production deduction rather than introducing a full production-order system. The safest proposal should preserve auditability, make double-deduction impossible, and explicitly solve the snapshot gap before implementing the production trigger.
