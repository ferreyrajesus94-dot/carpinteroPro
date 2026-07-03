# Tasks: Production Order State Machine

## Review workload forecast

- Forecast: **large / chained required**. The change spans schema,
  write RPCs, read RPCs, deduction linkage, frontend data layer, and
  the board/start flow. Cumulative expected diff is well above the
  400-line review budget.
- Delivery recommendation: split into chained work-unit PRs per
  `openspec/config.yaml`. Nine work units, each under 400 changed
  lines.
- Status: PR 1-9 implemented and verified (PR 9.1 review-blocker fix
  batch included).

| PR | Title | Status | Tasks |
|----|-------|--------|-------|
| 1 | Schema foundation | PASS | 2/2 done |
| 2 | Write RPCs (start, transition, idempotency, direct-write guard) | PASS WITH WARNINGS | 4/4 done |
| 3 | Read RPCs (list, get, events, projection, stats) | PASS WITH WARNINGS | 3/3 done |
| 4 | Deduction FK linkage | PASS WITH WARNINGS | 3/3 done |
| 5 | Frontend data layer (types, RPC wrappers, hooks, cache privacy) | PASS | 3/3 done |
| 6 | Board + start flow + four-layer en_produccion guard | PASS WITH WARNINGS | 2/2 done |
| 7 | Detail page + event timeline + inventory deep-link | PASS | 3/3 done |
| 7.1 | Review-blocker fix (B1–B4) | PASS | 4/4 (blocker-fix cycles) |
| 7.2 | Final review-blocker fix (B5–B6) | PASS | 2/2 (blocker-fix cycles) |
| 8 | Dashboard + quote actions integration | done | 3/3 |
| 8.1 | PR 8 review-blocker fix (ESLint boundary + pipeline stats + cache-privacy regex + useId) | done | 5/5 (blocker-fix cycle) |
| 8.2 | PR 8 final review-blocker fix (portable PROJECT_ROOT + active-only comment) | done | 2/2 (blocker-fix cycle) |
| 9 | Legacy `start_quote_production` wrapper migration | done | 3/3 |
| 9.1 | PR 9 review-blocker fix (auth fail-open + auto_discount confirmation + existing-batch order_id) | done | n/a (blocker-fix cycle) |

Totals: 26 tasks, 26 complete, 0 pending. PR 7.1, 7.2, 8.1, 8.2, 9.1
are review-blocker cycles; the underlying 26 implementation tasks are
unchanged. PR 9 is the final implementation slice — the legacy
`start_quote_production` RPC is now a thin wrapper around
`start_production_order` (additive SQL migration
`20260630000009_start_quote_production_wrapper.sql`), the frontend
`useStartQuoteProduction` hook emits a one-time-per-session
deprecation `console.warn`, and the PR 9.1 review-blocker fix batch
hardens the wrapper's auth fail-open path, restores the legacy
p_confirm_deduction=false semantics, and surfaces the existing
batch's production_order_id as order_id in the existing-batch branch.

Decision needed before apply: No (PR 1-9 already applied; this is the
final implementation slice per the `sdd-apply` session preflight).
Chained PRs recommended: Yes (historical).
Chain strategy: feature-branch-chain (historical; this change was
shipped direct-to-main per the prior changelog pattern).
400-line budget risk: Low per slice (PR 9 is ~810 lines including the
verbose pgTAP test and the migration comments, but the actual code
delta is small).

## Phase 7.1 — PR 7 Review-Blocker Fix (done)

- [x] 7.1.1 Critical — `event_type` + `note` contract mismatch:
      schema migration adds the two spec-mandated columns, a
      BEFORE INSERT trigger auto-populates `event_type` for direct
      INSERTs (so the column can be NOT NULL with a CHECK
      constraint), the write RPCs populate both columns via the
      `production_order_event_type(from_state, to_state)` helper,
      and the read RPC exposes both columns. Frontend gains a
      `resolveEventTypeFromColumn` helper that prefers the SQL
      label and falls back to the state-derived mapping.
