# Delta for Production Orders

## ADDED Requirements

## Domain: Production Orders

### Purpose

Track the lifecycle of a workshop's production work as a first-class
entity with a proper state machine, append-only event log, and
SQL-owned transition rules. The `production_orders` table is the source
of truth for which jobs are running, who is responsible, when they
started, and how they ended. Inventory deduction and the legacy
`quotes.status` flag become derived/secondary signals.

### Requirements

### Requirement: Production Orders Table

The system MUST provide a `production_orders` table with columns:
`id uuid PK`, `workshop_id uuid NOT NULL REFERENCES workshops(id)`,
`quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE RESTRICT`,
`production_number text NOT NULL`, `state production_order_state NOT NULL
DEFAULT 'planned'`, `assigned_to uuid NULL REFERENCES profiles(id) ON
DELETE SET NULL`, `planned_start_date date NULL`, `planned_end_date
date NULL`, `actual_start_date timestamptz NULL`, `actual_end_date
timestamptz NULL`, `notes text NULL`, `created_at timestamptz NOT NULL
DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`, and
`created_by uuid NULL`. The table MUST have a unique
`(workshop_id, production_number)` index. RLS MUST be enabled with
exactly one SELECT policy scoped by
`workshop_id = get_current_workshop_id()`; INSERT/UPDATE/DELETE
policies MUST NOT exist for authenticated users.

#### Scenario: Unique production number per workshop

- GIVEN a workshop with an existing production order with
  `production_number = 'OP-2026-0001'`
- WHEN a second order in the same workshop is inserted with the same
  `production_number`
- THEN the insert is rejected with a unique-constraint violation

#### Scenario: State defaults to planned

- GIVEN a new production order is inserted
- WHEN no explicit `state` is provided
- THEN the row is stored with `state = 'planned'`

### Requirement: Production Order State Enum

The system MUST define a `production_order_state` enum with exactly
seven values in this order: `planned`, `in_progress`, `paused`,
`quality_check`, `ready`, `delivered`, `cancelled`. The order MUST be
the order the values are declared in the migration so a future
`enum_range()` call returns the values in workflow order.

#### Scenario: Enum has the seven values

- GIVEN a fresh database
- WHEN `enum_range(NULL::production_order_state)` is invoked
- THEN the result lists `planned`, `in_progress`, `paused`,
  `quality_check`, `ready`, `delivered`, `cancelled` in that order

### Requirement: Append-only Audit Events

The system MUST provide a `production_order_events` table with columns:
`id uuid PK`, `workshop_id uuid NOT NULL`, `production_order_id uuid
NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE`,
`event_type text NOT NULL`, `from_state production_order_state NULL`,
`to_state production_order_state NULL`, `actor uuid NULL`, `note text
NULL`, `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`, and `created_at
timestamptz NOT NULL DEFAULT now()`. RLS MUST expose exactly one
SELECT policy scoped by `get_current_workshop_id()`. The table MUST NOT
expose INSERT/UPDATE/DELETE policies for authenticated users; writes
MUST flow exclusively through the `transition_production_order_state`
and `start_production_order` RPCs.

#### Scenario: Authenticated direct INSERT is rejected

- GIVEN an authenticated user
- WHEN the user attempts to insert a row directly into
  `production_order_events`
- THEN the database rejects the write with permission denied (42501)

#### Scenario: Authenticated direct UPDATE/DELETE is rejected

- GIVEN an existing event row
- WHEN an authenticated user attempts to update or delete it
- THEN the database reports 0 affected rows

#### Scenario: Defense-in-depth trigger blocks direct UPDATE/DELETE

- GIVEN a permissive RLS policy is temporarily granted to test
  triggers
- WHEN an authenticated user attempts to update or delete an event
- THEN a trigger raises 42501 and rejects the write

### Requirement: Cross-tenant SELECT is blocked

The system MUST scope every `production_orders` and
`production_order_events` SELECT policy by
`workshop_id = get_current_workshop_id()`. A user from workshop A MUST
NOT be able to read or detect the existence of rows owned by workshop
B. The defense-in-depth `production_order_write_context` GUC MUST be
irrelevant for reads.

#### Scenario: User A cannot see workshop B rows

- GIVEN workshop A and workshop B each have a production order
- WHEN user A queries `production_orders`
- THEN the result contains only workshop A rows

### Requirement: Role-gated Transition RPC

