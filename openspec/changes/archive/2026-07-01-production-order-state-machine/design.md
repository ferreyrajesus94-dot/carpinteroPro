# Design: Production Order State Machine

## Technical approach

Move production off `quotes.status` and onto a first-class
`production_orders` entity with a SQL-owned state machine, an
append-only event log, and a typed frontend data layer. The change
is split into nine chained work-unit PRs to keep every slice under
the 400-line review budget declared in `openspec/config.yaml`.

The architectural shape:

- **Schema (PR 1)**: `production_orders` + `production_order_events`
  with SELECT-only RLS, defense-in-depth triggers, and an
  invariant same-workshop FK check that fires regardless of the
  internal write guard or `service_role`.
- **Write RPCs (PR 2)**: `start_production_order` and
  `transition_production_order_state` are the only sanctioned write
  paths. SECURITY DEFINER + transaction-local GUC
  `app.production_order_write_context = 'rpc'` + `FOR UPDATE` row
  lock + idempotency by `(workshop_id, p_request_id)`. A SQL trigger
  forbids direct `quotes.status = 'en_produccion'` writes.
- **Read RPCs (PR 3)**: SECURITY INVOKER, RLS-scoped, denormalized
  client/quote/assigned-to names for N+1 elimination, deterministic
  event ordering via `created_at ASC, id ASC`.
- **Inventory link (PR 4)**: nullable
  `quote_production_stock_deductions.production_order_id` with a
  same-workshop check, `ON DELETE SET NULL`, and a partial index for
  the inventory join.
- **Frontend data layer (PR 5)**: typed Supabase wrappers + TanStack
  Query hooks in `src/features/production/` with cache-privacy tests
  against the real policy module.
- **Board + start flow (PR 6)**: `/production` route, 5-column
  Kanban-style board, `StartProductionDialog`, four-layer
  en_produccion guard (hook/hook/UI/SQL), `featureZone("production")`
  ESLint boundary.
- **Detail page (PR 7, done)**: `/production/:id`, event timeline,
  inventory deep-link surface.
- **Dashboard + quote integration (PR 8, done)**: pipeline stats
  widget, quote actions wired to `useStartProductionOrder`.
- **Legacy wrapper (PR 9, done)**: deprecate
  `start_quote_production` and migrate any remaining callers. The
  legacy RPC is a thin SECURITY INVOKER wrapper around
  `start_production_order` (additive migration
  `20260630000009_start_quote_production_wrapper.sql`) that
  preserves the legacy role/workshop/RLS safety (with a
  NULL-safe profile lookup added in PR 9.1), the legacy
  `p_confirm_deduction=false` semantics (reinstated in PR 9.1),
  and the existing-batch idempotency contract (now surfaces the
  pre-existing batch's `production_order_id` as `order_id` when
  set, per PR 9.1). The frontend `useStartQuoteProduction` hook
  emits a one-time-per-session `console.warn` and a
  `globalThis`-backed marker that survives `vi.resetModules()`
  and React Fast Refresh.

## Architecture decisions

