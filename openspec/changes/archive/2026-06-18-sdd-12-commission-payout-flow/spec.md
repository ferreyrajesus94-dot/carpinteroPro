# Delta Spec — SDD-12 Commission Payout Flow

> **Composite spec for change `2026-06-18-sdd-12-commission-payout-flow`.**
> Covers one **new capability** (`commission-payout-flow`) modifying `referral-program`.
> See `proposal.md` for intent, scope, and risks.

---

# Part 1 — NEW Capability: `commission-payout-flow`

This is a **full spec** for the payout workflow on top of SDD-11's commission ledger. Six domains cover schema evolution, payout API, admin UI, and testing.

## Domain: Schema Evolution

### Purpose

Add structured bank details to YouTubers, track payout status on commissions, and create an audit trail via payout runs — without breaking SDD-11 immutability guarantees.

### Requirements

### Requirement: YouTuber Bank Details

The system MUST add structured bank columns to `public.youtubers`: `payout_cbu text`, `payout_cvu text`, `payout_alias text`, `payout_bank_name text`, `payout_holder_name text`, `payout_holder_cuit text`. The existing `payout_method` column MUST be kept (deprecated, not dropped). CBU MUST be 22 digits when present; CVU MUST be 23 digits when present; CUIT MUST match format XX-XXXXXXXX-X when present.

#### Scenario: Add bank details to youtuber

- GIVEN a YouTuber with `id = Y1`
- WHEN `admin-youtube-mutate` is called with `{ action: "update", id: "Y1", payoutCbu: "1234567890123456789012", payoutCvu: "12345678901234567890123", payoutAlias: "mi.alias.mp", payoutBankName: "Banco Nación", payoutHolderName: "Juan Pérez", payoutHolderCuit: "20-12345678-9" }`
- THEN the row MUST be updated with all bank detail columns
- AND the existing `payout_method` column MUST remain unchanged (legacy compatibility)

#### Scenario: CBU validation fails

- GIVEN an update with `payoutCbu = "123"` (only 3 digits, not 22)
- WHEN the mutation runs
- THEN the endpoint MUST return HTTP 400 with error code `invalid_bank_details`
- AND the row MUST NOT be modified

#### Scenario: Partial bank details allowed

- GIVEN an update with only `payoutAlias = "otro.alias.mp"` and no CBU/CVU
- WHEN the mutation runs
- THEN the alias MUST be saved
- AND other bank columns MUST remain unchanged

#### Scenario: Schema contract

- GIVEN the migration `20260618000001_youtuber_bank_details.sql` is applied
- WHEN the table is inspected
- THEN it MUST include columns: `payout_cbu text`, `payout_cvu text`, `payout_alias text`, `payout_bank_name text`, `payout_holder_name text`, `payout_holder_cuit text`
- AND RLS MUST remain enabled with no authenticated policies

### Requirement: Commission Payout Status

The system MUST add `status text NOT NULL DEFAULT 'pending'`, `paid_at timestamptz`, `payout_reference text`, and `payout_run_id uuid REFERENCES payout_runs(id)` to `public.referral_commissions`. Status MUST have CHECK constraint `status IN ('pending', 'paid', 'cancelled')`. A partial index on `status = 'pending'` MUST exist for fast queries.

#### Scenario: New commission starts as pending

- GIVEN a new commission row inserted via webhook
- WHEN the row is created
- THEN `status` MUST equal `'pending'`
- AND `paid_at` MUST be `NULL`
- AND `payout_run_id` MUST be `NULL`

#### Scenario: Mark commission as paid

- GIVEN a pending commission with `id = C1`
- WHEN `admin-referral-payouts` marks it paid with `payoutRunId = PR1` and `payoutReference = "TRANSFER-123"`
- THEN `status` MUST become `'paid'`
- AND `paid_at` MUST be set to current timestamp
- AND `payout_reference` MUST equal `"TRANSFER-123"`
- AND `payout_run_id` MUST equal `PR1`

#### Scenario: Invalid status rejected

- GIVEN an attempted update with `status = 'partially_paid'`
- WHEN the update runs
- THEN the database MUST reject with check constraint violation

#### Scenario: Fast pending query

- GIVEN 10,000 commissions with mixed statuses
- WHEN querying `WHERE status = 'pending'`
- THEN the partial index MUST be used for efficient lookup

### Requirement: Payout Runs Audit Trail

The system MUST create a `public.payout_runs` table with columns: `id uuid PRIMARY KEY`, `created_by uuid NOT NULL REFERENCES profiles(id)`, `total_amount numeric(12,2) NOT NULL`, `commission_count int NOT NULL`, `reference text`, `notes text`, `created_at timestamptz NOT NULL DEFAULT now()`. This table MUST NOT include `workshop_id` (global platform data per SDD-9 precedent).

