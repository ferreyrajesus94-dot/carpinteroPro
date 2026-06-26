# Exploration — inventory-stock-movements (SDD initiative)

## Outcome

CarpinteroPro already has a working `stock_movements` table + `apply_stock_movement` RPC + tenant-hardened RLS + an `inventory:StockAdjustDialog` / `StockHistoryDialog` UI. The user's request is to start a **new SDD initiative that extends the existing stock-movement system** — this exploration maps the current state and proposes scope options for the proposal phase to pick from.

## Current codebase map

### Database / migrations

| Area | Finding | Path evidence |
|---|---|---|
| Table | `stock_movements(id uuid PK, workshop_id uuid NOT NULL, material_id uuid NOT NULL, delta NUMERIC(12,2) CHECK delta<>0, reason stock_movement_reason NOT NULL, note TEXT, quote_id uuid, created_at timestamptz, created_by uuid)` with FKs to `workshops`, `materials` (CASCADE), `quotes` (SET NULL). | `supabase/migrations/0007_stock_movements.sql` |
| Enum | `stock_movement_reason` = `compra \| consumo \| merma \| ajuste \| descuento_presupuesto`. | `supabase/migrations/0007_stock_movements.sql` |
| Indexes | `(material_id, created_at DESC)`, `(workshop_id, created_at DESC)`. | `supabase/migrations/0007_stock_movements.sql` |
| RLS | RLS enabled, four policies S/I/U/D all scoped by `get_current_workshop_id()`. | `supabase/migrations/0007_stock_movements.sql` |
| RPC | `apply_stock_movement(p_material_id, p_delta, p_reason, p_note, p_quote_id) RETURNS NUMERIC`. Looks up `materials.workshop_id`, updates `materials.stock + p_delta`, raises on `delta = 0` or negative result, inserts the movement row, returns new stock. SECURITY INVOKER. | `supabase/migrations/0007_stock_movements.sql` |
| RPC hardening | Replaced on 2026-06-05: derives `v_current_workshop_id` from `auth.uid() → profiles.workshop_id`, raises `42501` on cross-workshop material, and adds `workshop_id = v_current_workshop_id` to the `UPDATE` to prevent update leakage. | `supabase/migrations/20260605000100_harden_stock_movement_rpc.sql` |
| Settings column | `workshop_settings.auto_stock_discount BOOLEAN NOT NULL DEFAULT false` is the toggle for quote-driven stock discount. | `supabase/migrations/0007_stock_movements.sql` |
| `materials` table | Has `stock NUMERIC`, `min_stock NUMERIC`, `updated_at`. `materials.stock` is the source of truth for current quantity. | `src/shared/types/database.ts` |
| `workshop_settings` table | Has `stock_alert_enabled BOOLEAN` column but no current frontend consumer. | `src/shared/types/database.ts` |

### Database types

| Area | Finding | Path evidence |
|---|---|---|
| `stock_movements` Row / Insert / Update + relationships are present. | Required for typed Supabase client. | `src/shared/types/database.ts` |
| `apply_stock_movement` RPC typedef is present. | Typed client RPC call support. | `src/shared/types/database.ts` |
| `stock_movement_reason` enum typedef is present. | Drives `StockMovementReason`. | `src/shared/types/database.ts` |

### Frontend feature slice

| Area | Finding | Path evidence |
|---|---|---|
| Public API | `index.ts` only re-exports `PriceSparkline`, `useMaterials`, `useAllPriceHistory`; it does not expose stock-movement hooks/components. | `src/features/inventory/index.ts` |
| Routes | `InventoryRoutes` wires `MaterialForm`, `PriceHistoryChart`, `StockAdjustDialog`, `StockHistoryDialog`. | `src/features/inventory/routes.tsx` |
| API | `api/stockMovements.ts` provides `applyStockMovement(input)` and `fetchStockMovements(materialId)`. | `src/features/inventory/api/stockMovements.ts` |
| Hooks | `useStockMovements(materialId)` and `useApplyStockMovement(workshopId)` wrap TanStack Query behavior and invalidations. | `src/features/inventory/hooks/useStockMovements.ts` |
| Adjust dialog | `StockAdjustDialog` handles direction, amount, reason, note, pack mode, preview, and negative-stock blocking. | `src/features/inventory/components/StockAdjustDialog.tsx` |
| History dialog | `StockHistoryDialog` shows a per-material timeline with delta, reason label, note, and timestamp. | `src/features/inventory/components/StockHistoryDialog.tsx` |
| Cache privacy | `stock_movements` is on the non-persistable query-key allowlist. | `src/shared/lib/cachePrivacy.test.ts` |