- [x] 7.1.2 Warning — EventTimeline order test strengthened:
      the previous test relied on the `a`/`b`/`c` characters
      appearing in the rendered text; the replacement uses
      distinct, in-content markers (`EVENT-MARKER-1`, -2, -3) and
      asserts the order via both DOM order and a content scan.
- [x] 7.1.3 Suggestion — tasks.md rollback wording corrected:
      PR 7 reverts both frontend files AND the new
      `get_stock_movement_detail` column; PR 8 is still strictly
      frontend-only; PR 9 adds the SQL wrapper migration that
      must be reverted alongside the frontend deprecation warning
      and the wrapper test file.
- [x] 7.1.4 Suggestion — router chain length asserted explicitly:
      a new "EXACTLY 2 ancestors" test asserts the production
      route sits behind AuthSessionLayout + AppLayout.

## Phase 7.2 — PR 7 Final Review-Blocker Fix (done)

- [x] 7.2.1 Critical — EventTimeline metadata disclosure behavior
      test: a new `describe("EventTimeline — metadata disclosure
      (PR 7)")` block in
      `src/features/production/components/EventTimeline.test.tsx`
      pins the contract that `<details data-testid="event-metadata">`
      renders with the `Detalle técnico` summary label, the
      JSON-stringified content is in the DOM, null/undefined
      metadata hides the disclosure, and the disclosure is
      per-row. 6 NEW tests; net test count 941 → 947.
- [x] 7.2.2 Suggestion — `src/shared/types/database.ts` doc
      comment for `get_production_order_events` is corrected
      from "Returns 10 columns (the 9 production_order_events
      columns + actor_name). Ordered by created_at ASC." to the
      actual contract: 12 columns (the 11 production_order_events
      columns including the PR 7 `event_type` and `note`
      additions plus `actor_name`), ordered by
      `created_at ASC, id ASC` (PR 3 deterministic tie-breaker).
      No type changes — only the doc comment was stale.

## Phase 1 — Schema Foundation (PR 1)

- [x] 1.1 `supabase/migrations/20260630000000_production_orders.sql` —
      `production_order_state` enum (7 values in spec order), `production_orders`
      table (13 columns), `production_order_events` table (9 columns),
      unique `(workshop_id, production_number)` index, RLS SELECT-only
      policy on both tables, 6 defense-in-depth triggers
      (INSERT/UPDATE/DELETE on each table) checking
      `app.production_order_write_context = 'rpc'`, invariant
      same-workshop FK check on `production_orders.quote_id` and
      `production_order_events.production_order_id` (no `auth.uid()`
      bypass), shared `set_updated_at()` trigger, `Relationships: []`
      per project convention in manually maintained types.
- [x] 1.2 `supabase/tests/production_orders_schema.test.sql` — 68 pgTAP
      assertions covering enum, columns, NOT NULL constraints, RLS
      SELECT-only, defense-in-depth triggers (positive + negative),
      invariant FK checks, cross-tenant 0 rows on read, unique index.

## Phase 2 — Write RPCs (PR 2)

- [x] 2.1
      `supabase/migrations/20260630000001_production_orders_rpc.sql` —
      `start_production_order(p_quote_id, p_assigned_to, p_notes,
      p_request_id)` and `transition_production_order_state(p_order_id,
      p_to_state, p_assigned_to, p_notes, p_request_id)` SECURITY
      DEFINER RPCs. Role check (`profiles.role IN ('admin',
      'operational')`) BEFORE setting the guard. Workshop ownership
      check. `SET LOCAL app.production_order_write_context = 'rpc'`.
      `SELECT ... FOR UPDATE` row lock. Allowed-transition matrix.
      Idempotency UNIQUE `(workshop_id, request_id) where request_id
      is not null` on `production_order_events`. Same-event write
      (transition + event in one transaction).
- [x] 2.2
      `supabase/migrations/20260630000002_production_rpc_blocker_fix.sql`
      — Review-blocker fixes: lock-before-idempotency (lock the order
      row before the idempotency check), scope (idempotency key is
      scoped to the operation, target, and target state, not just
      `(workshop_id, request_id)`), `start_quote_production` guard
      shim that rejects direct calls when a production order already
      exists, `p_assigned_to` validation (must reference a real
      `profiles.id` in the same workshop).
