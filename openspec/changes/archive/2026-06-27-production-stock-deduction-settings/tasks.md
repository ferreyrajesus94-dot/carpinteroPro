# Tasks: Production-start stock deduction

## Status

Planned. Implementation must use strict TDD from `openspec/config.yaml`.

Test runner: `npm test`

Delivery strategy: **chained PRs required**. The design forecasts a multi-area change across migrations/RPCs, quotes UI, settings, inventory ledger/export, and tests. Each PR below must stay near or under the 400 changed-line review budget and include its own tests.

## Review workload forecast

| Work unit | Forecast | Risk | PR strategy |
| --- | ---: | --- | --- |
| PR 1 — Stop approval deduction and safe status foundations | 250-450 lines | High behavior risk | Separate PR |
| PR 2 — Approved BOM schema and capture | 350-650 lines | High data/RLS risk | Separate PR |
| PR 3 — Production deduction batch/RPCs | 450-800 lines | High transaction/idempotency risk | Separate PR, split if needed |
| PR 4 — Production-start UI | 400-750 lines | High UX/regression risk | Separate PR, split if needed |
| PR 5 — Ledger/export/reporting and reversal guidance | 350-700 lines | Medium/high audit UX risk | Separate PR, split if needed |

> Guardrail: before `sdd-apply`, confirm whether to apply only PR 1 first or authorize a chained-PR implementation plan. Do not implement all work in one PR.

## Global constraints

- [ ] No `any` types.
- [ ] No unused imports/variables.
- [ ] React components use named exports.
- [ ] No feature-to-feature imports except through allowed app composition/public APIs.
- [ ] New DB tables include `workshop_id uuid NOT NULL`.
- [ ] RLS enabled on every new table.
- [ ] Manually maintained `database.ts` entries include `Relationships: []`.
- [ ] Generic `apply_stock_movement` remains strict and rejects manual negative stock.
- [ ] Production deduction is the only controlled path allowed to take stock negative.
- [ ] Original `stock_movements` rows remain append-only/immutable.

## PR 1 — Stop approval-time deduction and fix safe quote status foundations

### Goal

Remove the old approval-time stock side effect and ensure status-only updates cannot delete quote snapshots/extras.

### Risk note

Current status-only updates can call `updateQuote()` without `recipeSnapshots` / `laborSnapshots`. Because missing arrays default to `[]`, `replaceSnapshots()` can delete existing snapshots. Fix this before building production-start deduction.

### RED

- [ ] Add/extend tests proving changing quote status to `aprobado` does **not** call stock movement RPC or create stock movements.
- [ ] Add/extend tests proving a status-only update preserves existing quote recipe/labor snapshots.
- [ ] Add/extend tests proving Settings copy says stock is deducted when production starts, not when quote is approved.

Suggested files:

- `src/features/quotes/hooks/useQuotes.test.ts`
- `src/features/quotes/api/quotes.test.ts` if existing, otherwise create focused API tests near quotes API patterns.
- `src/features/settings/components/WorkshopSettings.test.tsx`

### GREEN

- [ ] Remove/deprecate `maybeAutoDiscountStock()` call from `src/features/quotes/hooks/useQuotes.ts`.
- [ ] Introduce a status-only quote update path that does not replace extras/snapshots.
- [ ] Ensure list, kanban, and form status changes use the safe status path when no quote content is being edited.
- [ ] Update Settings UI copy for `auto_stock_discount` to `Descontar stock automáticamente al iniciar producción` or equivalent.
- [ ] Preserve existing manual inventory movement behavior.

### TRIANGULATE

- [ ] Add test case for approving a quote that has snapshots; snapshots remain unchanged after status update.
- [ ] Add test case for non-approval status update preserving snapshots.

### REFACTOR

- [ ] Remove dead approval-discount code if no longer referenced, or mark it legacy only if later PRs need migration scaffolding.
- [ ] Keep quote status helper names explicit: avoid generic helpers that hide snapshot side effects.

### Acceptance

