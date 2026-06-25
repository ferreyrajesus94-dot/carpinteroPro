# Inventory Stock Movements Reporting and Audit Hygiene

## Purpose

This specification describes the stock-movement reporting and audit surface for the inventory feature after the approved change. It covers the workshop-wide movement ledger, server-side filtering and bounded retrieval, CSV export, creator attribution, unit-test baseline, and the inventory public API seam. Existing per-material adjustment and history behavior remains compatible.

## Requirements

### Requirement: Workshop-wide stock-movement ledger

The system MUST provide a workshop-scoped ledger page, reachable from the inventory area, that lists stock movements across all materials in the current workshop. Each row MUST display the material, delta, reason label, note, quote reference when available, creation timestamp, and creator identifier when available. The ledger MUST preserve the existing per-material stock history behavior and MUST keep product-facing copy in Spanish.

#### Scenario: Open the ledger from the inventory area

- GIVEN the authenticated user belongs to a workshop with stock movements
- WHEN the user navigates to the inventory movement ledger
- THEN the system displays movement rows scoped to the current workshop
- AND each row shows material, delta, reason, note, quote reference if present, timestamp, and creator if known.

#### Scenario: Per-material history remains available

- GIVEN a material with stock movements
- WHEN the user opens the existing per-material stock history dialog
- THEN the dialog continues to show movements for that material only
- AND it uses the same tenant-scoped query path as before.

### Requirement: Server-side filtering and bounded retrieval

The system MUST support server-side filtering of the workshop-wide ledger by movement reason, material, date range, and creator when creator data exists. The system MUST enforce a bounded retrieval strategy, such as a default page limit or explicit cursor/window, so the ledger does not fetch all historical rows for a workshop by default. Filters MUST be applied on the server or inside RLS-safe database logic; the client MUST NOT filter across unbounded tenant data.

#### Scenario: Filter by reason and date range

- GIVEN a workshop with movements of multiple reasons across several dates
- WHEN the user selects a reason and a date range in the ledger
- THEN the system requests only rows matching the reason and the date range
- AND the request returns at most the configured default limit.

#### Scenario: Tenant isolation under filters

- GIVEN two workshops each with stock movements
- WHEN an authenticated user of workshop A applies a filter that would match movements in workshop B
- THEN the result contains only workshop A movements
- AND no workshop B data is returned.

#### Scenario: Material search filter

- GIVEN a workshop with movements for multiple materials
- WHEN the user selects or searches for a specific material
- THEN the ledger returns only movements for that material within the current workshop.

### Requirement: CSV export for filtered ledger results

The system MUST provide a CSV export action for the currently filtered ledger results. The export MUST use the same RLS-safe, tenant-scoped query path as the ledger. The export MUST include stable columns useful for audit and reporting: timestamp, material identifier/name, delta, reason, note, quote reference or identifier, creator identifier when known, and workshop-scoped identifiers if needed. The export MUST contain only the data the user is allowed to see.

#### Scenario: Export filtered results

- GIVEN the user has applied filters to the ledger
- WHEN the user triggers CSV export
- THEN the downloaded CSV contains rows matching the active filters
- AND the CSV includes timestamp, material, delta, reason, note, quote reference, and creator columns.

#### Scenario: Export respects tenant boundaries

- GIVEN a user with access only to workshop A
- WHEN the user exports the ledger
- THEN the CSV contains no rows from workshop B.

### Requirement: Creator attribution in `apply_stock_movement`

The system MUST update the `apply_stock_movement` execution path so that every newly inserted `stock_movements` row sets `created_by` to the authenticated user's `auth.uid()` inside the trusted database function flow. Historical rows with `created_by = null` MUST remain unchanged. The change MUST preserve the existing tenant-hardening pattern: derive the workshop from `auth.uid() -> profiles.workshop_id`, reject cross-workshop material access, and never trust a client-provided workshop identifier for mutation.

#### Scenario: Manual adjustment records creator

- GIVEN an authenticated user creates a manual stock adjustment
- WHEN the system invokes `apply_stock_movement`
- THEN the new `stock_movements` row has `created_by` equal to the authenticated user's UUID
- AND `materials.stock` is updated within the same workshop.