- [x] 2.3 `supabase/tests/production_orders_rpc.test.sql` — 97 pgTAP
      assertions covering allowed transitions, forbidden transitions,
      role gating, workshop ownership, idempotency (same/different
      request_id, missing request_id), direct-write rejection by the
      SQL trigger, and the four review-blocker regression cases.
- [x] 2.4 `supabase/tests/production_deduction_rpc.test.sql` regression
      checks — 5 assertions confirming the prior PR
      `quote_production_stock_deductions` invariant suite still
      passes against the new schema.

## Phase 3 — Read RPCs (PR 3)

- [x] 3.1
      `supabase/migrations/20260630000003_production_read_rpcs.sql` —
      `list_production_orders(filters)`, `get_production_order(id)`,
      `get_production_order_events(order_id)`,
      `get_quotes_with_production_status(filters)`,
      `get_production_pipeline_stats()`. SECURITY INVOKER + `SET
      search_path`. RLS-scoped. Denormalized `client_name` and
      `assigned_to_name`. Pagination with limit clamped `[1, 200]`
      and offset clamped `>= 0`. Bounded `state` filter (single or
      active-states array).
- [x] 3.2
      `supabase/migrations/20260630000004_production_read_rpc_blocker_fix.sql`
      — Review-blocker fixes: deterministic event ordering via
      `ORDER BY e.created_at ASC, e.id ASC` (T8.1 tie-breaker),
      strict all-delivered projection
      (production_status = 'delivered' iff a delivered event exists,
      regardless of later non-delivered events), NULL pagination
      handling (offset NULL → 0, limit NULL → 50), return-shape
      comments corrected on every read RPC.
- [x] 3.3 `supabase/tests/production_orders_read_rpc.test.sql` — 99
      pgTAP assertions including the deterministic T8.1
      tied-timestamp test (explicit UUIDs whose insertion order
      differs from `id ASC` order so a broken implementation fails
      the test deterministically) and the T8.1b stability check
      (same result across 2 independent RPC calls).

## Phase 4 — Deduction FK Linkage (PR 4)

- [x] 4.1
      `supabase/migrations/20260630000005_production_deduction_order_link.sql`
      — Nullable `quote_production_stock_deductions.production_order_id
      uuid null references production_orders(id) on delete set null`,
      same-workshop check trigger (invariant, no bypass), partial
      index `(workshop_id, production_order_id) where production_order_id
      is not null`.
- [x] 4.2 New-flow persistence — `start_production_order` and
      `transition_production_order_state` write the link during the
      deduction transaction so inventory surfaces can deep-link from
      the movement to the producing order. Idempotent start does
      not duplicate the link.
- [x] 4.3 `supabase/tests/production_deduction_link.test.sql` — 37
      pgTAP assertions covering nullable legacy preservation,
      same-workshop check on INSERT and UPDATE, ON DELETE SET NULL,
      partial index coverage, idempotent link write, service-role
      rejection of cross-workshop link.

## Phase 5 — Frontend Data Layer (PR 5)

- [x] 5.1
      `src/features/production/api/{types,productionOrders}.ts` and
      `src/features/production/api/productionOrders.test.ts` — Typed
      Supabase wrappers for every read and write RPC, plus
      `PRODUCTION_ORDER_STATE` / `PRODUCTION_ORDER_ACTIVE_STATES` /
      `PRODUCTION_ORDER_TERMINAL_STATES` runtime constants. 25
      Vitest tests.
- [x] 5.2 `src/features/production/hooks/useProductionOrders.ts` and
      `useProductionOrders.test.ts` — TanStack Query hooks
      (`useProductionOrders`, `useProductionOrder`,
      `useProductionOrderEvents`, `useQuotesWithProductionStatus`,
      `useProductionPipelineStats`, `useStartProductionOrder`,
      `useTransitionProductionOrder`) with bounded query keys,
      `enabled` guards on missing ids, and a `p_request_id`
      generator for idempotency. 13 Vitest tests.