- [ ] Quote approval does not deduct stock.
- [ ] Status-only updates preserve snapshots.
- [ ] Settings copy reflects production-start semantics.
- [ ] `npm test -- src/features/quotes src/features/settings` or equivalent focused Vitest command passes.
- [ ] `npm test` passes before PR handoff.
- [ ] `npm run lint` passes.

### Rollback

- [ ] Revert UI copy and status helper changes if needed. Do **not** restore approval-time deduction unless product explicitly reverses the decision.

## PR 2 — Approved BOM schema and capture

### Goal

Create an immutable approved BOM source for production deduction so production start never reads mutable recipe/template rows.

### RED

- [ ] Add SQL/RLS tests proving `quote_approved_bom_lines` rows are tenant-isolated.
- [ ] Add tests proving approved BOM capture uses quote snapshot/material data at approval time.
- [ ] Add tests proving recipe/template edits after approval do not change captured deduction quantities.
- [ ] Add tests proving incomplete plate/cut-piece/material data is captured as an incomplete BOM line with warning metadata, not silently ignored.

### GREEN

- [ ] Add migration for `quote_approved_bom_lines` with:
  - [ ] `id uuid primary key default gen_random_uuid()`
  - [ ] `workshop_id uuid not null`
  - [ ] `quote_id uuid not null references quotes(id) on delete cascade`
  - [ ] `line_number integer not null`
  - [ ] `source_recipe_snapshot_id uuid null`
  - [ ] `material_id uuid null`
  - [ ] `material_name text not null`
  - [ ] `material_unit text not null`
  - [ ] `material_category text not null`
  - [ ] `deduction_quantity numeric(12,2) null check (deduction_quantity is null or deduction_quantity > 0)`
  - [ ] `calculation_method text not null`
  - [ ] `is_complete boolean not null default true`
  - [ ] `warning_code text null`
  - [ ] `calculation_context jsonb not null default '{}'::jsonb`
  - [ ] `created_at timestamptz not null default now()`
- [ ] Add unique/indexes: `unique (quote_id, line_number)`, `(workshop_id, quote_id)`.
- [ ] Enable RLS and add S/I/U/D tenant policies.
- [ ] Add capture function/API for quote approval BOM.
- [ ] Capture direct quantity lines from quote snapshots.
- [ ] Capture final plate/cut-piece deduction quantity at approval time when enough data exists.
- [ ] Insert incomplete lines with warning codes when data is insufficient.
- [ ] Update `src/shared/types/database.ts` and related generated/manual types.

### TRIANGULATE

- [ ] Add a case where a material is deleted/unresolved after approval; BOM remains auditable.
- [ ] Add a case where a plate/cut-piece line lacks required dimensions; warning is stored.

### REFACTOR

- [ ] Extract BOM capture mapping into small pure functions where possible.
- [ ] Keep JSON audit context write-only for UI; user-facing logic should use typed columns.

### Acceptance

- [ ] Approved BOM rows are immutable enough for production deduction.
- [ ] Production deduction design can ignore mutable recipe/template rows.
- [ ] RLS tests cover cross-tenant denial.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] Run TypeScript diagnostics / `npx tsc -b` if supported.

### Rollback

- [ ] Before dependent PRs, table/function can be dropped. After production data exists, leave table dormant rather than deleting audit records.

## PR 3 — Production deduction batch and RPCs

### Goal

Add server-side production-start preview, confirmed deduction, idempotency, and whole-batch reversal while preserving strict manual stock movement semantics.

### RED

- [ ] SQL/RPC test: generic `apply_stock_movement` still rejects manual negative stock.
- [ ] SQL/RPC test: `get_quote_production_deduction_preview` creates no movements and no status change.
- [ ] SQL/RPC test: only `aprobado -> en_produccion` can create a production deduction batch.
- [ ] SQL/RPC test: production deduction can take material stock negative after confirmation.
- [ ] SQL/RPC test: duplicate request/request retry cannot create duplicate movements.
- [ ] SQL/RPC test: incomplete BOM lines are copied into batch warnings and do not create bogus movements.
- [ ] SQL/RPC test: whole-batch reversal creates compensating rows and marks the batch reversed.
- [ ] API/hook tests for preview/start/reverse wrappers and error mapping.