#### Scenario: Create payout run

- GIVEN commissions C1 ($100), C2 ($200), C3 ($150) marked as paid in batch
- WHEN the payout run is created
- THEN `total_amount` MUST equal `450.00`
- AND `commission_count` MUST equal `3`
- AND `created_by` MUST equal the admin's profile ID
- AND `reference` SHOULD contain the bank transfer reference number

#### Scenario: Query payout history

- GIVEN multiple payout runs exist
- WHEN `admin-referral-payouts` queries payout history
- THEN it MUST return runs ordered by `created_at DESC` with aggregated commission details

#### Scenario: Schema contract

- GIVEN the migration `20260618000003_payout_runs.sql` is applied
- WHEN inspected
- THEN RLS MUST be enabled with no authenticated policies
- AND a foreign key from `referral_commissions.payout_run_id` to `payout_runs.id` MUST exist

### Requirement: Migration-Level Validation

Each migration MUST include a `DO $$ ... RAISE EXCEPTION` block that fails if RLS is not enabled on the modified tables or if expected columns are missing.

#### Scenario: RLS assertion on youtubers

- GIVEN the bank details migration runs
- WHEN the assertion block executes
- THEN it MUST raise if `pg_class.relrowsecurity` is false for `youtubers`

---

## Domain: Payout API (Edge Function)

### Purpose

Expose platform-admin-only endpoints to list pending commissions, execute payouts (single/bulk), and query payout history. All endpoints MUST use `requirePlatformAdmin` and `serviceClient` patterns from SDD-9/SDD-11.

### Requirements

### Requirement: admin-referral-payouts Endpoint

The `admin-referral-payouts` Edge Function MUST accept `POST` requests with different actions based on the request body or query params.

#### Scenario: List pending commissions grouped by YouTuber

- GIVEN pending commissions exist for multiple YouTubers
- WHEN `POST /?action=pending-by-youtuber` is called by platform admin
- THEN the response MUST include an array of YouTubers, each with:
  - `youtuberId`, `displayName`, `totalPendingAmount`, `commissionCount`
  - Array of pending commissions with `id`, `commissionAmount`, `occurredAt`, `workshopName`
- AND the response MUST be ordered by `totalPendingAmount DESC`

#### Scenario: Filter pending by date range

- GIVEN pending commissions from Jan, Feb, Mar 2026
- WHEN `POST /?action=pending-by-youtuber&fromDate=2026-02-01&toDate=2026-02-28` is called
- THEN only Feb commissions MUST be included in totals and lists

#### Scenario: Execute payout (bulk)

- GIVEN pending commissions with IDs `[C1, C2, C3]` totaling $450
- WHEN `POST /` with body `{ action: "mark-paid", commissionIds: ["C1", "C2", "C3"], payoutReference: "TRANSFER-123", notes: "Pago mensual Feb 2026" }` is called
- THEN a new `payout_runs` row MUST be created with `total_amount = 450.00`, `commission_count = 3`, `reference = "TRANSFER-123"`, `notes = "Pago mensual Feb 2026"`
- AND all three commissions MUST be updated: `status = 'paid'`, `paid_at = now()`, `payout_run_id = newRunId`, `payout_reference = "TRANSFER-123"`
- AND the response MUST include the payout run details

#### Scenario: Execute payout (single)

- GIVEN one pending commission C1 with amount $100
- WHEN `POST /` with body `{ action: "mark-paid", commissionIds: ["C1"], payoutReference: "SINGLE-001" }` is called
- THEN a payout run MUST be created with `commission_count = 1`, `total_amount = 100.00`

#### Scenario: Idempotent payout execution

- GIVEN commissions C1, C2 were already marked as paid in a previous run
- WHEN attempting to mark them as paid again with a new reference
- THEN the endpoint MUST return HTTP 409 with error code `commissions_already_paid`
- AND no new payout run MUST be created

#### Scenario: Query payout history

- GIVEN multiple payout runs exist
- WHEN `POST /?action=payout-history&limit=10` is called
- THEN the response MUST include an array of payout runs with:
  - `id`, `createdAt`, `totalAmount`, `commissionCount`, `reference`, `notes`, `createdBy` (admin email)
  - Nested array of commissions with `id`, `commissionAmount`, `youtuberName`, `workshopName`

#### Scenario: Get YouTuber bank details

- GIVEN a YouTuber Y1 with bank details populated
- WHEN `POST /?action=youtuber-bank-details&youtuberId=Y1` is called
- THEN the response MUST include all bank columns: `payoutCbu`, `payoutCvu`, `payoutAlias`, `payoutBankName`, `payoutHolderName`, `payoutHolderCuit`

#### Scenario: Non-admin rejected