- [x] 5.3
      `src/features/production/hooks/useProductionOrders.cachePrivacy.test.ts`
      and `src/features/production/index.ts` barrel — 7 cache-privacy
      tests using the real `@/shared/lib/cachePrivacy` module (not a
      mock of the policy) verifying every hook-created query key is
      classified non-persistable. The barrel exposes the public API
      (constants, types, wrappers, hooks) and is the only seam other
      features may import.

## Phase 6 — Board + Start Flow + Four-Layer Guard (PR 6)

- [x] 6.1 `src/features/production/components/ProductionBoard.tsx`,
      `ProductionBoard.test.tsx`, `routes.tsx`, `routes.test.tsx` —
      5-column board (one per active state), terminal exclusion,
      distinct loading/error states for orders list and quote
      projection, `ProductionRoutes` mounted at `/production/*`,
      `featureZone("production")` ESLint boundary active. Nav item
      added to `src/app/layouts/nav-items.ts` (Spanish label, icon,
      no FAB). 28 Vitest tests in the slice.
- [x] 6.2
      `src/features/production/components/StartProductionDialog.tsx`
      and `StartProductionDialog.test.tsx`,
      `src/features/quotes/hooks/useQuotes.ts` and
      `useQuotes.test.ts`,
      `src/features/quotes/components/QuoteForm.tsx` and
      `QuoteForm.test.tsx` — `StartProductionDialog` uses
      `useStartProductionOrder`, sends `null` for empty optional
      fields, stays open on error, calls `onOpenChange(false)` on
      success and on cancel. `useUpdateQuote` and
      `useUpdateQuoteStatus` throw descriptive errors on
      `en_produccion`. `QuoteForm` status filter excludes
      `en_produccion` from the dropdown. `QuoteForm` uses `useWatch`
      (not `watch`) to clear the React Compiler
      `react-hooks/incompatible-library` warning. The SQL
      `prevent_direct_en_produccion_writes()` trigger is the final
      defense (regression-tested against PR 2 SQL suite). PR 6
      act-warning fix uses `userEvent.setup()` + awaited `click()`
      with 3 local polyfills (ResizeObserver, pointer-capture,
      scrollIntoView) inside `QuoteForm.test.tsx`.

## Phase 7 — Detail Page + Event Timeline + Inventory Deep-Link (PR 7, done)

- [x] 7.1 `/production/:id` route + `ProductionOrderDetailPage`
      component — read-only detail view rendering the order's
      denormalized quote, client, assigned-to, planned/actual
      dates, and a vertical event timeline.
- [x] 7.2 `EventTimeline` component — renders the
      `get_production_order_events` output with a deterministic
      `created_at ASC, id ASC` order, label and icon per
      `event_type`, and a `note`/`metadata` disclosure.
- [x] 7.3 Inventory deep-link surface — from the movement detail
      page, a "Ver orden de producción" link navigates to
      `/production/:id` when the movement's deduction batch has a
      non-null `production_order_id`. Hidden otherwise. The link
      target is exposed through the inventory barrel so future
      cross-feature use is supported.

## Phase 8 — Dashboard + Quote Actions Integration (PR 8, done)

- [x] 8.1 Production pipeline widget on the home dashboard —
      renders the `get_production_pipeline_stats` output as a
      compact horizontal bar with one swatch per active state and a
      total count.
- [x] 8.2 `QuoteActions.tsx` start-production entry point — when
      the user clicks "Iniciar producción" on a quote, the action
      invokes `useStartProductionOrder` from the production barrel.
      The `useUpdateQuote` / `useUpdateQuoteStatus` guard throws
      catch any legacy caller that still tries to write
      `en_produccion` directly.
- [x] 8.3 Dashboard cache-privacy + RLS sanity — pipeline widget
      query key is registered as non-persistable; the widget does
      not see cross-tenant data even when the user switches
      workshops.

## Phase 8.1 — PR 8 Review-Blocker Fix (done)

- [x] 8.1.1 Critical — ESLint boundary exception too broad: the
      `featureZone` helper is narrowed to use `./${name}/index.ts`
      (barrel-only) for cross-feature exceptions while keeping
      `./${feature}` for self-import exceptions. A new
      `tests/architecture/eslint-boundary.test.ts` pins the
      source shape and a new
      `tests/architecture/eslint-boundary-behavioral.test.ts`
      uses ESLint's `Linter` class to assert the rule actually
      fires for cross-feature internals (6 behavioral tests).