### Cross-feature consumers

| Area | Finding | Path evidence |
|---|---|---|
| Quotes auto-discount | `useUpdateQuote` calls `maybeAutoDiscountStock`; when transitioning to `aprobado` and `auto_stock_discount=true`, it calls `apply_stock_movement` with reason `descuento_presupuesto`. | `src/features/quotes/api/stockDiscount.ts`, `src/features/quotes/hooks/useQuotes.ts` |
| Query invalidation | Quotes invalidates `['materials']` and `['stock_movements']` after auto-discount. | `src/features/quotes/hooks/useQuotes.ts` |
| Dashboard | Dashboard reads current low stock from `materials.stock`/`min_stock`, not movement history. | `src/features/dashboard/components/Dashboard.tsx` |

### Tests

| Area | Finding | Path evidence |
|---|---|---|
| Unit hook tests | `useMaterials.test.ts` exists. No unit baseline for stock movement API/hooks/dialogs. | `src/features/inventory/hooks/useMaterials.test.ts` |
| SQL tests | Tenant isolation test verifies cross-tenant denial for stock movement visibility. | `supabase/tests/tenant_isolation.test.sql` |
| E2E integration | Inventory stock movement E2E covers purchase, consumption, and RLS-denied insert. | `tests/e2e/integration/inventory-stock-movement.spec.ts` |
| E2E fixtures | Fixture helpers include stock movement seed/fetch/cleanup helpers. | `scripts/e2e/fixtures.ts` |
| Runbook | Testing runbook lists inventory stock movement E2E. | `docs/testing/runbook.md` |

## Scope decision for this SDD

Because the user approved continuing without another question round, this SDD uses the recommended default scope from exploration:

- **Option A — workshop-wide stock-movement ledger with filters and export.**
- **Option B — audit hygiene: creator attribution, unit-test baseline, and inventory public API exports.**

Deferred from this SDD:

- Reversal / compensating entries.
- Dashboard recent-movements widget.
- Wiring `auto_stock_discount` and `stock_alert_enabled` UI toggles.
- Broad reason taxonomy changes unless required by tests.

## Cross-cutting constraints

- Any new tenant table must include `workshop_id uuid NOT NULL` and RLS.
- Any new table/view/RPC must update manually maintained `src/shared/types/database.ts` with `Relationships: []` or real relationships.
- New mutator RPCs must derive tenant from `auth.uid() → profiles.workshop_id`; do not trust client-provided workshop IDs.
- New query keys for movement data must remain non-persistable.
- Strict TDD is active: behavior changes require RED, GREEN, TRIANGULATE, REFACTOR evidence.
- Review budget is 400 changed lines per PR; tasks must forecast split risk.
- Feature-sliced boundaries apply: cross-feature reuse must go through `src/features/inventory/index.ts`.
- UI copy stays Spanish; technical artifacts stay English.

## Risks

- Cross-tenant regression if new movement queries/views bypass existing RLS.
- Review budget pressure if the ledger UI, CSV export, creator attribution, and test baseline are attempted as one large PR.
- Pagination debt: current per-material fetch returns all rows. Workshop-wide ledger must use a limit/filter strategy.
- Public API export must avoid encouraging feature-to-feature internals.
- `created_by` attribution depends on RPC behavior; historical rows may remain null.

## Ready for proposal

Yes. The proposal should formalize A+B as a bounded enhancement: workshop-wide ledger/reporting plus audit hygiene and test baseline, with reversal/dashboard/settings work deferred.