- GIVEN a request from a non-platform-admin user
- WHEN any endpoint is called
- THEN the response MUST be HTTP 403 with error code `admin_auth_failed`

### Requirement: Extend admin-youtube-mutate for Bank Details

The existing `admin-youtube-mutate` endpoint MUST accept new fields for bank details in `create` and `update` actions, with validation.

#### Scenario: Create YouTuber with bank details

- GIVEN `POST /` with body `{ action: "create", displayName: "Canal Madera", payoutAlias: "canal.madera", payoutBankName: "Mercado Pago" }`
- WHEN the endpoint runs
- THEN the YouTuber MUST be created with all provided bank details
- AND validation MUST pass (alias format is reasonable)

#### Scenario: Update YouTuber bank details

- GIVEN an existing YouTuber
- WHEN `POST /` with body `{ action: "update", id: "Y1", payoutCbu: "1234567890123456789012" }` is called
- THEN only the CBU MUST be updated, other fields unchanged

#### Scenario: Bank detail validation on write

- GIVEN an update with invalid CBU (21 digits instead of 22)
- WHEN the endpoint runs
- THEN it MUST return HTTP 400 with error code `invalid_bank_details` and details about which field failed

---

## Domain: Admin UI

### Purpose

Surface the payout workflow in `/admin/referidos` with visible Commissions tab, stale badge, payout actions, and payout history view.

### Requirements

### Requirement: Mount CommissionsTab in ReferidosPage

The `ReferidosPage` MUST add "Comisiones" to its `TABS` array and render `CommissionsTab` when that tab is active.

#### Scenario: Commissions tab visible

- GIVEN the user navigates to `/admin/referidos`
- WHEN the page loads
- THEN a "Comisiones" tab MUST be visible alongside "YouTubers"

#### Scenario: Switch to Commissions tab

- GIVEN the user is on the YouTubers tab
- WHEN they click "Comisiones"
- THEN the `CommissionsTab` component MUST render
- AND it MUST show the commissions table with filters and CSV export button

### Requirement: Stale Commission Badge

The `CommissionsTab` MUST display a red badge when any pending commission is older than 30 days.

#### Scenario: Stale commissions exist

- GIVEN a pending commission from 45 days ago
- WHEN the Commissions tab renders
- THEN a red badge MUST appear reading "1 comisión >30 días pendiente" (or similar)
- AND the badge MUST link to filtered view showing only stale commissions

#### Scenario: No stale commissions

- GIVEN all pending commissions are <30 days old
- WHEN the Commissions tab renders
- THEN no stale badge MUST be shown

#### Scenario: Multiple stale commissions

- GIVEN 5 pending commissions >30 days old
- WHEN the tab renders
- THEN the badge MUST show "5 comisiones >30 días"

### Requirement: PayoutsTab Component

The system MUST create a new `PayoutsTab` component with:

- Table of payout runs: date, total, count, reference, admin
- Expandable rows showing individual commissions
- "Nuevo pago" button opening a modal to select pending commissions

#### Scenario: Payout history visible

- GIVEN existing payout runs
- WHEN the user navigates to the "Pagos" tab (new tab)
- THEN a table MUST show all payout runs ordered by date descending

#### Scenario: Expand payout run details

- GIVEN a payout run with 3 commissions
- WHEN the user clicks the expand arrow on that row
- THEN the 3 commissions MUST be listed with their amounts, YouTubers, and workshops

#### Scenario: Create new payout (modal flow)

- GIVEN pending commissions exist
- WHEN the user clicks "Nuevo pago"
- THEN a modal MUST open showing pending commissions grouped by YouTuber
- AND the user MUST be able to select commissions via checkboxes
- AND a "Confirmar pago" button MUST be disabled until at least one commission is selected
- AND when clicked, it MUST prompt for `payoutReference` and optional `notes`

#### Scenario: Successful payout updates UI

- GIVEN the user just executed a payout for commissions C1, C2
- WHEN the modal closes
- THEN the Payouts tab MUST refresh to show the new payout run
- AND the selected commissions MUST no longer appear in "pending" lists

### Requirement: YouTuberForm Bank Details

The `YoutuberForm` component (used in create/edit) MUST include structured inputs for all bank detail fields with validation.

#### Scenario: Bank fields in create form

- GIVEN the user clicks "Crear YouTuber"
- WHEN the form opens
- THEN inputs MUST be visible for: CBU (22 digits), CVU (23 digits), Alias, Banco, Titular, CUIT
- AND each input MUST show validation errors on blur

#### Scenario: CBU validation message

- GIVEN the user enters "123" in CBU field
- WHEN they blur the field
- THEN an error message MUST appear: "El CBU debe tener 22 dígitos"

#### Scenario: Partial save allowed