The system MUST provide a `transition_production_order_state` RPC that
is the only sanctioned path for changing a `production_orders.state`
value. The RPC MUST be `SECURITY DEFINER`, MUST set a transaction-local
GUC `app.production_order_write_context = 'rpc'` via `SET LOCAL`
BEFORE performing the UPDATE, MUST verify the caller has a workshop
role of `admin` or `operational`, MUST verify the workshop owns the
order, MUST verify the requested transition is allowed by the
transition matrix, MUST acquire a row lock `FOR UPDATE`, MUST insert a
`production_order_events` row in the same transaction, and MUST return
the updated order.

#### Scenario: Allowed transition succeeds

- GIVEN an order in state `planned`
- WHEN an admin or operational user calls
  `transition_production_order_state(order_id, 'in_progress')`
- THEN the order is updated to `in_progress` and a
  `production_order_events` row is inserted

#### Scenario: Forbidden transition is rejected

- GIVEN an order in state `delivered`
- WHEN a user attempts to transition it to `in_progress`
- THEN the RPC raises a 23514 check-violation error and the state is
  unchanged

#### Scenario: Unauthorized role is rejected

- GIVEN an order in state `planned`
- WHEN a user whose `profiles.role` is not `admin` or `operational`
  calls the transition RPC
- THEN the RPC raises a 42501 permission-denied error

#### Scenario: SET LOCAL leaks only inside the transaction

- GIVEN the RPC sets `SET LOCAL app.production_order_write_context =
  'rpc'`
- WHEN the transaction commits
- THEN a follow-up write from a different transaction does NOT see the
  GUC set

### Requirement: Idempotent Transition Request

The system MUST support an optional `p_request_id uuid` parameter on
`transition_production_order_state` and `start_production_order`. When
provided, the RPC MUST treat a retry with the same `(workshop_id,
request_id)` as a no-op and return the previously persisted result
without creating new events or applying new state. When omitted, the
RPC MUST still succeed but the client has no idempotency guarantee
against network retries.

#### Scenario: Same request_id returns the original result

- GIVEN a successful call with `p_request_id = X`
- WHEN the client retries the same call with `p_request_id = X`
- THEN the RPC returns the original result and no new event is
  inserted

#### Scenario: Different request_id is a new transition

- GIVEN a successful call with `p_request_id = X`
- WHEN the client calls the RPC with `p_request_id = Y`
- THEN the RPC applies a new transition and inserts a new event

### Requirement: Same-workshop FK Invariant

The system MUST enforce that `production_orders.quote_id` and
`production_order_events.production_order_id` belong to the same
workshop as the parent row. The check MUST be implemented as a
trigger that fires regardless of `auth.uid()` (including for
`service_role`) and regardless of the internal write-guard GUC. A
mismatch MUST raise a 23514 check-violation error and reject the
write.

#### Scenario: Mismatched quote is rejected even for service_role

- GIVEN a production order in workshop A
- WHEN `service_role` attempts to update its `quote_id` to a quote
  owned by workshop B
- THEN the trigger raises 23514 and the update fails

#### Scenario: Mismatched event parent is rejected

- GIVEN a `production_order_events` row with `production_order_id` in
  workshop A
- WHEN the system attempts to update `production_order_id` to an order
  in workshop B
- THEN the trigger raises 23514 and the update fails

### Requirement: Direct Quote Status Bypass Is Blocked

The system MUST forbid direct writes that set `quotes.status` to
`en_produccion` outside the production order flow. A SQL trigger MUST
reject authenticated `UPDATE` on `quotes` where the new status is
`en_produccion` and the write is not part of an authorized
`start_production_order` or `transition_production_order_state` call.
The frontend MUST additionally filter `en_produccion` out of the
`QuoteForm` status dropdown and the `useUpdateQuote` /
`useUpdateQuoteStatus` hooks MUST throw descriptive errors when a
caller attempts the forbidden transition.

#### Scenario: SQL trigger rejects direct en_produccion write

- GIVEN a quote with status `aprobado`
- WHEN an authenticated user attempts to UPDATE `quotes.status` to
  `en_produccion`
- THEN the trigger raises 42501 and the update is rejected

#### Scenario: Hook throws on forbidden transition

- GIVEN a `QuoteForm` is open on a quote with status `aprobado`
- WHEN the form calls `useUpdateQuote({ ..., status: 'en_produccion' })`
- THEN the hook throws an error message instructing the caller to use
  the production start flow

#### Scenario: UI dropdown excludes en_produccion

