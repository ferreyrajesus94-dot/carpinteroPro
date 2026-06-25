# Proposal — Inventory Stock Movements Reporting and Audit Hygiene

## Intent

Extend the existing inventory stock-movement system from a per-material operational history into a workshop-wide reporting and audit surface. The change will help workshop users answer "what changed in stock, when, why, and by whom?" without opening each material individually, while improving the technical baseline for future stock-movement work.

The current implementation already has `stock_movements`, tenant-hardened RLS, the `apply_stock_movement` RPC, per-material adjustment/history dialogs, quote-driven auto-discount behavior, and E2E coverage. This initiative does not reintroduce stock movements; it adds the next bounded layer: reporting, export, creator attribution, tests, and public API hygiene.

## Scope

### In scope

1. **Workshop-wide stock-movement ledger**
   - Add a workshop-level stock-movement view/page reachable from the inventory area, tentatively `/inventory/movements`.
   - Show movement rows across materials with enough context for operational review: material, delta, reason, note, quote link/reference when available, created timestamp, and creator when available.
   - Preserve Spanish UI copy for the product surface.

2. **Filtering and bounded retrieval**
   - Support practical filters for the ledger: movement reason, material search/selection, date range, and creator where creator data exists.
   - Use server-side filtering and an explicit limit or cursor/window strategy so the ledger does not fetch all historical rows for high-volume workshops.
   - Keep per-material history behavior backward-compatible.

3. **CSV export**
   - Provide export for the currently filtered ledger results.
   - Export only tenant-visible data returned through the same RLS-safe query path as the ledger.
   - Include stable columns useful for audit/reporting: timestamp, material, delta, reason, note, quote reference/id, creator, and workshop-scoped identifiers if needed.

4. **Creator attribution audit hygiene**
   - Update the `apply_stock_movement` path so new stock-movement rows set `created_by` from `auth.uid()` inside the trusted database function flow.
   - Keep historical rows with `created_by = null`; do not attempt risky historical attribution unless a safe source exists.
   - Preserve the existing tenant-hardening pattern: derive the workshop from `auth.uid() -> profiles.workshop_id`, reject cross-workshop access, and never trust a client-provided workshop id for mutation.

5. **Unit-test baseline**
   - Add a focused unit-test baseline for the stock-movement API and hooks.
   - Cover RPC call shape, query behavior/invalidation behavior, and at least one high-value UI behavior in the stock-adjust flow such as negative-stock blocking or pack-mode calculation if line budget allows.
   - Keep existing E2E coverage as the integration safety net; add or adjust E2E only if the new ledger requires it and the review budget permits.

6. **Inventory public API exports**
   - Expose stock-movement hooks/API from `src/features/inventory/index.ts` where needed so app-level or future cross-feature composition can use the inventory public seam rather than internal paths.
   - Do not introduce feature-to-feature imports outside the approved public API pattern.

### Out of scope / deferred

- Reversal, cancellation, or compensating-entry workflows.
- Editing historical movement notes or reasons.
- Dashboard recent-movement widget.
- Settings UI wiring for `workshop_settings.auto_stock_discount`.
- Settings UI wiring for `workshop_settings.stock_alert_enabled`.
- Broad reason taxonomy changes unless a test or compatibility issue makes a minimal adjustment unavoidable.
- Historical backfill of `created_by` for old movement rows without reliable attribution data.

## Affected areas

- `supabase/migrations/**`
  - Add a migration for `apply_stock_movement` creator attribution and any RLS-safe view/query support chosen during design.
- `src/shared/types/database.ts`
  - Update manually maintained Supabase types for changed RPC/view/table contracts; include `Relationships: []` or real relationships for any new database surface.
- `src/features/inventory/api/stockMovements.ts`
  - Add or extend typed fetch functions for workshop-wide, filtered, bounded movement retrieval and export data preparation.
- `src/features/inventory/hooks/useStockMovements.ts` or sibling hook files
  - Add TanStack Query wrappers for workshop-wide ledger data and maintain invalidation compatibility with material and movement mutations.
- `src/features/inventory/components/**`
  - Add the ledger/list/export UI and any small shared movement presentation helpers.
- `src/features/inventory/routes.tsx`
  - Mount the new inventory ledger route/page.
- `src/features/inventory/index.ts`
  - Export approved public hooks/API/components needed for app-level composition.
- `src/shared/lib/cachePrivacy.test.ts`
  - Ensure any new `stock_movements` query-key family remains non-persistable.
- Tests under `src/features/inventory/**`
  - Add API/hook/component unit tests for the new and existing stock-movement baseline.
- Existing integration fixtures and docs
  - Reuse current E2E stock-movement fixtures; update runbook only if a new validation command or test entrypoint is added.

## Product behavior

- A user can open an inventory-level stock movement ledger and see movements across all materials in their workshop.
- Filters narrow the ledger without exposing data from another workshop.
- Export reflects the filtered dataset the user is allowed to see.
- New stock movements created by manual adjustments or quote auto-discount record `created_by` when the authenticated user is known.
- Existing per-material stock history and adjustment workflows continue to work.
- Existing quote auto-discount behavior remains backward-compatible and is not surfaced as a new settings workflow in this change.

## Technical constraints and rules

- Keep all DB access through the typed Supabase client and feature-sliced inventory API functions.
- Preserve RLS and multi-tenant isolation. New mutator SQL must derive tenant context from `auth.uid() -> profiles.workshop_id`.
- Avoid direct DOM manipulation, `any`, `var`, unused imports, and cross-feature internal imports.
- Keep stock-movement query keys non-persistable because movement history is operationally sensitive.
- Use server-side filtering/limits for workshop-wide ledger data; do not fetch all rows for a workshop by default.
- Prefer backward-compatible additions to the existing API/hook contracts.

## Risks

- **Tenant isolation regression:** A new ledger query or SQL view could bypass RLS if it does not inherit base-table policies or explicitly scope by current workshop.
- **Unbounded history volume:** Workshop-wide history can grow quickly; fetching all rows would harm performance and UX.
- **Audit ambiguity:** Historical `created_by` values may remain null, so creator filters/labels must handle unknown creators cleanly.
- **Review-budget pressure:** Combining ledger UI, CSV export, creator attribution, public API exports, and tests may exceed the 400-line review budget unless split carefully.
- **CSV data expectations:** Export can become a reporting contract; column naming and filtering semantics should stay stable once shipped.

## Rollback plan

- If the ledger UI causes problems, remove or hide the inventory route/sidebar entry while leaving existing per-material history untouched.
- If the workshop-wide API query causes performance issues, reduce the default date window/limit or disable export until pagination is tightened.
- If the creator-attribution migration has issues, replace the RPC with the prior hardened implementation; existing movement rows remain valid because `created_by` is nullable.
- If new public exports cause boundary issues, revert only the export surface and update consumers back to existing internal usage until a cleaner seam is designed.
- No destructive data migration is planned; rollback should not require deleting stock-movement records.

## Success criteria

- Workshop users can review stock movements across all materials from the inventory area.
- Ledger filters and CSV export work on tenant-visible, filtered movement data.
- New movements created through `apply_stock_movement` store `created_by = auth.uid()` when authenticated.
- Per-material adjustment/history dialogs and quote auto-discount behavior remain compatible.
- New stock-movement query keys are covered by cache-privacy expectations.
- Unit tests cover the stock-movement API/hook baseline and the new ledger behavior enough to support strict TDD in later phases.
- The implementation can be split into reviewable PRs within the 400 changed-line budget if the detailed task plan forecasts overrun.