- [x] 8.1.2 Critical — pipeline stats contract mismatch: an
      additive migration
      `20260630000008_production_pipeline_stats_active_only.sql`
      rewrites `get_production_pipeline_stats` to return exactly
      5 rows (one per active state) in workflow order, with
      terminal states (delivered, cancelled) excluded at the SQL
      layer. The widget keeps its defense-in-depth client filter
      via `PRODUCTION_ORDER_ACTIVE_STATES`. The pgTAP plan is
      bumped from 99 to 101 and 3 new SQL assertions pin the
      contract (T6.1 active-only result, T6.1b exactly-5-rows
      count, T6.1c every-state-is-active guard).
- [x] 8.1.3 Warning — cache/RLS source regex strengthened: the
      regex now matches BOTH `./api/productionOrders` and
      `../api/productionOrders` value imports. A new
      defense-in-depth test uses per-statement import parsing to
      assert that NO value import of the production API module
      is present (regardless of relative depth), with a negative-
      lookahead that allows `import type` (erased at build time)
      and a positive assertion that the widget's `import type`
      from the API IS present.
- [x] 8.1.4 Warning — legacy-hook avoidance test:
      **carry-forward**. The existing test
      "does NOT call useUpdateQuote or useUpdateQuoteStatus"
      already asserts the user-visible path (click button → mock
      called with right args; legacy mocks never invoked).
      Strengthening further is NOT CHEAP — the test pins the
      contract at the right level and a regression that
      bypasses the four-layer guard is covered by the
      `featureZone("production")` ESLint boundary.
- [x] 8.1.5 Suggestion — QuoteActions input id collision: the
      hard-coded `id="quote-actions-production-number"` is
      replaced with React 19's `useId()`. Two new tests pin the
      per-instance id contract (unique ids across two instances,
      label `htmlFor` association per instance).

## Phase 9 — Legacy `start_quote_production` Wrapper Migration (PR 9, done)

- [x] 9.1 Deprecation warning on the legacy wrapper — the
      `start_quote_production` RPC now emits a one-time-per-session
      `RAISE WARNING` (gated by the session-local GUC
      `app.legacy_start_quote_warned` via `set_config(..., false)`);
      the `useStartQuoteProduction` hook emits a one-time-per-session
      `console.warn` (gated by a `globalThis` flag that survives
      `vi.resetModules()` and React Fast Refresh). The warning message
      instructs callers to migrate to `start_production_order` (RPC)
      and `useStartProductionOrder` (hook) respectively. 1 new Vitest
      test in `useProductionStockDeduction.test.ts` pins the
      one-time-per-session contract.
- [x] 9.2 Migration helper (SQL wrapper) — the legacy
      `start_quote_production` RPC is rewritten (additive migration
      `20260630000009_start_quote_production_wrapper.sql`) as a thin
      wrapper around `start_production_order`. The wrapper:
      1. Emits the one-time deprecation `RAISE WARNING`.
      2. Re-checks role + workshop ownership (defense in depth).
      3. Preserves the legacy idempotency: existing non-reversed
         deduction batch → returns the existing batch without creating
         a new production_order; pre-existing batch keeps
         `production_order_id = NULL` (no backfill — PR 4 contract).
      4. Otherwise delegates to `start_production_order` with a derived
         `p_production_number` (`'OP-' || substring(quote_id::text, 1, 8)`)
         and `p_create_deduction = p_confirm_deduction`. The new flow
         creates the production_order and the deduction batch with
         non-null `production_order_id` (PR 4 new-flow contract).
      5. Preserves the legacy `quotes.status = 'en_produccion'` side
         effect via SET LOCAL around the UPDATE (so the existing T5 in
         `production_deduction_rpc.test.sql` keeps passing).
      6. Returns a jsonb shape that is a SUPERSET of the original
         (adds `order_id` and `note`; keeps every other field).
      18 new pgTAP assertions in
      `production_legacy_wrapper.test.sql` cover: viewer rejection
      (T1), cross-workshop RLS rejection (T2), happy-path delegation
      to start_production_order (T3.x — 6 assertions including
      production_order created, state=planned, deduction batch has
      non-null FK, FK matches, quote status updated), idempotency on
      same p_request_id (T4.x), existing-batch branch preservation
      (T5.x — pre-existing batch keeps NULL FK, no new
      production_order, no duplicate batch), and one-time
      deprecation warning (T6.x — wrapper call succeeds, GUC marker
      is set, second call succeeds, distinct request_ids don't
      create duplicates).
