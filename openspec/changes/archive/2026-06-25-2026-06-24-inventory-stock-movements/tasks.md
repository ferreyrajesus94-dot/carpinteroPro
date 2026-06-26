# Tasks — Inventory Stock Movements Reporting and Audit Hygiene

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600–790 (all units combined) |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High
```

### PR Slice Breakdown

| PR | Title | Est. lines | Dependencies |
|----|-------|-----------|-------------|
| PR 1 | Backend: migration, `database.ts` types, SQL tests | ~180–220 | — |
| PR 2 | API layer + hooks + unit tests | ~120–150 | PR 1 |
| PR 3 | Ledger route, table, filters, component tests | ~200–280 | PR 2 |
| PR 4 | CSV export, public API exports, StockAdjustDialog test | ~100–140 | PR 2 |

PR 3 and PR 4 could land in parallel after PR 2 merges if the reviewer allows it, since they share the API layer but have no mutual file conflict.

---

## Work Unit 1 — Backend Migration, `database.ts` Types, SQL Tests

**Goal:** Add `created_by = auth.uid()` to the existing `apply_stock_movement` RPC, introduce `get_stock_movement_ledger(...)` as a `SECURITY INVOKER` read RPC with server-side filtering and limit clamping, update `database.ts`, and add SQL/pgTAP tests for tenant isolation, creator attribution, and ledger filtering.

**Scope:** `supabase/migrations/`, `src/shared/types/database.ts`, `supabase/tests/`

---

### T1.1 — RED: Write SQL tests that assert desired `apply_stock_movement` creator behavior

- [x] **File:** `supabase/tests/stock_movement_creator.test.sql`
- [x] Use `pgTAP` (`begin; select plan(N); ... select * from finish(); rollback;`).
- [x] Seed `auth.users`, `profiles`, `materials`, and `workshop` rows in a temp table following the pattern in `supabase/tests/tenant_isolation.test.sql`.
- [x] Set `request.jwt.claim.sub` to `user_a` (authenticated).
- [x] Call `apply_stock_movement` on `material_a` with a valid delta/reason.
- [x] **Assert:** The inserted `stock_movements` row has `created_by = user_a`.
- [x] Run the test — **expect failure** against the current migration (no `created_by = auth.uid()` yet).

### T1.2 — GREEN: Update `apply_stock_movement` to set `created_by = auth.uid()`

- [x] **File:** `supabase/migrations/20260624120000_creator_attribution_and_ledger_rpc.sql`
- [x] Copy the current `apply_stock_movement` function body from `supabase/migrations/20260605000100_harden_stock_movement_rpc.sql`.
- [x] Change the `INSERT` line from:

  ```sql
  INSERT INTO stock_movements (workshop_id, material_id, delta, reason, note, quote_id)
  VALUES (v_workshop_id, p_material_id, p_delta, p_reason, p_note, p_quote_id);
  ```

  to:

  ```sql
  INSERT INTO stock_movements (workshop_id, material_id, delta, reason, note, quote_id, created_by)
  VALUES (v_workshop_id, p_material_id, p_delta, p_reason, p_note, p_quote_id, auth.uid());
  ```

- [x] Keep the same parameter signature and all existing hardening logic unchanged.
- [x] Re-run T1.1 — **expect pass**.

### T1.3 — RED: Write SQL tests that assert desired `get_stock_movement_ledger` behavior

- [x] **File:** `supabase/tests/stock_movement_ledger.test.sql`
- [x] Use `pgTAP` with temp test IDs, seeded data, and `set_config('request.jwt.claim.sub', ...)` for user_a / user_b.
- [x] Seed 3+ stock movements across 2 workshops with different reasons, materials, creators, timestamps, and a `quote` reference.
- [x] **Tests:**
  - [x] `get_stock_movement_ledger()` called as `user_a` returns only `workshop_a` rows.
  - [x] Filter by `p_reason` returns only matching rows.
  - [x] Filter by `p_material_id` returns only matching rows.
  - [x] Filter by `p_creator_id` returns only matching rows.
  - [x] Filter by `p_from` / `p_to` date range returns only rows within range.
  - [x] Filter by `p_search` matches material name via `ILIKE`.
  - [x] `p_limit` above 500 is clamped to 500; `p_limit < 1` clamps to 1.
  - [x] `p_offset < 0` is clamped to 0.
  - [x] Historical row with `created_by IS NULL` is still returned (not filtered out).
  - [x] Column `creator_name` is populated when `created_by` is not null; `null` when `created_by IS NULL`.
- [x] Run — **expect failure** (function does not exist yet).

### T1.4 — GREEN: Add `get_stock_movement_ledger` to the migration file

- [x] **File:** same migration `20260624120000_creator_attribution_and_ledger_rpc.sql`
- [x] Add the `CREATE OR REPLACE FUNCTION get_stock_movement_ledger(...)` as specified in the design, including:
  - [x] `LANGUAGE plpgsql SECURITY INVOKER`
  - [x] Workshop derivation from `auth.uid() -> profiles.workshop_id`
  - [x] Clamped limit: `LEAST(GREATEST(COALESCE(p_limit, 50), 1), 500)`
  - [x] Clamped offset: `GREATEST(COALESCE(p_offset, 0), 0)`
  - [x] Conditional filter clauses for reason, material, creator, date range, and search
  - [x] Joins to `materials`, `quotes`, `profiles` (all scoped to `sm.workshop_id`)
  - [x] `ORDER BY sm.created_at DESC, sm.id DESC`
  - [x] Return columns: `id, workshop_id, material_id, material_name, material_unit, delta, reason, note, quote_id, quote_number, created_at, created_by, creator_name`
- [x] Re-run T1.3 — **expect pass**.

### T1.5 — TRIANGULATE: Cross-workshop mutation denial still holds

- [x] In `supabase/tests/stock_movement_creator.test.sql`, add a test that attempts `apply_stock_movement` with a `material_id` belonging to `workshop_b` while authenticated as `user_a`.
- [x] **Assert:** raises exception (cross-tenant material invisible through RLS).
- [x] **Assert:** no movement row was inserted for that material.
- [x] Re-run all SQL test files — **expect pass**.

### T1.6 — Update `database.ts` function types

- [x] **File:** `src/shared/types/database.ts`
- [x] Under `public.Functions`, keep `apply_stock_movement` args/returns unchanged.
- [x] Add `get_stock_movement_ledger`:

  ```ts
  get_stock_movement_ledger: {
    Args: {
      p_reason?: Database["public"]["Enums"]["stock_movement_reason"] | null;
      p_material_id?: string | null;
      p_creator_id?: string | null;
      p_from?: string | null;
      p_to?: string | null;
      p_search?: string | null;
      p_limit?: number | null;
      p_offset?: number | null;
    };
    Returns: {
      id: string;
      workshop_id: string;
      material_id: string;
      material_name: string;
      material_unit: Database["public"]["Enums"]["unit_of_measure"];
      delta: number;
      reason: Database["public"]["Enums"]["stock_movement_reason"];
      note: string | null;
      quote_id: string | null;
      quote_number: string | null;
      created_at: string;
      created_by: string | null;
      creator_name: string | null;
    }[];
  };
  ```

- [x] Verify the file has no `any` types and no unused imports.
- [x] Run `npx tsc --noEmit` — **expect clean**.

### T1.7 — REFACTOR: Ensure migration is idempotent and well-commented

- [x] Review migration SQL for:
  - [x] `CREATE OR REPLACE` for both functions (idempotent).
  - [x] Comments documenting the purpose and security model.
  - [x] No unnecessary `SET search_path` changes.
- [x] Re-run both SQL test files — **expect pass**.

---

## Work Unit 2 — Inventory API Layer + TanStack Query Hooks + Unit Tests

**Goal:** Add the `fetchStockMovementLedger` API function with strict types, ledger query key family, updated invalidation in `useApplyStockMovement`, and full Vitest coverage for API + hooks.

**Scope:** `src/features/inventory/api/stockMovements.ts`, `src/features/inventory/hooks/useStockMovements.ts`, new test files under `src/features/inventory/`

**Depends on:** PR 1 (migration + `database.ts` types merged)

---

### T2.1 — RED: Write API unit tests for `fetchStockMovementLedger`

- [x] **File:** `src/features/inventory/api/stockMovements.test.ts`
- [x] Mock `@/shared/lib/supabase` with a `rpc` spy.
- [x] **Tests:**
  - [x] `fetchStockMovementLedger({})` calls `supabase.rpc('get_stock_movement_ledger', ...)` with all filters defaulted to `null` and default `limit: 50, offset: 0`.
  - [x] `fetchStockMovementLedger({ reason: 'compra', materialId: 'abc' })` passes the filters correctly, absent filters as `null`.
  - [x] Throws the Supabase error when `rpc` returns `{ error }`.
  - [x] Returns the data array on success.
- [x] Run — **expect failure** (function does not exist yet).

### T2.2 — GREEN: Add types and `fetchStockMovementLedger` to API module

- [x] **File:** `src/features/inventory/api/stockMovements.ts`
- [x] Add types:

  ```ts
  export interface StockMovementLedgerFilters {
    reason?: StockMovementReason | null
    materialId?: string | null
    creatorId?: string | null
    from?: string | null
    to?: string | null
    search?: string | null
    limit?: number
    offset?: number
  }

  export type StockMovementLedgerRow = Database['public']['Functions']['get_stock_movement_ledger']['Returns'][number]
  ```

- [x] Add function:

  ```ts
  export async function fetchStockMovementLedger(
    filters: StockMovementLedgerFilters,
  ): Promise<StockMovementLedgerRow[]> {
    const { data, error } = await supabase.rpc('get_stock_movement_ledger', {
      p_reason: filters.reason ?? null,
      p_material_id: filters.materialId ?? null,
      p_creator_id: filters.creatorId ?? null,
      p_from: filters.from ?? null,
      p_to: filters.to ?? null,
      p_search: filters.search ?? null,
      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    })
    if (error) throw error
    return (data as StockMovementLedgerRow[]) ?? []
  }
  ```

- [x] Ensure no `any` types, no unused imports.
- [x] Re-run T2.1 — **expect pass**.

### T2.3 — TRIANGULATE: Verify existing `applyStockMovement` and `fetchStockMovements` still pass

- [x] Add tests to `src/features/inventory/api/stockMovements.test.ts` (or ensure existing tests still cover):
  - [x] `applyStockMovement(input)` calls `supabase.rpc('apply_stock_movement', ...)` with correct parameter mapping.
  - [x] `fetchStockMovements(materialId)` calls `supabase.from('stock_movements').select('*')...` correctly.
  - [x] Both throw on Supabase errors.
- [x] Run all API tests — **expect pass**.

### T2.4 — RED: Write hook tests for `useStockMovementLedger`

- [x] **File:** `src/features/inventory/hooks/useStockMovements.test.ts`
- [x] Follow the pattern from `useMaterials.test.ts`: mock the API module, create a `QueryClientProvider` wrapper.
- [x] Mock `../api/stockMovements` with `fetchStockMovementLedger`, `fetchStockMovements`, `applyStockMovement`.
- [x] **Tests:**
  - [x] `useStockMovementLedger({})` calls `fetchStockMovementLedger` with default filters and returns data.
  - [x] Query key is `['stock_movements', 'ledger', normalizedFilters]`.
  - [x] Does not fetch when `enabled: false` (if the hook supports it).
  - [x] `useApplyStockMovement` on success invalidates:
    - `['materials', workshopId]`
    - `['stock_movements', input.materialId]`
    - `['stock_movements', 'ledger']` (prefix invalidation)
- [x] Run — **expect failure** (`useStockMovementLedger` does not exist yet).

### T2.5 — GREEN: Add `useStockMovementLedger` and update `useApplyStockMovement`

- [x] **File:** `src/features/inventory/hooks/useStockMovements.ts`
- [x] Add constant query key families:

  ```ts
  const STOCK_MOVEMENTS_KEY = 'stock_movements'
  const STOCK_MOVEMENT_LEDGER_KEY = [STOCK_MOVEMENTS_KEY, 'ledger'] as const
  ```

- [x] Add hook:

  ```ts
  export function useStockMovementLedger(
    filters: StockMovementLedgerFilters,
    options?: { enabled?: boolean },
  ) {
    return useQuery({
      queryKey: [...STOCK_MOVEMENT_LEDGER_KEY, filters],
      queryFn: () => fetchStockMovementLedger(filters),
      enabled: options?.enabled ?? true,
    })
  }
  ```

- [x] Update `useApplyStockMovement.onSuccess` to also invalidate `['stock_movements', 'ledger']`:

  ```ts
  onSuccess: (_newStock, input) => {
    queryClient.invalidateQueries({ queryKey: [MATERIALS_KEY, workshopId] })
    queryClient.invalidateQueries({ queryKey: [STOCK_MOVEMENTS_KEY, input.materialId] })
    queryClient.invalidateQueries({ queryKey: STOCK_MOVEMENT_LEDGER_KEY })
    toast.success('Stock ajustado')
  },
  ```

- [x] Import `fetchStockMovementLedger` and `StockMovementLedgerFilters`.
- [x] Re-run T2.4 — **expect pass**.

### T2.6 — TRIANGULATE: Existing hooks still pass

- [x] Run `useStockMovements.test.ts` — `useStockMovements(materialId)` still fetches per-material data with key `['stock_movements', materialId]`.
- [x] Run all existing inventory tests — **expect no regressions**.

### T2.7 — REFACTOR: Add cache privacy expectation for ledger key

- [x] **File:** `src/shared/lib/cachePrivacy.test.ts`
- [x] Add assertion:

  ```ts
  expect(isPersistableQueryKey(['stock_movements', 'ledger', {}])).toBe(false)
  ```

- [x] Run cache privacy tests — **expect pass**.

---

## Work Unit 3 — Ledger Route, Page, Table, Filters, Component Tests

**Goal:** Convert inventory routing to nested routes, add the workshop-wide ledger page with filter controls and data table, and add component tests for filter interactions and loading/empty/error states.

**Scope:** `src/features/inventory/routes.tsx`, new component files under `src/features/inventory/components/`, new test files

**Depends on:** PR 2 (hooks + API merged)

---

### T3.1 — RED: Write component test for ledger table rendering

- [x] **File:** `src/features/inventory/components/StockMovementLedgerTable.test.tsx`
- [x] Mock `useStockMovementLedger` with test data (3 rows: one with `creator_name`, one with `null` creator, one with a quote reference).
- [x] **Tests:**
  - [x] Renders material name, signed delta, reason label, note, quote number, timestamp, and creator name for each row.
  - [x] `null` creator displays `Sin registrar`.
  - [x] Shows empty state (Spanish copy) when data is `[]`.
  - [x] Shows loading skeleton/spinner when `isLoading` is true.
  - [x] Shows error message (Spanish copy) when query has an error.
- [x] Run — **expect failure** (component does not exist).

### T3.2 — GREEN: Add `StockMovementLedgerTable` component

- [x] **File:** `src/features/inventory/components/StockMovementLedgerTable.tsx`
- [x] Props: `rows: StockMovementLedgerRow[]`, `isLoading?: boolean`, `error?: Error | null`.
- [x] Render a table/grid with columns: Fecha, Material, Delta, Motivo, Nota, Presupuesto, Creado por.
- [x] Use existing UI primitives from `@/shared/ui/` (e.g., `Table`, `Skeleton`).
- [x] Format `created_at` as locale date string, `delta` with sign, `reason` with a Spanish label map, `creator_name ?? 'Sin registrar'`.
- [x] Link `quote_number` to the quote if present (or show `—` if null).
- [x] Named export, functional component, no `any`, no direct DOM manipulation.
- [x] Re-run T3.1 — **expect pass**.

### T3.3 — RED: Write component test for ledger filters

- [x] **File:** `src/features/inventory/components/StockMovementLedgerFilters.test.tsx`
- [x] **Tests:**
  - [x] Renders reason select, material search input, date range inputs.
  - [x] Changing reason calls `onFiltersChange` with the selected reason.
  - [x] Typing in search input calls `onFiltersChange` with the search value (debounced if applicable).
  - [x] Changing date range calls `onFiltersChange` with from/to values.
  - [x] "Limpiar filtros" button resets all filters to defaults and calls `onFiltersChange`.
- [x] Run — **expect failure**.

### T3.4 — GREEN: Add `StockMovementLedgerFilters` component

- [x] **File:** `src/features/inventory/components/StockMovementLedgerFilters.tsx`
- [x] Props: `filters: StockMovementLedgerFilters`, `onFiltersChange: (filters: StockMovementLedgerFilters) => void`.
- [x] Render:
  - [x] `Select` for reason (all options from `stock_movement_reason` enum with Spanish labels + "Todos").
  - [x] `Input` for material search text.
  - [x] Two `Input[type="date"]` for from/to range.
- [x] "Limpiar filtros" button resets to `{}` and calls `onFiltersChange({})`.
- [x] Named export, functional component, Spanish labels, uses `@/shared/ui/` primitives.
- [x] Re-run T3.3 — **expect pass**.

### T3.5 — RED: Write integration test for `StockMovementLedgerPage`

- [x] **File:** `src/features/inventory/components/StockMovementLedgerPage.test.tsx`
- [x] Mock `useStockMovementLedger` to return test data.
- [x] **Tests:**
  - [x] Renders page header "Movimientos de stock" and table.
  - [x] Filter change triggers a re-render with updated query parameters.
  - [x] Export button is visible.
- [x] Run — **expect failure**.

### T3.6 — GREEN: Add `StockMovementLedgerPage` component

- [x] **File:** `src/features/inventory/components/StockMovementLedgerPage.tsx`
- [x] Compose `PageHeader` (title: "Movimientos de stock", action: "Volver al inventario" link to `/inventory`), `StockMovementLedgerFilters`, `StockMovementLedgerTable`.
- [x] Manage local filter state via `useState<StockMovementLedgerFilters>({})`.
- [x] Call `useStockMovementLedger(filters)` and pass data/loading/error to the table.
- [x] Named export, functional component, Spanish copy throughout.
- [x] Re-run T3.5 — **expect pass**.

### T3.7 — Convert inventory routes to nested routing

- [x] **File:** `src/features/inventory/routes.tsx`
- [x] Extract the current content of `InventoryRoutes` into an `InventoryIndexPage` named component (same JSX, same state, same FAB, same dialogs).
- [x] Replace `InventoryRoutes` body with React Router nested routes:

  ```tsx
  <Routes>
    <Route index element={<InventoryIndexPage />} />
    <Route path="movements" element={<StockMovementLedgerPage />} />
  </Routes>
  ```

- [x] Add a secondary action "Ver movimientos" button on the `InventoryIndexPage` `PageHeader` that navigates to `/inventory/movements`.
- [x] Ensure `Routes` import is from `react-router-dom` (or the project's router package).
- [x] Run existing E2E — **expect no regression** on inventory index page.

### T3.8 — TRIANGULATE: Run all component and hook tests

- [x] `npx vitest run src/features/inventory/` — **expect all pass**.
- [x] Manually verify the ledger page renders in the browser at `/inventory/movements`.
- [x] Verify filters narrow the table, loading/empty states display correctly.

### T3.9 — REFACTOR: Clean up component code

- [x] Ensure all new components use named exports only.
- [x] Ensure no unused imports/variables.
- [x] Ensure no `any` types.
- [x] Ensure all UI copy is in Spanish.
- [x] Ensure consistent spacing and Tailwind patterns matching existing components.
- [x] Run full test suite — **expect pass**.

---

## Work Unit 4 — CSV Export, Public API Exports, StockAdjustDialog Baseline Test

**Goal:** Add CSV export for the filtered ledger, expose stock-movement public seams from `index.ts`, and optionally add a `StockAdjustDialog` negative-stock unit test.

**Scope:** `src/features/inventory/lib/`, `src/features/inventory/index.ts`, test files

**Depends on:** PR 2 (API layer merged); can land in parallel with PR 3 if no file conflict.

---

### T4.1 — RED: Write tests for stock movement CSV builder

- [x] **File:** `src/features/inventory/lib/stockMovementCsv.test.ts`
- [x] Follow the pattern from `exportMaterialsCsv.test.ts`.
- [x] **Tests:**
  - [x] `buildStockMovementCsv([])` includes BOM UTF-8 at start.
  - [x] First line after BOM contains stable headers: `fecha,material_id,material,delta,motivo,nota,presupuesto,creador`.
  - [x] Escapes commas and double-quotes in material names and notes correctly.
  - [x] `null` creator renders as empty string in CSV.
  - [x] `null` quote_number renders as empty string.
  - [x] `delta` is rendered as a signed number.
  - [x] `reason` is rendered as Spanish label.
  - [x] Filename is `movimientos-stock-YYYY-MM-DD.csv`.
- [x] Run — **expect failure** (module does not exist).

### T4.2 — GREEN: Add `stockMovementCsv.ts`

- [x] **File:** `src/features/inventory/lib/stockMovementCsv.ts`
- [x] Implemented with `HEADERS`, `REASON_LABELS`, `escape()`, `buildStockMovementCsv()`, `exportStockMovementCsv()`, `EXPORT_LIMIT = 500`.
- [x] Re-run T4.1 — **expect pass**.

### T4.3 — RED: Write test for bounded export behavior

- [x] **File:** `src/features/inventory/lib/stockMovementCsv.test.ts` (extend)
- [x] **Tests:**
  - [x] When filtered rows exceed `EXPORT_LIMIT` (e.g., 500), the CSV still builds from the passed rows (the limit is enforced at the API call site, not the builder).
  - [x] The `EXPORT_LIMIT` constant is exported and equals 500.
- [x] Run — **expect pass**.

### T4.4 — GREEN: Wire export action into `StockMovementLedgerPage`

- [x] **File:** `src/features/inventory/components/StockMovementLedgerPage.tsx`
- [x] Add an "Exportar CSV" button in the page header actions.
- [x] On click:
  - [x] Call `fetchStockMovementLedger({ ...filters, limit: 500, offset: 0 })` imperatively.
  - [x] Call `exportStockMovementCsv(data)`.
  - [x] If `data.length >= 500`, show a toast warning: "Exportación limitada a 500 registros. Ajustá los filtros para exportar menos datos."
  - [x] Handle errors with `toast.error('Error al exportar')`.
- [x] Add test in `StockMovementLedgerPage.test.tsx`:
  - [x] Mock `fetchStockMovementLedger` to return test data.
  - [x] Click "Exportar CSV".
  - [x] Assert `exportStockMovementCsv` was called with the returned data.

### T4.5 — Update public API exports

- [x] **File:** `src/features/inventory/index.ts`
- [x] Add exports (preserve existing `PriceSparkline`, `useMaterials`, `useAllPriceHistory`):
  - [x] Hooks: `useStockMovements`, `useApplyStockMovement`, `useStockMovementLedger`
  - [x] API: `applyStockMovement`, `fetchStockMovements`, `fetchStockMovementLedger`
  - [x] Types: `StockMovement`, `StockMovementReason`, `ApplyStockMovementInput`, `StockMovementLedgerFilters`, `StockMovementLedgerRow`
- [x] Ensure no component internals are exported.
- [x] Run `npx tsc --noEmit` — **expect clean**.

### T4.6 — TRIANGULATE: Verify `StockAdjustDialog` negative-stock blocking

- [x] **File:** `src/features/inventory/components/StockAdjustDialog.test.tsx`
- [x] Mock `useApplyStockMovement`.
- [x] **Tests:**
  - [x] Submitting an "out" movement that would result in negative stock displays an error message and does not call the mutation.
  - [x] Submitting a valid "in" movement calls the mutation with correct parameters.
- [x] These tests validate the existing behavior and serve as a regression baseline.

### T4.7 — REFACTOR: Final cleanup

- [x] Ensure CSV helpers reuse the `escape` pattern consistently.
- [x] Ensure all new files use `const`/`let`, no `var`, no `any`.
- [x] Run full inventory test suite: `npx vitest run src/features/inventory/` — 11 files, 61 tests passed.
- [x] Run `npm test` — full suite passes.

---

## Dependency Graph

```
PR 1 (T1.1–T1.7)
  │
  ▼
PR 2 (T2.1–T2.7)
  │
  ├──────────────────┐
  ▼                  ▼
PR 3 (T3.1–T3.9)   PR 4 (T4.1–T4.7)
```

## Test Command Reference

| Scope | Command |
|-------|---------|
| SQL tests | `npx supabase test db` (runs all `*.test.sql` files) |
| Vitest unit/integration | `npx vitest run src/features/inventory/` |
| TypeScript check | `npx tsc --noEmit` |
| Full frontend test suite | `npx vitest run` |
| E2E | Existing `tests/e2e/integration/inventory-stock-movement.spec.ts` |
