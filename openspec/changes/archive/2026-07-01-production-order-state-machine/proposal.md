# Proposal: Production Order State Machine

## Status

Approved (in review). PR 1-9 implemented under strict TDD. PR 1-8
verified (per-PR `verify-report.md` snapshots are historical
verification artifacts; see the **Current status preamble** at the top
of `verify-report.md` for the consolidated picture). PR 9 (legacy
`start_quote_production` wrapper migration, including the PR 9.1
review-blocker fix batch) is implemented and ready for the final PR 9
verify step. Total: 26/26 implementation tasks complete; 0 pending.
Review-blocker cycles (PR 7.1, 7.2, 8.1, 8.2, 9.1) are recorded in
`tasks.md` and `apply-progress.md`; they are not net-new implementation
tasks.

## Intent

CarpinteroPro currently models production as a single status flag on the
quote (`quotes.status = 'en_produccion'`). That is the wrong shape: a
quote is a sales artifact, not a production artifact. Operators cannot
pause, resume, batch, audit, or report on a quote lifecycle the way
they can on a real production order.

This change introduces a first-class `production_orders` table with a
proper 7-state machine, append-only event log, and SQL-owned transition
rules, then wires the frontend and existing inventory data around it.
The final result: an explicit, auditable, reversible production
lifecycle that is no longer glued to quote status.

## Scope

### In scope

- New `production_orders` table with a 7-value `production_order_state`
  enum (`planned`, `in_progress`, `paused`, `quality_check`, `ready`,
  `delivered`, `cancelled`).
- Append-only `production_order_events` audit table (no UPDATE/DELETE
  paths for any role).
- SQL-owned state machine: `start_production_order` and
  `transition_production_order_state` SECURITY DEFINER RPCs with
  transaction-local internal guard
  (`app.production_order_write_context = 'rpc'`) and allowed-transition
  matrix.
- Read RPCs: `list_production_orders`, `get_production_order`,
  `get_production_order_events`, `get_quotes_with_production_status`,
  `get_production_pipeline_stats` (SECURITY INVOKER, RLS-scoped, no N+1).
- Nullable FK link from `quote_production_stock_deductions` to
  `production_orders` so inventory surfaces can deep-link from any
  production-origin movement back to the order that produced it.
- Frontend data layer in `src/features/production/`: typed wrappers,
  TanStack Query hooks, query-key cache-privacy contract, feature-sliced
  barrel.
- Production board at `/production` (5 columns by active state) and the
  start-production dialog with quota/auto mode, shortage warnings, and
  error handling.
- Direct `en_produccion` writes blocked at four layers: `useUpdateQuote`
  hook, `useUpdateQuoteStatus` hook, `QuoteForm` status filter, and the
  SQL `prevent_direct_en_produccion_writes()` trigger (defense in depth).

### Out of scope (deferred to PR 7-9 or later)

- Production order detail page at `/production/:id` with the event
  timeline UI (PR 7).
- Inventory deep-link from production-origin movements back to the
  detail page (PR 7).
- Dashboard pipeline stats widget and quote actions wired to the new
  start hook (PR 8).
- Deprecation of the legacy `start_quote_production` stock-deduction
  wrapper (PR 9).
- Per-material editing of deduction quantities.
- Automatic purchase orders for shortages.
- External accounting integration.

## Capabilities

### New capabilities

- `production-orders`: first-class production order entity with state
  machine, append-only events, SQL-owned transitions, read RPCs, and
  frontend data layer.
- `production-board`: Kanban-style board view of active production
  orders with a start-production flow.
- `production-fk-link`: nullable link from
  `quote_production_stock_deductions.production_order_id` to
  `production_orders.id` for deep-linking from inventory surfaces.

### Modified capabilities

- `inventory`: production-origin movements gain a nullable
  `production_order_id` reference (reused from
  `quote_production_stock_deductions.production_order_id`); ledger and
  detail surfaces will surface the link in PR 7.
- `quotes`: direct `en_produccion` writes are forbidden at the SQL
  layer; the QuoteForm status dropdown excludes `en_produccion`; the
  `useUpdateQuote` and `useUpdateQuoteStatus` hooks throw descriptive
  errors when callers attempt the forbidden transition.

## Approach

Split the work into chained work-unit PRs under a 400-line review
budget (per `openspec/config.yaml`). Each PR ships its tests in the
same slice under strict TDD.

| PR | Title | Verdict | Tasks |
|----|-------|---------|-------|
| 1 | Schema foundation (enum, tables, RLS, guards, FK invariants) | PASS | 2/2 |
| 2 | Write RPCs (start, transition, idempotency, direct-write guard) | PASS WITH WARNINGS | 4/4 |
| 3 | Read RPCs (list, get, events, projection, stats) | PASS WITH WARNINGS | 3/3 |
| 4 | Deduction FK linkage to production orders | PASS WITH WARNINGS | 3/3 |
| 5 | Frontend data layer (types, RPC wrappers, hooks, cache privacy) | PASS | 3/3 |
| 6 | Board + start flow + direct quote-status guard + lint fix | PASS WITH WARNINGS | 2/2 |
| 7 | Detail page + event timeline + inventory deep-link | PASS | 3/3 |
| 8 | Dashboard + quote actions integration | PASS | 3/3 |
| 9 | Legacy `start_quote_production` wrapper migration | implemented; PR 9 final verify pending | 3/3 |