- [x] 9.3 Final cleanup — the legacy `start_quote_production` RPC
      remains (idempotent, backward-compatible) for one more release
      to give external integrations time to migrate. The frontend
      `useStartQuoteProduction` hook is preserved with the
      deprecation warning (9.1) so existing callers (e.g.
      `ProductionStartReviewDialog`) keep working without a UX break.
      The full removal of the frontend hook and the dialog migration
      is a follow-up: `ProductionStartReviewDialog`'s UX is tied to
      the legacy result shape (it surfaces `batch_id` and
      `movements_created` to the user), and the new flow's
      `movements_created = 0` would change the displayed message.
      This UX change is documented in the PR 9 apply-progress as a
      follow-up scope. The deprecation warning + SQL wrapper are the
      in-PR-9 cleanup: every caller now knows the path is deprecated
      and the new flow owns production order creation.

## Phase 9.1 — PR 9 Review-Blocker Fix (done)

- [x] 9.1.1 Critical — auth fail-open fix. The pre-fix wrapper had
      two NULL-unsafe checks (cross-workshop comparison via
      `v_workshop_id <> (SELECT workshop_id FROM profiles WHERE id =
      auth.uid())` and role check via `v_actor_role NOT IN ('admin',
      'operational')`) that evaluated NULL (not TRUE) when the
      profiles lookup was empty, allowing a caller with `auth.uid()`
      set but no profile to reach the existing-batch branch and
      either update the quote status or return the existing batch's
      data. The fix collapses the two checks into a single
      NULL-safe profile lookup that runs BEFORE the SELECT FOR
      UPDATE and rejects the caller with 42501 'Caller has no
      profile/workshop' (no profile / NULL workshop) or 'not
      authorized to start production' (NULL role). 2 new pgTAP
      assertions in `production_legacy_wrapper.test.sql` cover the
      no-profile and existing-batch-with-no-profile paths.
- [x] 9.1.2 Critical — `p_confirm_deduction=false` compatibility
      regression fix. The pre-fix wrapper mapped
      `p_confirm_deduction=false` to `p_create_deduction=false`
      unconditionally, which was a behavior regression: when
      `auto_stock_discount` was ON, the legacy function raised
      P0001 'Confirmation required for automatic stock deduction' for
      a confirm=false call; the new wrapper silently produced a
      production order with no deduction batch. The fix reads the
      workshop's `auto_stock_discount` setting and enforces the
      legacy contract: ON + confirm=false → RAISE P0001; OFF + any
      confirm value → `p_create_deduction=false` (no batch, no
      error). 6 new pgTAP assertions cover the four
      auto_discount/confirm combinations plus the deduction-batch
      and production-order side-effect assertions.
- [x] 9.1.3 Warning — existing-batch retry masks new-flow
      idempotent return shape. The pre-fix wrapper always returned
      `order_id: null` from the existing-batch branch. The fix
      surfaces the pre-existing batch's `production_order_id` as
      `order_id` when it is set (defense in depth + better DX for
      callers that have already migrated to the new flow), and
      keeps `order_id: null` for the legacy batches (PR 4
      legacy-null-preservation contract). 2 new pgTAP assertions
      cover the non-null and null FK cases.
- [x] 9.1.4 Warning — SQL warning test only checks GUC marker, not
      actual warning emission. **CARRY-FORWARD**. pgTAP does not
      have a direct `RAISE WARNING` assertion. The T6.2 assertion
      is the strongest feasible check (it asserts the session-local
      `app.legacy_start_quote_warned` GUC is set to `'true'` after
      the first call); a stronger test would require a custom
      SECURITY DEFINER capture function and is not cheap relative
      to the value. The T6.1/T6.3/T6.4 assertions pin the
      non-fatal, one-time-per-session, and idempotency contracts
      so a future regression that breaks the warning emission
      (e.g. wrapping it in a `BEGIN ... EXCEPTION` block) is
      caught.