- GIVEN a `QuoteForm` status select control
- WHEN the user opens the dropdown
- THEN the `en_produccion` option is not present

### Requirement: Quote Status Projection

The system MUST provide a `get_quotes_with_production_status` SECURITY
INVOKER read RPC that returns one row per quote in the current
workshop, including the derived production status
(`none`/`planned`/`in_progress`/`paused`/`quality_check`/`ready`/
`delivered`/`cancelled`) computed from the most recent
`production_order_events` row for that quote. The RPC MUST return
denormalized `client_name` and `assigned_to_name` so the frontend does
not need follow-up queries per row.

#### Scenario: Quote without a production order has none

- GIVEN a quote in workshop A with no production order
- WHEN the user calls `get_quotes_with_production_status`
- THEN the row is returned with `production_status = 'none'`

#### Scenario: Quote with a paused order shows paused

- GIVEN a quote whose most recent event has `to_state = 'paused'`
- WHEN the user calls `get_quotes_with_production_status`
- THEN the row is returned with `production_status = 'paused'`

#### Scenario: Delivered projection is strict

- GIVEN a quote with at least one event to `delivered`
- WHEN the user calls `get_quotes_with_production_status`
- THEN the row is returned with `production_status = 'delivered'`
  regardless of any later non-delivered events

### Requirement: Production Order List and Detail Read RPCs

The system MUST provide `list_production_orders(filters)`,
`get_production_order(order_id)`, and
`get_production_order_events(order_id)` SECURITY INVOKER read RPCs.
`list_production_orders` MUST accept a bounded `state` filter (a
single state or a known active-states array) and a bounded pagination
key. `get_production_order_events` MUST return events ordered by
`created_at ASC, id ASC` (the `id ASC` tie-breaker is required for
deterministic ordering when timestamps tie). All three MUST be
workshop-scoped via RLS and MUST denormalize `client_name` and
`assigned_to_name` so the board can render a row in one round-trip.

#### Scenario: Empty filter returns all active orders

- GIVEN a workshop with five orders in active states and two in
  terminal states
- WHEN the user calls `list_production_orders({})` with the empty
  filter (active-states default)
- THEN the result contains exactly the five active orders

#### Scenario: Events are ordered with id ASC tie-breaker

- GIVEN three events inserted in a single millisecond with
  intentionally-non-monotonic UUIDs
- WHEN the user calls `get_production_order_events(order_id)`
- THEN the events are returned sorted by `created_at ASC, id ASC`

#### Scenario: Cross-tenant detail returns no row

- GIVEN an order in workshop B
- WHEN a user from workshop A calls `get_production_order(order_id)`
- THEN the result is empty (no row, no error leak)

### Requirement: Production Pipeline Stats RPC

The system MUST provide a `get_production_pipeline_stats` SECURITY
INVOKER read RPC that returns one row per active state
(`planned`, `in_progress`, `paused`, `quality_check`, `ready`) with
the count of orders currently in that state for the current workshop.
Terminal states (`delivered`, `cancelled`) MUST NOT be included in the
pipeline. The RPC MUST derive the workshop from
`auth.uid() -> profiles.workshop_id` and MUST NOT count orders from
other workshops.

#### Scenario: Counts respect workshop boundary

- GIVEN workshop A has 3 in_progress orders and workshop B has 5
- WHEN a user from workshop A calls `get_production_pipeline_stats`
- THEN the `in_progress` row reports `count = 3`

#### Scenario: Terminal states are not in the pipeline

- GIVEN a workshop with delivered and cancelled orders
- WHEN the user calls `get_production_pipeline_stats`
- THEN no row with state `delivered` or `cancelled` is returned

### Requirement: Production Order Public API Exports

The system MUST expose production order hooks and API functions from
`src/features/production/index.ts` for app-level or future
cross-feature composition. The public API MUST include
`useProductionOrders`, `useProductionOrder`, `useProductionOrderEvents`,
`useQuotesWithProductionStatus`, `useProductionPipelineStats`,
`useStartProductionOrder`, `useTransitionProductionOrder`,
`listProductionOrders`, `getProductionOrder`,
`getProductionOrderEvents`, `getQuotesWithProductionStatus`,
`getProductionPipelineStats`, `startProductionOrder`,
`transitionProductionOrderState`, and the runtime constants
`PRODUCTION_ORDER_STATE`, `PRODUCTION_ORDER_ACTIVE_STATES`,
`PRODUCTION_ORDER_TERMINAL_STATES`. Cross-feature consumers MUST
import through this seam and MUST NOT import from internal
`hooks/*` or `api/*` paths.