#### Scenario: Quote auto-discount records creator

- GIVEN an authenticated user transitions a quote to `aprobado` and `auto_stock_discount` is enabled
- WHEN the system invokes `apply_stock_movement` for `descuento_presupuesto`
- THEN the new movement row has `created_by` equal to the authenticated user's UUID.

#### Scenario: Historical rows remain null

- GIVEN existing `stock_movements` rows with `created_by = null`
- WHEN the creator-attribution migration is applied
- THEN those historical rows keep `created_by = null`.

#### Scenario: Cross-workshop mutation is still rejected

- GIVEN an authenticated user belongs to workshop A
- WHEN `apply_stock_movement` is invoked for a material belonging to workshop B
- THEN the function raises a tenant-access error
- AND no movement row is inserted.

### Requirement: Unit-test baseline for API, hooks, and high-value UI behavior

The system MUST add a focused unit-test baseline for the stock-movement API and hooks. Tests MUST cover the RPC call shape sent to Supabase, query behavior and invalidation behavior of TanStack Query wrappers, and at least one high-value UI behavior in the stock-adjust flow, such as negative-stock blocking or pack-mode calculation. Existing E2E coverage SHOULD remain the integration safety net; new E2E tests SHOULD be added only if the ledger requires integration validation and the review budget permits.

#### Scenario: API call shape test

- GIVEN a mocked Supabase client
- WHEN `applyStockMovement` is called with valid input
- THEN the test verifies the RPC is invoked as `apply_stock_movement` with the expected arguments.

#### Scenario: Hook query invalidation test

- GIVEN the `useApplyStockMovement` hook succeeds
- WHEN the mutation completes
- THEN the hook invalidates the relevant `materials` and `stock_movements` query keys.

#### Scenario: Negative-stock blocking in adjust dialog

- GIVEN the `StockAdjustDialog` is open with a material whose current stock is 10
- WHEN the user attempts a consumption of 15 and the dialog blocks negative stock
- THEN the submit action is disabled or rejected
- AND no stock movement is created.

### Requirement: Inventory public API exports

The system MUST expose stock-movement hooks and API functions from `src/features/inventory/index.ts` for app-level or future cross-feature composition. Exports MUST be limited to the approved public API surface and MUST NOT encourage feature-to-feature internal imports. The existing public API (`PriceSparkline`, `useMaterials`, `useAllPriceHistory`) MUST remain available.

#### Scenario: Public API exposes stock movement hooks

- GIVEN `src/features/inventory/index.ts` is the public API entry point
- WHEN a consumer imports `useStockMovements`, `useApplyStockMovement`, or the ledger query hook
- THEN the import resolves through `src/features/inventory/index.ts`
- AND no consumer imports from `src/features/inventory/hooks/*` or `src/features/inventory/api/*` directly.

### Requirement: Query-key cache privacy

Any new TanStack Query key family for stock-movement data MUST remain non-persistable, consistent with the cache-privacy policy for tenant-scoped inventory and stock-movement data.

#### Scenario: New ledger query key is non-persistable

- GIVEN a new query key is introduced for the workshop-wide ledger
- WHEN `cachePrivacy.test.ts` evaluates persistability
- THEN the new key is classified as non-persistable.

### Requirement: Deferred scope remains excluded

The system MUST NOT implement reversal, cancellation, or compensating-entry workflows. The system MUST NOT add a dashboard recent-movements widget. The system MUST NOT wire settings UI toggles for `workshop_settings.auto_stock_discount` or `workshop_settings.stock_alert_enabled` as part of this change.

#### Scenario: Reversal is not supported

- GIVEN a movement row exists in the ledger
- WHEN the user looks for a reversal or undo action
- THEN no reversal, cancellation, or compensating-entry action is available.

#### Scenario: Dashboard widget is not added

- GIVEN the dashboard page loads after this change
- THEN no recent stock-movement widget appears on the dashboard.

#### Scenario: Settings toggles are not wired

- GIVEN the settings or onboarding surfaces
- WHEN this change is complete
- THEN no new UI toggle for `auto_stock_discount` or `stock_alert_enabled` is introduced.