| Option | Tradeoff | Decision |
|---|---|---|
| First-class `production_orders` vs `quotes.status` extensions | A quote is a sales artifact, not a production artifact. Trying to model pause/resume/quality-check on `quotes.status` would explode the enum and lose the audit log. | Introduce `production_orders`; `quotes.status = 'en_produccion'` becomes a derived signal. |
| SQL-owned state machine vs application-owned | Application-owned state is portable but loses transactional consistency with the event log. SQL-owned lets us use `FOR UPDATE` row locks, `SET LOCAL` guards, and a single trigger source. | SQL-owned. The frontend sends `transition_production_order_state` RPC calls; the state enum lives in Postgres. |
| Defense-in-depth trigger vs single-layer RLS | Single-layer RLS is simpler but cannot guard the internal write context; a permissive policy is sometimes needed for tests and migrations. | RLS absence (default deny) + a `BEFORE INSERT/UPDATE/DELETE` trigger that checks `app.production_order_write_context = 'rpc'`. Triggers are idempotent and testable. |
| Internal guard as session GUC vs transaction GUC | Session GUC is easy to leak between requests; transaction GUC is set via `SET LOCAL` and dies at COMMIT/ROLLBACK. | `SET LOCAL app.production_order_write_context = 'rpc'`. Use `current_setting(name, true)` (NULL-safe) to read. |
| Same-workshop check as `auth.uid()`-aware vs invariant | An `auth.uid()`-aware check can be bypassed by `service_role`. An invariant check is correct regardless of caller. | Invariant: `production_orders.quote_id` and `production_order_events.production_order_id` must match the parent's `workshop_id`, with no `auth.uid() IS NULL` bypass. |
| Idempotency as `p_request_id` UNIQUE constraint vs app-side dedupe | UNIQUE is the only correct way under network retry. | `(workshop_id, request_id)` UNIQUE on `production_order_events` (and on the deduction batch for cross-feature idempotency). |
| Append-only events as separate table vs JSON column on `production_orders` | A separate table with RLS lets us surface event history in the UI without re-parsing JSON, and lets SQL guards prevent in-place edits. | Separate `production_order_events` table. |
| Internal `app.production_order_write_context` GUC name vs short alias | Short aliases leak into more code; longer names are self-documenting. | `app.production_order_write_context` everywhere (migration, design, spec, tasks). |
| Forced chained strategy vs single PR | A full production-order slice is easily 2000+ lines; the 400-line budget forbids a single PR. | `force-chained` per session preflight; nine work units; tracker branch not used (direct-to-main as prior changes did). |
| `featureZone("production")` ESLint boundary vs no boundary | Without a boundary, cross-feature imports into `production/` will accumulate. | `featureZone("production")` is active from PR 6; only the production barrel may be imported by other features. |
| Nullable `production_order_id` on deduction batch vs required | The deduction can pre-date the production order (legacy flow) and the link is for traceability, not correctness. | Nullable. The link is "best effort, deep-linkable when set". |
| `ON DELETE SET NULL` vs `ON DELETE CASCADE` for the FK | A production order should not own the deduction batch. If the order is deleted (admin mistake), the deduction history must survive. | `ON DELETE SET NULL`. |

## Data model

### 1. `production_orders`

| Column | Contract |
|---|---|
| `id uuid primary key default gen_random_uuid()` | Order identity. |
| `workshop_id uuid not null references workshops(id)` | Tenant isolation; indexed; RLS required. |
| `quote_id uuid not null references quotes(id) on delete restrict` | The originating quote. Restrict-delete prevents accidental cascade from a quote removal. |
| `production_number text not null` | Human-readable label per workshop. |
| `state production_order_state not null default 'planned'` | Workflow state. |
| `assigned_to uuid null references profiles(id) on delete set null` | Optional operator. |
| `planned_start_date date null` | Workshop-entered target. |
| `planned_end_date date null` | Workshop-entered target. |
| `actual_start_date timestamptz null` | Set when the order first enters `in_progress`. |
| `actual_end_date timestamptz null` | Set when the order reaches a terminal state. |
| `notes text null` | Free-form operator notes. |
| `created_at timestamptz not null default now()` | Audit. |
| `updated_at timestamptz not null default now()` | Updated by shared `set_updated_at()` trigger. |
| `created_by uuid null` | `auth.uid()` at creation. |

Constraints and indexes:

- `unique (workshop_id, production_number)`.
- RLS SELECT only, scoped to `workshop_id = get_current_workshop_id()`.
- No INSERT/UPDATE/DELETE policies for authenticated roles.
- 3 defense-in-depth triggers (INSERT, UPDATE, DELETE) checking
  `app.production_order_write_context = 'rpc'`.
- 1 same-workshop FK check trigger (invariant, no bypass).

### 2. `production_order_events`

