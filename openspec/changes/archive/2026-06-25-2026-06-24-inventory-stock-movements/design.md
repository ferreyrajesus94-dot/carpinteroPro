# Design — Inventory Stock Movements Reporting and Audit Hygiene

## Context

This change extends the existing inventory stock movement implementation. The current system already has:

- `stock_movements` with tenant-scoped RLS and nullable `created_by`.
- `apply_stock_movement(...)` as the atomic mutation path for manual movements and quote auto-discount.
- Per-material movement history and stock-adjust dialogs under `src/features/inventory`.
- Query cache privacy that currently fails closed for all query keys.

The design keeps the current per-material workflow compatible while adding a workshop-wide reporting ledger, filtered retrieval, CSV export, creator attribution, unit tests, and public API exports.

## Decisions

1. **Use a typed, RLS-safe database RPC for the ledger read model.**
   - Add `get_stock_movement_ledger(...)` as a `SECURITY INVOKER` SQL/plpgsql function returning denormalized rows for the UI/export.
   - The function derives the current workshop from `auth.uid() -> profiles.workshop_id`, applies explicit `stock_movements.workshop_id = v_current_workshop_id`, and still relies on base-table RLS.
   - This avoids fragile client-side multi-table joins, keeps filtering/limits server-side, and provides one stable contract for both the ledger and CSV export.

2. **Do not create a new table.**
   - Current `stock_movements` remains the source of truth.
   - No destructive migration or historical backfill is required.

3. **Keep export client-side but data source server-filtered.**
   - The browser generates and downloads CSV from rows returned by `get_stock_movement_ledger(...)` using the active filters.
   - The export action may request a larger explicit export limit than the visual ledger, but it must still be bounded.

4. **Route the ledger as an inventory sub-route.**
   - Convert `InventoryRoutes` to render React Router nested routes: index for current material inventory, `movements` for the workshop ledger.
   - The app-level route `/inventory/*` remains unchanged.

5. **Use public inventory seams only.**
   - Stock movement API types/functions and hooks that are intended for app-level composition are exported from `src/features/inventory/index.ts`.
   - Cross-feature internals remain private.

## Database and migration plan

### Migration file

Add a new migration, e.g. `supabase/migrations/20260624xxxxxx_stock_movement_ledger_and_creator.sql`.

### Creator attribution in `apply_stock_movement`

Replace the currently hardened function with the same tenant-hardening behavior plus `created_by = auth.uid()` on insert:

- Keep parameters unchanged for backward compatibility:
  - `p_material_id uuid`
  - `p_delta numeric`
  - `p_reason stock_movement_reason`
  - `p_note text default null`
  - `p_quote_id uuid default null`
- Keep `SECURITY INVOKER`.
- Continue to:
  - reject zero delta,
  - derive `v_current_workshop_id` from `profiles` using `auth.uid()`,
  - reject missing/cross-workshop materials with `42501`,
  - update `materials.stock` only where `workshop_id = v_current_workshop_id`,
  - reject negative resulting stock,
  - insert the movement row in the same transaction.
- Change insert columns to include `created_by`:
  - `INSERT INTO stock_movements (..., created_by) VALUES (..., auth.uid())`.

Historical rows with `created_by IS NULL` remain untouched.

### Ledger RPC contract

Add a read function similar to:

```sql
CREATE OR REPLACE FUNCTION get_stock_movement_ledger(
  p_reason stock_movement_reason DEFAULT NULL,
  p_material_id uuid DEFAULT NULL,
  p_creator_id uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  workshop_id uuid,
  material_id uuid,
  material_name text,
  material_unit unit_of_measure,
  delta numeric,
  reason stock_movement_reason,
  note text,
  quote_id uuid,
  quote_number text,
  created_at timestamptz,
  created_by uuid,
  creator_name text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$ ... $$;
```

Filtering behavior:

- Clamp `p_limit` to a safe maximum, e.g. `LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500)`.
- Clamp `p_offset` to `>= 0`.
- Apply filters in SQL:
  - `sm.reason = p_reason` when provided.
  - `sm.material_id = p_material_id` when provided.
  - `sm.created_by = p_creator_id` when provided.
  - `sm.created_at >= p_from` and `< p_to` when provided.
  - material search via `materials.name ILIKE '%' || p_search || '%'` when provided and non-empty.
- Order by `sm.created_at DESC, sm.id DESC` for deterministic pagination.
- Join:
  - `materials m ON m.id = sm.material_id AND m.workshop_id = sm.workshop_id`.
  - `quotes q ON q.id = sm.quote_id AND q.workshop_id = sm.workshop_id`.
  - `profiles p ON p.id = sm.created_by AND p.workshop_id = sm.workshop_id`.
- Return `creator_name` as nullable; UI labels unknown/null creator as `Sin registrar` or `Desconocido`.

Rationale: a function return type must be added manually to `src/shared/types/database.ts` under `Functions`. No new table relationship typing is needed.

### Optional indexes

Existing indexes cover `(workshop_id, created_at DESC)` and `(material_id, created_at DESC)`. Add indexes only if query plans or expected volume justify them:

- `stock_movements_workshop_reason_created_idx ON stock_movements (workshop_id, reason, created_at DESC)`.
- `stock_movements_workshop_creator_created_idx ON stock_movements (workshop_id, created_by, created_at DESC)` where creator filtering is important.

Avoid adding a trigram index for material search in this slice unless performance evidence requires it.

### Database types

Update `src/shared/types/database.ts` manually:

- `apply_stock_movement` signature remains unchanged.
- Add `get_stock_movement_ledger` under `public.Functions` with `Args` and `Returns` typed as an array of ledger row objects.
- No `Tables` change is required unless optional relationships/constraints are added.
- If any new database relation is introduced, include `Relationships: []` or real relationships per project policy.

## RLS and security plan

- Keep `stock_movements` RLS policies unchanged.
- The ledger RPC must be `SECURITY INVOKER`, not definer.
- The ledger RPC must explicitly derive and filter by current workshop; it must not accept `workshop_id` from the client.
- The mutator RPC must continue rejecting cross-workshop material IDs before update/insert.
- CSV export must use the same ledger RPC and active filters; it must not query a broader unfiltered dataset in the client.
- Query keys remain non-persistable; current cache privacy fails closed, but tests should include the new key family for regression documentation.

## Frontend feature-sliced changes

### API layer: `src/features/inventory/api/stockMovements.ts`

Add types and functions:

- `StockMovementLedgerFilters`
  - `reason?: StockMovementReason | null`
  - `materialId?: string | null`
  - `creatorId?: string | null`
  - `from?: string | null`
  - `to?: string | null`
  - `search?: string | null`
  - `limit?: number`
  - `offset?: number`
- `StockMovementLedgerRow`
  - inferred from `Database['public']['Functions']['get_stock_movement_ledger']['Returns'][number]` where practical.
- `fetchStockMovementLedger(filters)`
  - calls `supabase.rpc('get_stock_movement_ledger', { ... })`.
  - normalizes absent filters to `null` and default limit/offset.
- Existing `applyStockMovement` and `fetchStockMovements(materialId)` remain backward-compatible.

Use strict TypeScript, no `any`; use const objects for runtime constants when adding query-key or filter enums.

### Hooks: `src/features/inventory/hooks/useStockMovements.ts` or sibling

Introduce a ledger-specific query key and hooks:

- `const STOCK_MOVEMENT_QUERY_KEYS = { material: ..., ledger: ... } as const`.
- `useStockMovementLedger(filters)`
  - wraps `fetchStockMovementLedger` with a stable array query key, e.g. `['stock_movements', 'ledger', normalizedFilters]`.
  - default limit is visual-page sized, e.g. 50.
- `useExportStockMovementLedger(filters)` is optional; export can call the API imperatively from the component to avoid storing large export results in query cache.
- Update `useApplyStockMovement` success invalidation to invalidate:
  - `['materials', workshopId]`,
  - `['stock_movements', input.materialId]`,
  - `['stock_movements', 'ledger']` prefix or a broader `['stock_movements']` family invalidation.

Keep TanStack Query wrappers in the inventory feature per architecture rules.

### UI components

Add components under `src/features/inventory/components/`:

- `StockMovementLedgerPage.tsx`
  - page container and Spanish headings/copy.
- `StockMovementLedgerFilters.tsx`
  - reason select, material search text input or material select, date range inputs, creator UUID/text filter where available.
  - Keep filters simple and server-driven; debounce search only if existing project patterns support it.
- `StockMovementLedgerTable.tsx`
  - rows with material, signed delta, reason label, note, quote reference, timestamp, creator.
  - Empty/loading/error states in Spanish.
- `stockMovementCsv.ts` or `api/stockMovementCsv.ts`
  - pure helpers for CSV escaping, column ordering, filename generation, and `Blob` download trigger.

Existing `StockHistoryDialog` should continue to use `useStockMovements(material.id)` unchanged except for any shared labels/formatters extracted locally within the inventory feature.

React 19 guidance:

- Use named React imports only.
- Do not add manual `useMemo`/`useCallback` unless required by an external API contract; current `useFabAction` already uses `useCallback` and can remain as existing code.
- Use functional named exports.

### Routing

Update `src/features/inventory/routes.tsx`:

- Preserve the current inventory index UI by moving it into an internal named component such as `InventoryIndexPage`.
- Render:
  - `<Route index element={<InventoryIndexPage />} />`
  - `<Route path="movements" element={<StockMovementLedgerPage />} />`
- Keep app router `/inventory/*` unchanged.

Add an inventory-area navigation entry or action button, for example:

- Index page `PageHeader` secondary action: `Ver movimientos` linking to `/inventory/movements`.
- Ledger page action: `Volver al inventario` linking to `/inventory`.

### Public API exports

Update `src/features/inventory/index.ts` to preserve current exports and add approved stock-movement seams:

- `useStockMovements`
- `useApplyStockMovement`
- `useStockMovementLedger`
- `applyStockMovement`
- `fetchStockMovements`
- `fetchStockMovementLedger`
- Stock movement types needed by app-level composition.

Do not export private UI internals unless app-level routing/composition requires them.

## CSV export approach

- Export button lives on `StockMovementLedgerPage`.
- On click:
  1. Use current filters.
  2. Call `fetchStockMovementLedger({ ...filters, limit: EXPORT_LIMIT, offset: 0 })`.
  3. Build CSV with stable headers:
     - `fecha`
     - `material_id`
     - `material`
     - `delta`
     - `motivo`
     - `nota`
     - `quote_id`
     - `presupuesto`
     - `created_by`
     - `creador`
  4. Escape quotes, commas, semicolons, CR/LF safely.
  5. Generate filename like `movimientos-stock-YYYY-MM-DD.csv`.
  6. Create a `Blob`, attach an object URL to a temporary anchor, click it, then revoke the URL.

- Use UTF-8 with BOM if spreadsheet compatibility is needed for Spanish characters.
- If filtered results exceed `EXPORT_LIMIT`, show Spanish copy indicating the export is limited to the first N records and users should narrow filters.
- No server storage or service-role key is involved.

## Test plan

### SQL tests

Extend `supabase/tests/tenant_isolation.test.sql` or add a focused SQL test file:

- `apply_stock_movement` inserts `created_by = auth.uid()`.
- Cross-workshop material mutation still raises/denies and inserts no movement.
- `get_stock_movement_ledger` returns only current-workshop rows.
- Ledger filters by reason, material, creator, and date range.
- Ledger respects limit bounds.
- Historical `created_by IS NULL` rows remain valid and queryable.

### Unit tests

Add Vitest coverage in the inventory feature:

- API tests for `stockMovements.ts`:
  - `applyStockMovement` sends the existing RPC call shape.
  - `fetchStockMovementLedger` calls `get_stock_movement_ledger` with normalized filters/limit.
  - errors from Supabase are thrown.
- Hook tests:
  - `useStockMovementLedger` uses the expected query key and fetcher behavior.
  - `useApplyStockMovement` invalidates material, per-material movement, and ledger query families on success.
- UI tests:
  - `StockAdjustDialog` blocks negative stock and does not call the mutation.
  - Ledger filter interactions trigger server-backed query changes.
  - CSV helper escapes values and preserves stable column order.
- Cache privacy:
  - Add an explicit expectation for `['stock_movements', 'ledger', filters]` even though `isPersistableQueryKey` currently fails closed.

### E2E / integration

Existing stock-movement E2E remains the primary integration safety net. Add a lightweight ledger E2E only if budget allows:

- Create two movements.
- Navigate to `/inventory/movements`.
- Filter by reason.
- Assert visible row and CSV button presence.

Do not make E2E a blocker for the first small backend/API slice if review budget is tight.

## Rollback plan

- **UI rollback:** remove or hide the `/inventory/movements` route/link; existing per-material stock history remains untouched.
- **API rollback:** stop calling `get_stock_movement_ledger`; the function can remain unused until a follow-up migration if needed.
- **Creator attribution rollback:** replace `apply_stock_movement` with the previous hardened implementation. Existing rows remain valid because `created_by` is nullable.
- **CSV rollback:** remove only the export button/helper; ledger read behavior can remain.
- **Index rollback:** optional indexes can be dropped independently if they regress write performance.

No destructive data migration is planned.

## Risks and mitigations

- **Tenant isolation regression:** Mitigate with `SECURITY INVOKER`, explicit current-workshop filtering, and SQL tenant tests.
- **Unbounded export volume:** Mitigate with clamped server limits and an explicit export max.
- **Creator ambiguity:** Historical/null creators are labeled as unknown and creator filtering only matches known IDs.
- **Review budget pressure:** Split implementation into chained review slices below.
- **Manual database types drift:** Keep migration and `database.ts` updates in the same work unit and test RPC call types.
- **CSV as reporting contract:** Keep headers stable and document any future header changes as product changes.

## Review slices / work units

Recommended chained PR/work-unit split for the 400-line review budget:

1. **Backend contract and SQL tests**
   - Migration for creator attribution and `get_stock_movement_ledger`.
   - Manual `database.ts` function type update.
   - SQL tenant/filter/creator tests.

2. **Inventory API and TanStack Query hooks**
   - `fetchStockMovementLedger` and strict types.
   - Ledger query key family and invalidation updates.
   - API/hook unit tests and cache-privacy expectation.

3. **Ledger route and table UI**
   - Convert inventory routes to nested index + `movements`.
   - Add ledger page, filter controls, table, loading/empty/error states.
   - Component tests for filter/query behavior.

4. **CSV export and UI polish**
   - CSV helper and export action.
   - Export tests for escaping/columns and bounded export behavior.
   - Final public API exports.

5. **Optional UI baseline if not covered earlier**
   - `StockAdjustDialog` negative-stock or pack-mode unit test if not already included in slice 2/3.

Each slice should keep tests with behavior and should be independently rollbackable.