### GREEN

- [ ] Add migration for `quote_production_stock_deductions` with:
  - [ ] `id uuid primary key default gen_random_uuid()`
  - [ ] `workshop_id uuid not null`
  - [ ] `quote_id uuid not null references quotes(id) on delete cascade`
  - [ ] `request_id uuid null`
  - [ ] `status text not null default 'completed'`
  - [ ] `auto_stock_discount_enabled boolean not null`
  - [ ] `snapshot_incomplete boolean not null default false`
  - [ ] `shortage_detected boolean not null default false`
  - [ ] `warning_summary jsonb not null default '[]'::jsonb`
  - [ ] `confirmed_by uuid null`
  - [ ] `confirmed_at timestamptz not null default now()`
  - [ ] reversal audit fields.
- [ ] Add unique constraints: `(workshop_id, quote_id)` and partial `(workshop_id, request_id)`.
- [ ] Add enum value `consumo_produccion`; retain `descuento_presupuesto` as legacy.
- [ ] Add `stock_movements.production_deduction_id` and index.
- [ ] Add `get_quote_production_deduction_preview(p_quote_id uuid)`.
- [ ] Add `start_quote_production(p_quote_id uuid, p_confirm_deduction boolean, p_request_id uuid)`.
- [ ] Add `reverse_production_stock_deduction(p_deduction_id uuid, p_reversal_reason text, p_reversal_request_id uuid default null)`.
- [ ] Add `src/features/quotes/api/productionStockDeduction.ts`.
- [ ] Add `src/features/quotes/hooks/useProductionStockDeduction.ts`.
- [ ] Update `database.ts` types.

### TRIANGULATE

- [ ] Test network retry after success returns existing result.
- [ ] Test concurrent/double production-start attempt relies on DB uniqueness, not only client state.
- [ ] Test setting off: status updates to `en_produccion`, no batch/movements, preview still returned.

### REFACTOR

- [ ] Keep transaction logic centralized in RPCs.
- [ ] Keep frontend wrappers thin and typed.
- [ ] Use const objects for new statuses/methods; avoid `any`.

### Acceptance

- [ ] Server enforces idempotency and tenant isolation.
- [ ] Manual negative stock remains rejected.
- [ ] Confirmed production path can create negative projected stock with audit warnings.
- [ ] Batch reversal is append-only.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.
- [ ] Run TypeScript diagnostics / `npx tsc -b` if supported.

### Rollback

- [ ] Hide UI entry points and leave schema dormant. Do not edit/delete audit rows. Enum value may remain unused.

## PR 4 — Production-start UI

### Goal

Route every `aprobado -> en_produccion` entry point through a shared review/confirmation flow.

### RED

- [ ] Component test: production-start dialog shows preview rows in automatic mode.
- [ ] Component test: production-start dialog shows preview rows in manual mode and creates no movements.
- [ ] Component test: shortage warning is visible and strong.
- [ ] Component test: incomplete BOM warning is visible and strong.
- [ ] Component/hook test: cancel leaves quote status unchanged.
- [ ] Component/hook test: confirm calls `startQuoteProduction` with request id and correct `p_confirm_deduction`.
- [ ] QuoteList/pipeline/form tests: `aprobado -> en_produccion` does not call generic status update directly.

### GREEN

- [ ] Add `src/features/quotes/components/ProductionStartReviewDialog.tsx`.
- [ ] Add shared quote production-start controller/hook for UI entry points.
- [ ] Wire QuoteList status selector.
- [ ] Wire kanban/pipeline drag/drop.
- [ ] Wire QuoteForm status selector for approved quote edits.
- [ ] Add success toast/result state with movement count, skipped incomplete lines, warning count, and link to inventory movements.
- [ ] Add compact quote production deduction state where available: `Stock descontado`, `Sin descuento automático`, `Advertencias`, `Revertido`.

### TRIANGULATE

- [ ] Test already-started quote/batch state displays existing result and does not offer duplicate deduction.
- [ ] Test status transition from non-approved quote does not show production deduction flow.