| Column | Contract |
|---|---|
| `id uuid primary key default gen_random_uuid()` | Event identity. |
| `workshop_id uuid not null` | Tenant isolation. |
| `production_order_id uuid not null references production_orders(id) on delete cascade` | The parent order; cascade keeps the event log with the order. |
| `event_type text not null` | e.g. `created`, `transitioned`, `paused`, `resumed`, `cancelled`, `delivered`. |
| `from_state production_order_state null` | Previous state; null on creation. |
| `to_state production_order_state null` | New state; null on metadata-only events. |
| `actor uuid null` | `auth.uid()` at event time. |
| `note text null` | Optional human note. |
| `metadata jsonb not null default '{}'::jsonb` | Free-form audit context. |
| `created_at timestamptz not null default now()` | Event time. |

Constraints and indexes:

- RLS SELECT only, scoped to `workshop_id = get_current_workshop_id()`.
- No INSERT/UPDATE/DELETE policies for authenticated roles.
- 3 defense-in-depth triggers (INSERT, UPDATE, DELETE) checking
  `app.production_order_write_context = 'rpc'`.
- 1 same-workshop FK check trigger (invariant, no bypass).
- `unique (workshop_id, request_id) where request_id is not null`
  (idempotency).

### 3. Nullable `quote_production_stock_deductions.production_order_id`

| Column | Contract |
|---|---|
| `production_order_id uuid null references production_orders(id) on delete set null` | Best-effort deep-link. |
| Partial index `(workshop_id, production_order_id) where production_order_id is not null` | Inventory join performance. |
| Same-workshop check trigger (invariant, no bypass) | Workshop A's deduction cannot link to workshop B's order. |

## Internal write guard

### 1. GUC name and value

- Name: `app.production_order_write_context`
- Value when sanctioned: `'rpc'`
- Read: `current_setting('app.production_order_write_context', true)`
  (second arg `true` returns NULL on missing setting; `IS DISTINCT FROM`
  is NULL-safe)

### 2. Transaction-local, not session-local

PR-2 RPCs MUST use `SET LOCAL app.production_order_write_context =
'rpc'`, not `set_config(..., false)` (which is session-local). The
trigger uses `current_setting(name, true)` to read the GUC; if the GUC
is not set, the read returns NULL, and the trigger rejects the write
with 42501.

### 3. Order of operations inside PR-2 RPCs

1. Role check: `profiles.role IN ('admin', 'operational')` MUST happen
   BEFORE setting the guard.
2. Workshop ownership check: caller must own the order's
   `workshop_id`.
3. Transition matrix check: requested transition MUST be allowed.
4. `SELECT ... FOR UPDATE` row lock.
5. `SET LOCAL app.production_order_write_context = 'rpc'`.
6. UPDATE `production_orders.state`, INSERT `production_order_events`,
   in a single transaction.
7. (If start): call the deduction capture/start RPCs through the
   guarded path; the deduction writer MUST preserve the
   `production_order_id` link.