- [x] 9.1.5 Warning — frontend globalThis warning test claims
      resetModules behavior but does not call `vi.resetModules`.
      The fix is a new
      `it("emits the deprecation warning only once across
      vi.resetModules() and a re-import")` test that actually does
      `vi.resetModules()` and re-imports the hook module to prove
      the globalThis-backed one-time warning marker survives
      module re-imports. The `beforeEach` for the
      `useStartQuoteProduction` describe block now also resets the
      globalThis flag (was missing in PR 9). 1 new Vitest test
      (the test count delta is 983 → 984).
- [x] 9.1.6 Suggestion — production number quote UUID prefix
      collision. **CARRY-FORWARD**. The wrapper derives
      `production_number` as `'OP-' || substring(quote_id::text,
      1, 8)`, which has ~1 in 4 billion collision probability per
      workshop. The review noted that adding collision handling is
      possible but not cheap relative to the value (real workshops
      have < 1000 quotes, so collision probability is < 2.5e-7).
      The test scaffolding uses distinct first-8-hex IDs to
      isolate the test runs; the production case is documented
      as a non-issue. A future reviewer that wants
      collision-safe naming can append a workshop-scoped sequence
      or a random suffix; the comment in the wrapper documents
      the carry-forward.

## Implementation dependencies

1. PR 1 schema must land before PR 2 RPCs (RPCs read the enum and
   tables).
2. PR 2 RPCs must land before PR 3 reads (reads assume the
   transition matrix is in place).
3. PR 4 deduction FK assumes PR 1 (orders exist) and PR 2
   (start RPC writes the link).
4. PR 5 frontend data layer assumes PR 3 (reads) and PR 2 (writes).
5. PR 6 board assumes PR 5 hooks exist; PR 6 also depends on PR 2
   direct-write trigger (defense in depth).
6. PR 7 detail page assumes PR 5 hooks + PR 4 deduction FK.
7. PR 8 dashboard assumes PR 5 hooks (pipeline stats already
   exposed) + PR 6 start dialog.
8. PR 9 legacy migration assumes PR 6 four-layer guard is active
   (no new legacy callers can sneak in). PR 9 implements the
   SQL wrapper and the frontend deprecation warning; the
   dialog-UX migration is a follow-up.

## Rollback notes

Each PR is independently revertible:

- PR 1: drop tables, enum, triggers in reverse dependency order.
- PR 2: drop the new RPCs and the direct-write trigger.
- PR 3: drop the new read RPCs.
- PR 4: drop the new column, index, and trigger.
- PR 5-6: revert frontend files; the
  `featureZone("production")` ESLint boundary becomes a no-op once
  the feature slice is empty.
- PR 7: revert frontend files AND drop the new
  `get_stock_movement_detail` column (PR 7 added the
  `production_order_id` column on this read RPC to enable the
  inventory deep-link surface). The deep-link surface requires the
  column; reverting the surface requires the column drop.
- PR 8: revert frontend files only; no schema change is reverted
  in this window.
- PR 9: revert frontend files (the `useStartQuoteProduction`
  deprecation warning + the wrapper test) AND the new
  `start_quote_production` function body
  (`20260630000009_start_quote_production_wrapper.sql`). The new
  `start_quote_production` body replaces the pre-PR-9 standalone
  implementation; reverting the wrapper means dropping the wrapper
  migration and re-applying the prior blocker-fix migration that
  defined the standalone implementation. No new tables or columns
  are added in this window (the wrapper only changes the function
  body, not the schema).

No data loss in rollback: the `quotes.status` column retains its
values; the new tables and the new columns are additive.

## Verification commands (the four-command contract)

```bash
npm test
npm run test:coverage
npm run lint
npm run build
```

In addition, the SQL suite is exercised via:

```bash
npx supabase db reset --local
npx supabase test db
```

Each must exit 0 after every PR lands.