- GIVEN the user fills only Alias and Bank
- WHEN they submit the form
- THEN the YouTuber MUST be created with those fields
- AND empty CBU/CVU fields MUST be saved as NULL

---

## Domain: Testing

### Purpose

Comprehensive test coverage for schema, API, and UI following SDD-11 patterns (Vitest unit, pgTAP schema, Component, E2E).

### Requirements

### Requirement: Unit Tests for Payout Logic

The system MUST test pure functions in `admin-referral-payouts`.

#### Scenario: computePayoutTotal

- GIVEN commissions with amounts [100.50, 200.00, 150.25]
- WHEN `computePayoutTotal(commissions)` is called
- THEN it MUST return `450.75`

#### Scenario: validateBankDetails valid CBU

- GIVEN `{ payoutCbu: "1234567890123456789012" }`
- WHEN validated
- THEN it MUST return `{ valid: true, errors: {} }`

#### Scenario: validateBankDetails invalid CBU

- GIVEN `{ payoutCbu: "123" }`
- WHEN validated
- THEN it MUST return `{ valid: false, errors: { payoutCbu: "CBU debe tener 22 dígitos" } }`

#### Scenario: buildPayoutRunRecord

- GIVEN `commissionIds`, `totalAmount`, `reference`, `notes`, `createdBy`
- WHEN `buildPayoutRunRecord()` is called
- THEN it MUST return a valid `PayoutRun` object with all fields

### Requirement: pgTAP Schema Tests

The system MUST test all 3 migrations with pgTAP assertions.

#### Scenario: Bank details columns exist

- GIVEN migration 20260618000001 is applied
- WHEN pgTAP tests run
- THEN they MUST assert existence of: `payout_cbu`, `payout_cvu`, `payout_alias`, `payout_bank_name`, `payout_holder_name`, `payout_holder_cuit`

#### Scenario: Status constraint

- GIVEN migration 20260618000002 is applied
- WHEN pgTAP tests run
- THEN they MUST assert `CHECK (status IN ('pending', 'paid', 'cancelled'))`
- AND assert partial index on `status = 'pending'`

#### Scenario: Payout runs foreign key

- GIVEN migration 20260618000003 is applied
- WHEN pgTAP tests run
- THEN they MUST assert `referral_commissions.payout_run_id` references `payout_runs.id`
- AND assert `ON DELETE SET NULL` behavior

### Requirement: Component Tests

The system MUST test React components with Testing Library.

#### Scenario: PayoutsTab renders correctly

- GIVEN payout runs data
- WHEN `PayoutsTab` renders
- THEN it MUST show table with correct columns
- AND expand button MUST work

#### Scenario: Stale badge appears

- GIVEN stale commissions exist
- WHEN `CommissionsTab` renders
- THEN the stale badge MUST be visible in the document

#### Scenario: YouTuberForm validation

- GIVEN invalid CBU input
- WHEN form is submitted
- THEN error message MUST appear and submit MUST be prevented

### Requirement: E2E Test for Payout Flow

The system MUST include a Playwright E2E test covering the full payout workflow.

#### Scenario: Full payout workflow

- GIVEN a platform admin logged in
- AND a YouTuber with pending commissions exists
- WHEN the admin navigates to Referidos → Comisiones
- THEN the stale badge MUST appear if commissions are old
- AND when they navigate to Pagos tab
- AND click "Nuevo pago"
- AND select pending commissions
- AND enter reference "TEST-001"
- AND confirm
- THEN the payout MUST appear in history
- AND commissions MUST no longer be in pending list

---

# Phase Result Envelope (Spec)

| Field | Value |
|---|---|
| **status** | `spec_complete` |
| **executive_summary** | Wrote comprehensive spec for SDD-12 Commission Payout Flow covering 4 domains: Schema Evolution (3 migrations), Payout API (admin-referral-payouts Edge Function), Admin UI (CommissionsTab mounting, PayoutsTab, stale badge, bank details form), and Testing (unit, pgTAP, component, E2E). Key patterns preserved: RLS with no authenticated policies, platform-global tables without workshop_id, requirePlatformAdmin for all endpoints, structured bank validation (CBU 22 digits, CVU 23 digits, CUIT format). Idempotency enforced at payout level (reject already-paid commissions). |
| **artifacts** | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/spec.md` |
| **next_recommended** | `design` — define work units for chained PRs, estimate lines per WU, plan migration order. |
| **risks** | Bank validation regexes must handle Argentina formats correctly. Migration order matters: youtubers first, then commissions status, then payout_runs (FK dependency). UI tabs addition is low risk but requires updating ReferidosPage which affects existing SDD-11 UI. Stale badge requires date math that should be tested across timezones. |
| **skill_resolution** | `paths-injected` |