Total: 26 tasks, 26 complete, 0 pending. Review-blocker cycles (PR 7.1,
7.2, 8.1, 8.2, 9.1) are not counted as new implementation tasks; they
are tracked in `tasks.md` and `apply-progress.md` as fix cycles.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/20260630000000..000005_*` | Created | Six migrations cover schema, write RPCs, read RPCs, blocker fixes, and deduction FK. |
| `supabase/tests/production_orders_*.test.sql`, `production_deduction_link.test.sql` | Created | pgTAP suites for every migration. |
| `src/shared/types/database.ts` | Modified | Manually maintained `Relationships: []` types for new tables/RPCs. |
| `src/features/production/**` | Created | New feature slice: api, hooks, components, routes, index barrel. |
| `src/features/quotes/hooks/useQuotes.ts` | Modified | Throws on direct `en_produccion` writes. |
| `src/features/quotes/components/QuoteForm.tsx` | Modified | Excludes `en_produccion` from status dropdown; uses `useWatch` not `watch`. |
| `src/app/router.tsx` | Modified | Mounts `<ProductionRoutes />` under `/production/*`. |
| `src/app/layouts/nav-items.ts` | Modified | Adds production nav item. |
| `eslint.config.js` | Modified | Adds `featureZone("production")` boundary. |
| `.gitignore` | Modified | Adds `.engram/` and `supabase/.temp/`. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Internal guard GUC leaks across RPCs | Low | `SET LOCAL` (transaction-local), not `set_config(..., false)` (session-local); `current_setting(name, true)` is NULL-safe. |
| Direct `en_produccion` writes via full quote edit | Resolved (PR 6) | Blocked at four layers: hook throw, hook throw, UI filter, SQL trigger. |
| Determinism of tied-timestamp event ordering | Resolved (PR 3) | `ORDER BY e.created_at ASC, e.id ASC` with explicit UUID fixtures in T8.1. |
| Cross-tenant FK invariant bypass via service role | Resolved (PR 1) | Same-workshop check is invariant; no `auth.uid() IS NULL` bypass. |
| New RPCs lack dedicated pgTAP coverage | Resolved (PR 2-4) | 97 PR 2 + 99 PR 3 + 37 PR 4 pgTAP assertions. |
| Feature boundary violation across `src/features/production/**` | Resolved (PR 6) | `featureZone("production")` ESLint boundary active; barrel-only cross-feature imports. |

## Rollback plan

Each PR is independently revertible because migrations ship
sequentially and triggers are idempotent.

- PR 1: `DROP TABLE production_order_events, production_orders;
  DROP TYPE production_order_state;`
- PR 2: `DROP FUNCTION start_production_order,
  transition_production_order_state;`
- PR 3: `DROP FUNCTION list_production_orders, get_production_order,
  get_production_order_events, get_quotes_with_production_status,
  get_production_pipeline_stats;`
- PR 4: `ALTER TABLE quote_production_stock_deductions DROP COLUMN
  production_order_id;` and drop the new trigger.
- PR 5-6: revert frontend files; ESLint boundary stays as a no-op
  enforcement.

No data loss in rollback: the existing `quotes.status` column retains
its values; the new tables are additive.

## Dependencies

- `workshop_settings.auto_stock_discount` (PR prior to this change)
  must keep its production-start semantics.
- `quote_production_stock_deductions` (prior change) must expose its
  deduction id for the PR 4 FK.
- `profiles.role IN ('admin', 'operational')` must exist for the PR 2
  role check.
- `auth.uid() -> profiles.workshop_id` derivation must exist for tenant
  scoping.

## Success criteria

- [x] `production_orders` and `production_order_events` exist with
      SELECT-only RLS, defense-in-depth triggers, and same-workshop FK
      invariants. (PR 1)
- [x] `start_production_order` and `transition_production_order_state`
      enforce the allowed-transition matrix with idempotent retries and
      direct-write rejection. (PR 2)
- [x] Read RPCs return denormalized data with stable event ordering
      and strict all-delivered projection. (PR 3)
- [x] `quote_production_stock_deductions.production_order_id` is a
      nullable FK to `production_orders.id` with the same-workshop
      check. (PR 4)
- [x] Frontend data layer exposes typed wrappers, TanStack Query hooks,
      and a feature-sliced barrel with cache-privacy contract. (PR 5)
- [x] Production board renders 5 columns, start dialog handles quota
      and errors, and direct `en_produccion` writes are blocked at four
      layers. (PR 6)
- [x] `/production/:id` detail page with event timeline and inventory
      deep-link surface. (PR 7 — verified)
- [x] Dashboard pipeline stats widget + quote actions wired to the new
      start hook. (PR 8 — verified)
- [x] Legacy `start_quote_production` wrapper is deprecated and
      migrated to `start_production_order`. (PR 9 — implemented; final
      PR 9 verify step pending)

## Next phase

PR 9 final verify. PR 1-8 are verified (per-PR snapshots in
`verify-report.md`); PR 9 (legacy `start_quote_production` wrapper
migration, including the PR 9.1 review-blocker fix batch) is
implemented and ready for the final verify step. After PR 9 verifies,
the change is ready for `sdd-archive`. The legacy
`ProductionStartReviewDialog` UX migration to the new
`useStartProductionOrder` flow is a documented follow-up (the UX
message currently surfaces `movements_created`; the new flow returns
`movements_created = 0`, so the dialog copy needs to change — that is
out of scope for PR 9 and tracked in `apply-progress.md`).