#### Scenario: Public API exposes production order hooks

- GIVEN a consumer imports from `src/features/production/index.ts`
- WHEN the consumer imports production order hooks
- THEN the import resolves without crossing feature-internal paths

### Requirement: Query-Key Cache Privacy

All `production_orders` and `production_order_events` query-key
families MUST be non-persistable in the client-side cache, consistent
with the cache-privacy policy for tenant-scoped production data. The
cache-privacy test MUST exercise the real cache-privacy module (not a
mock of the policy) and MUST verify every key the production hooks
create is classified as non-persistable.

#### Scenario: Production query keys are non-persistable

- GIVEN a new query key is introduced for any production read or
  mutation hook
- WHEN `cachePrivacy.test.ts` evaluates persistability using the real
  module
- THEN the key is classified as non-persistable

### Requirement: Production Board View

The system MUST provide a Kanban-style board at `/production` that
groups active production orders into one column per active state
(`planned`, `in_progress`, `paused`, `quality_check`, `ready`).
Terminal states (`delivered`, `cancelled`) MUST be excluded from the
board. The board MUST call
`get_quotes_with_production_status` for its data source, MUST surface
loading and error states for both the orders list and the quote
projection, and MUST host a start-production dialog for any quote
without an active production order.

#### Scenario: Board renders five columns

- GIVEN a workshop with orders in all five active states
- WHEN the user navigates to `/production`
- THEN the board renders five columns with the correct orders in each

#### Scenario: Terminal states are not on the board

- GIVEN a workshop with delivered and cancelled orders
- WHEN the user navigates to `/production`
- THEN those orders are not visible in any column

#### Scenario: Loading and error are distinct

- GIVEN the board is loading the orders list
- WHEN the quote projection fails
- THEN the board shows the orders loading state AND a separate
  error message for the projection

### Requirement: Start Production Dialog

The system MUST provide a `StartProductionDialog` component that
captures the production start intent from a quote row. The dialog
MUST call `useStartProductionOrder` (which in turn calls the
`start_production_order` RPC), MUST pass `null` for empty optional
fields, MUST keep the dialog open on error so the user can retry or
correct the form, and MUST call `onOpenChange(false)` on success or on
cancel.

#### Scenario: Success closes the dialog

- GIVEN the dialog is open
- WHEN the RPC returns success
- THEN the dialog calls `onOpenChange(false)` and the production order
  appears on the board

#### Scenario: Error keeps the dialog open

- GIVEN the dialog is open
- WHEN the RPC returns an error
- THEN the dialog remains open and displays the error message

#### Scenario: Empty optional fields are sent as null

- GIVEN the user submits the dialog with empty `notes` and
  `assigned_to`
- WHEN the hook sends the RPC payload
- THEN `notes` and `assigned_to` are sent as `null`, not as empty
  strings

### Requirement: Direct En-Produccion Guard at Four Layers

The system MUST block direct `en_produccion` writes at four layers
(defense in depth):

1. `useUpdateQuote` hook throws a descriptive error.
2. `useUpdateQuoteStatus` hook throws a descriptive error.
3. `QuoteForm` UI status filter excludes `en_produccion` from the
   dropdown.
4. SQL `prevent_direct_en_produccion_writes()` trigger is the final
   defense (introduced in PR 2; tested as a regression-only scenario
   in PR 6).

#### Scenario: Hook layer rejects forbidden transition

- GIVEN a quote with status `aprobado`
- WHEN any caller invokes
  `useUpdateQuote({ status: 'en_produccion' })`
- THEN the hook throws a Spanish-language error instructing the caller
  to use the production start flow

#### Scenario: SQL layer rejects forbidden transition

- GIVEN a quote with status `aprobado`
- WHEN an authenticated user attempts a direct `UPDATE quotes SET
  status = 'en_produccion'`
- THEN the trigger raises 42501 and the update fails

### Requirement: Deferred Scope

Production order detail page, inventory deep-link surfaces, dashboard
pipeline stats widget, quote action wiring, and legacy
`start_quote_production` wrapper migration are explicitly deferred to
PR 7-9. This canonical spec MUST NOT claim coverage for those
surfaces until the corresponding PRs land. The current PR 1-6 scope
covers schema, write RPCs, read RPCs, deduction FK, frontend data
layer, and the board/start flow plus the four-layer en_produccion
guard.