### REFACTOR

- [ ] Avoid duplicate modal logic across list/form/pipeline.
- [ ] Keep UI copy in Spanish.
- [ ] Keep components named exports only.

### Acceptance

- [ ] Users cannot bypass production-start review for approved quotes through known UI entry points.
- [ ] Manual mode remains usable and creates no movements.
- [ ] Automatic mode requires confirmation.
- [ ] Cancel is safe.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.

### Rollback

- [ ] Route `aprobado -> en_produccion` back to status-only helper and hide dialog. Server/schema can remain dormant.

## PR 5 — Ledger/export/reporting and reversal guidance

### Goal

Make production-origin movements visible and correctable as a whole batch through inventory/admin surfaces.

### RED

- [ ] Ledger RPC/API test: production fields are returned for `consumo_produccion` rows.
- [ ] Ledger table test: production-origin rows display indicator and quote reference.
- [ ] Detail page test: production-origin movement shows batch context and whole-batch reversal guidance.
- [ ] CSV test: export includes production origin, quote reference, and production deduction id columns.
- [ ] Reversal UI/API test: batch reversal creates compensating rows and original rows remain unchanged.
- [ ] Report/filter test: `consumo_produccion` is distinct from generic `consumo` and legacy `descuento_presupuesto`.

### GREEN

- [ ] Extend `get_stock_movement_ledger` return fields: `production_deduction_id`, `is_production_deduction`, `production_deduction_status`, quote context.
- [ ] Extend `get_stock_movement_detail` return fields and production guidance text.
- [ ] Add reason label `consumo_produccion = "Consumo producción"`.
- [ ] Update `StockMovementLedgerTable` badges/quote links.
- [ ] Update `StockMovementDetailPage` to prefer whole-batch reversal CTA for production-origin rows.
- [ ] Update `stockMovementCsv.ts` with columns: production origin, quote, production deduction id.
- [ ] Add inventory/admin report handling for production reason.
- [ ] Add hook/API wrapper for batch reversal if not completed in PR 3 frontend wrappers.

### TRIANGULATE

- [ ] Test reversed production batch state displays as reversed.
- [ ] Test individual movement reversal remains possible only through existing authorized flow, while UX guidance prefers batch reversal.

### REFACTOR

- [ ] Keep production labels centralized.
- [ ] Avoid duplicating CSV formatting logic.
- [ ] Keep inventory feature independent from quotes internals; use quote ids/numbers from RPC return contracts.

### Acceptance

- [ ] Inventory/admin users can identify production-origin movements.
- [ ] CSV/report exports preserve production context.
- [ ] Corrections guide whole-batch reversal.
- [ ] Original movement rows remain immutable.
- [ ] `npm test` passes.
- [ ] `npm run lint` passes.

### Rollback

- [ ] Hide batch reversal CTA and production badges; audit columns/rows remain intact.

## Final verification

- [ ] Run `npm test` and record output.
- [ ] Run `npm run lint` and record output.
- [ ] Run `npx tsc -b` if supported; otherwise document the unsupported command and use LSP diagnostics on changed TS files.
- [ ] Run focused SQL/RLS tests for new migrations/RPCs.
- [ ] Run focused Vitest suites for quotes, settings, inventory stock movements, CSV, and production dialog.
- [ ] Manual smoke: approve quote, edit template, start production; deduction uses approved BOM.
- [ ] Manual smoke: shortage warning appears, production can start, stock becomes negative, movement is auditable.
- [ ] Manual smoke: disabled setting shows preview and creates no movements.
- [ ] Manual smoke: retry production start does not double deduct.
- [ ] Manual smoke: reverse production batch creates compensating movements and leaves originals unchanged.
- [ ] Run `lens_diagnostics mode=all` before declaring apply complete.

## Apply guidance

Start with **PR 1 only** unless the user explicitly authorizes a chained implementation run. PR 1 is a required safety foundation because it removes the conflicting approval-time side effect and fixes status-only snapshot preservation before new production deduction behavior exists.