## File changes (canonical, post-merge)

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260630000000_production_orders.sql` | Created | PR 1: enum, tables, RLS, defense-in-depth triggers, same-workshop FK checks. |
| `supabase/migrations/20260630000001_production_orders_rpc.sql` | Created | PR 2: `start_production_order` and `transition_production_order_state` RPCs, idempotency UNIQUE, direct-write trigger. |
| `supabase/migrations/20260630000002_production_rpc_blocker_fix.sql` | Created | PR 2 review-blocker fixes: lock-before-idempotency, scope, role validation. |
| `supabase/migrations/20260630000003_production_read_rpcs.sql` | Created | PR 3: list/get/events/projection/stats read RPCs. |
| `supabase/migrations/20260630000004_production_read_rpc_blocker_fix.sql` | Created | PR 3 review-blocker fixes: deterministic event ordering, strict delivered projection, NULL pagination. |
| `supabase/migrations/20260630000005_production_deduction_order_link.sql` | Created | PR 4: nullable FK + same-workshop check + partial index. |
| `supabase/tests/production_orders_schema.test.sql` | Created | PR 1: 68 pgTAP assertions. |
| `supabase/tests/production_orders_rpc.test.sql` | Created | PR 2: 97 pgTAP assertions. |
| `supabase/tests/production_orders_read_rpc.test.sql` | Created | PR 3: 99 pgTAP assertions. |
| `supabase/tests/production_deduction_link.test.sql` | Created | PR 4: 37 pgTAP assertions. |
| `supabase/tests/production_deduction_rpc.test.sql` | Modified | PR 2 regression. |
| `src/shared/types/database.ts` | Modified | PR 5: manually maintained types for new tables, RPCs, enums; `Relationships: []` per project convention. |
| `src/features/production/api/types.ts` | Created | PR 5: `PRODUCTION_ORDER_STATE`, `PRODUCTION_ORDER_ACTIVE_STATES`, `PRODUCTION_ORDER_TERMINAL_STATES`. |
| `src/features/production/api/productionOrders.ts` | Created | PR 5: typed Supabase wrappers. |
| `src/features/production/api/productionOrders.test.ts` | Created | PR 5: 25 RPC-wrapper tests. |
| `src/features/production/hooks/useProductionOrders.ts` | Created | PR 5: TanStack Query hooks. |
| `src/features/production/hooks/useProductionOrders.test.ts` | Created | PR 5: 13 hook tests. |
| `src/features/production/hooks/useProductionOrders.cachePrivacy.test.ts` | Created | PR 5: 7 cache-privacy tests against the real module. |
| `src/features/production/routes.tsx` | Created | PR 6: `ProductionRoutes` mounted at `/production/*`. |
| `src/features/production/routes.test.tsx` | Created | PR 6: route tests. |
| `src/features/production/components/ProductionBoard.tsx` | Created | PR 6: 5-column board. |
| `src/features/production/components/ProductionBoard.test.tsx` | Created | PR 6: board tests. |
| `src/features/production/components/StartProductionDialog.tsx` | Created | PR 6: start dialog. |
| `src/features/production/components/StartProductionDialog.test.tsx` | Created | PR 6: dialog tests. |
| `src/features/production/index.ts` | Created | PR 5-6: feature barrel. |
| `src/features/quotes/hooks/useQuotes.ts` | Modified | PR 6: throw on `en_produccion` from `useUpdateQuote` and `useUpdateQuoteStatus`. |
| `src/features/quotes/hooks/useQuotes.test.ts` | Modified | PR 6: tests for the throw. |
| `src/features/quotes/components/QuoteForm.tsx` | Modified | PR 6: filter `en_produccion` from status dropdown; `useWatch` not `watch`. |
| `src/features/quotes/components/QuoteForm.test.tsx` | Modified | PR 6: status filter tests + act-warning fix. |
| `src/app/router.tsx` | Modified | PR 6: mount `<ProductionRoutes />`. |
| `src/app/router.test.ts` | Created | PR 6: route/nav tests. |
| `src/app/layouts/nav-items.ts` | Modified | PR 6: production nav item. |
| `src/app/layouts/nav-items.test.ts` | Created | PR 6: nav tests. |
| `eslint.config.js` | Modified | PR 6: `featureZone("production")` boundary. |
| `.gitignore` | Modified | PR 1-6: `.engram/`, `supabase/.temp/`. |

## Interfaces / contracts

### Allowed transition matrix

| From | To (allowed) |
|---|---|
| `planned` | `in_progress`, `cancelled` |
| `in_progress` | `paused`, `quality_check`, `cancelled` |
| `paused` | `in_progress`, `cancelled` |
| `quality_check` | `in_progress`, `ready`, `cancelled` |
| `ready` | `delivered`, `cancelled` |
| `delivered` | (terminal) |
| `cancelled` | (terminal) |

Forbidden transitions raise 23514. Terminal states reject all
transitions.

### Read RPC shape

`get_quotes_with_production_status(filters)` returns one row per
quote:

```ts
type QuoteWithProductionStatus = {
  id: string;
  workshop_id: string;
  status: QuoteStatus;
  production_status: ProductionStatus;
  client_name: string | null;
  total: number | null;
  updated_at: string;
  production_order_id: string | null;
  assigned_to_name: string | null;
};
```

### Cache-privacy contract

Every query key the production hooks create is registered in
`useProductionOrders.cachePrivacy.test.ts` and verified as
non-persistable against the real cache-privacy module
(`@/shared/lib/cachePrivacy`).

## Testing strategy

| Layer | What to test | Approach |
|---|---|---|
| Schema (PR 1) | enum values, RLS, defense-in-depth triggers, FK invariants | 68 pgTAP assertions in `production_orders_schema.test.sql`. |
| Write RPCs (PR 2) | transition matrix, role gating, idempotency, direct-write rejection | 97 pgTAP assertions in `production_orders_rpc.test.sql`. |
| Read RPCs (PR 3) | denormalization, deterministic ordering, cross-tenant safety | 99 pgTAP assertions in `production_orders_read_rpc.test.sql`. |
| Deduction FK (PR 4) | nullable, same-workshop check, ON DELETE SET NULL, idempotent link write | 37 pgTAP assertions in `production_deduction_link.test.sql`. |
| Frontend wrappers (PR 5) | typed RPC inputs/outputs, error mapping | 25 Vitest tests. |
| TanStack hooks (PR 5) | query key, enabled, onSuccess, onError, cache invalidation | 13 Vitest tests. |
| Cache privacy (PR 5) | every hook key classified non-persistable by the real module | 7 Vitest tests. |
| Board (PR 6) | 5 columns, terminal exclusion, loading/error split | Vitest + RTL. |
| Start dialog (PR 6) | success close, error open, null optional fields | Vitest + RTL. |
| Routes/nav (PR 6) | mount at `/production/*`, nav item rendered | Vitest + RTL. |
| Four-layer guard (PR 6) | hook throw, hook throw, UI filter, SQL trigger regression | Vitest + pgTAP. |

## Migration / rollout

- Schema first (PR 1): enum, tables, RLS, triggers, FK checks.
- Write RPCs next (PR 2): start + transition + idempotency +
  direct-write guard. Test the lock order and the SET LOCAL
  cleanup.
- Read RPCs (PR 3): list/get/events/projection/stats. Test the
  deterministic event ordering with explicit UUID fixtures.
- Deduction FK (PR 4): nullable link with same-workshop check.
  Restore the prior test file (recovered from the PR 4 incident).
- Frontend data layer (PR 5): types, RPC wrappers, hooks, cache
  privacy.
- Board + start flow (PR 6): production board, start dialog, four
  layers of guard, ESLint boundary, lint/act-warning fixes.
- PR 7-9: deferred to future slices; no migration or schema change
  is blocked on them.

Rollback: each PR is independently revertible. Schema drops are
cascading. Frontend reverts remove the feature slice cleanly because
`featureZone` enforcement means no other feature depends on it yet
(other than the four-layer guard that protects existing callers).

## Open questions

- [ ] Confirm PR 7 inventory deep-link target route shape
      (`/production/:id` vs `/produccion/:id` for the workshop's
      Spanish locale).
- [ ] Confirm PR 8 dashboard pipeline stats widget key naming
      (could be `useProductionPipelineStats` exposed in PR 5 vs a new
      `useProductionDashboard` aggregate hook).
- [ ] Confirm PR 9.1 production_number collision handling — the
      wrapper currently derives `production_number` as `'OP-' ||
      substring(quote_id::text, 1, 8)`, which has ~1 in 4 billion
      collision probability per workshop. The review noted that
      adding collision handling is possible but not cheap relative
      to the value; the carry-forward documents the trade-off. A
      future reviewer that wants collision-safe naming can append a
      workshop-scoped sequence or a random suffix.
