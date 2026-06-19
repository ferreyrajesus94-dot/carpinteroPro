# Design: SDD-12 Commission Payout Flow

## Technical Approach

Add payout workflow on top of SDD-11's immutable commission ledger. Schema evolves with structured bank details, mutable status metadata, and payout run audit trail. Admin API supports bulk/single payouts with idempotency checks. UI surfaces stale commissions and payout history while keeping the operational model (manual bank transfer) unchanged.

## Architecture Decisions

| Decision | Choice | Tradeoff / Rationale |
|---|---|---|
| Bank details storage | Structured columns (CBU, CVU, alias, etc.) vs JSON blob | Validation at DB + API level; explicit schema documents expectations. Keep legacy `payout_method` for migration safety. |
| Commission immutability | Ledger amounts immutable; status/paid_at mutable metadata | Maintains audit trail of what was earned while tracking what was paid. |
| Payout idempotency | Check `status = 'pending'` before marking paid | Prevents double-payment bugs; returns 409 if already paid. |
| Payout runs | Separate table grouping commissions by batch | Audit trail of who paid what when; supports future reversal queries. |
| No workshop_id | `payout_runs` is platform-global (per SDD-9 precedent) | Consistent with youtubers/referral tables; no tenant isolation needed. |
| Stale detection | Client-side date math (>30 days) with server flag | Simple; no cron needed. Badge query uses partial index for performance. |

## Data Flow

```text
MP authorized_payment -> mercadopago-webhook -> referral_commissions (status=pending)

/admin/referidos
  -> Commisiones tab: list pending + stale badge (>30 days check)
  -> Pagos tab: list payout_runs history
  -> "Nuevo pago" modal: select pending commissions
     -> admin-referral-payouts (mark-paid)
        -> INSERT payout_runs
        -> UPDATE referral_commissions (status=paid, paid_at, payout_run_id)

YouTuber create/update -> admin-youtube-mutate -> validate bank details -> UPDATE youtubers
```

## Data Model / Migrations

1. `20260618000001_youtuber_bank_details.sql`: Add `payout_cbu`, `payout_cvu`, `payout_alias`, `payout_bank_name`, `payout_holder_name`, `payout_holder_cuit` to `youtubers`. Keep `payout_method` deprecated. RLS on, no policies.

2. `20260618000002_commission_status.sql`: Add `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled'))`, `paid_at timestamptz`, `payout_reference text`, `payout_run_id uuid REFERENCES payout_runs(id) ON DELETE SET NULL`. Partial index on `status = 'pending'`. RLS on, no policies.

3. `20260618000003_payout_runs.sql`: Create `payout_runs(id, created_by, total_amount, commission_count, reference, notes, created_at)`. No `workshop_id`. RLS on, no policies. Add FK from `referral_commissions.payout_run_id`.

Each migration includes `DO $$` assertions for RLS, columns, constraints, and indexes.

## Interfaces / Edge Function Contracts

- `admin-referral-payouts` `POST { action: "pending-by-youtuber", fromDate?, toDate? }` → `{ youtubers: [{ youtuberId, displayName, totalPendingAmount, commissionCount, commissions: [] }] }`
- `admin-referral-payouts` `POST { action: "mark-paid", commissionIds: [], payoutReference, notes? }` → `{ payoutRun: { id, totalAmount, commissionCount, reference, createdAt } }` (409 if any already paid)
- `admin-referral-payouts` `POST { action: "payout-history", limit? }` → `{ payoutRuns: [] }`
- `admin-referral-payouts` `POST { action: "youtuber-bank-details", youtuberId }` → `{ payoutCbu, payoutCvu, payoutAlias, payoutBankName, payoutHolderName, payoutHolderCuit }`
- `admin-youtube-mutate` extended: `create`/`update` actions accept `payoutCbu`, `payoutCvu`, `payoutAlias`, `payoutBankName`, `payoutHolderName`, `payoutHolderCuit` with validation.

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260618000001_youtuber_bank_details.sql` | Create | Add structured bank columns to youtubers |
| `supabase/migrations/20260618000002_commission_status.sql` | Create | Add status/paid_at/payout_reference/payout_run_id to referral_commissions |
| `supabase/migrations/20260618000003_payout_runs.sql` | Create | Create payout_runs table with FK |
| `supabase/functions/admin-referral-payouts/index.ts` | Create | Main edge function handler |
| `supabase/functions/admin-referral-payouts/payouts.ts` | Create | Pure functions: computePayoutTotal, validateBankDetails, buildPayoutRunRecord |
| `supabase/functions/admin-referral-payouts/mapping.ts` | Create | Request validation, response mapping |
| `supabase/functions/admin-youtube-mutate/index.ts` | Modify | Add bank details fields to create/update actions |
| `src/features/admin/components/ReferidosPage.tsx` | Modify | Add "Comisiones" and "Pagos" tabs, mount CommissionsTab |
| `src/features/admin/components/CommissionsTab.tsx` | Modify | Add stale badge, prepare for payout actions integration |
| `src/features/admin/components/PayoutsTab.tsx` | Create | Payout history table + modal for new payout |
| `src/features/admin/components/YoutuberForm.tsx` | Modify | Add bank details inputs with validation |
| `src/features/admin/hooks/useReferrals.ts` | Modify | Add useAdminPayoutPending, useMarkCommissionsPaid, usePayoutHistory |
| `src/features/admin/api/referrals.ts` | Modify | Add calls to admin-referral-payouts |
| `src/shared/types/database.ts` | Modify | Add new table types and column types |
| `tests/supabase/functions/adminReferralPayouts.test.ts` | Create | Unit tests for pure functions |
| `tests/supabase/migrations/payoutSchema.test.ts` | Create | pgTAP-style assertions for schema |
| `tests/features/admin/PayoutsTab.test.tsx` | Create | Component tests |
| `tests/e2e/admin/payout-flow.spec.ts` | Create | E2E full payout workflow |

## Work Units / Chained PRs

| WU | Boundary | Files | Tests first | Est. lines | Verify | Rollback |
|---|---|---|---|---:|---|---|
| 1 Schema/Types | 3 migrations + database.ts types; no UI/API | migrations, `database.ts`, pgTAP tests | migration assertions for columns/constraints/RLS/indexes | ~200 | pgTAP passes; columns exist with constraints | revert migrations; types unused |
| 2 Payout API | Edge function + bank validation; no UI | `admin-referral-payouts/*`, `admin-youtube-mutate` modify, unit tests | validateBankDetails, computePayoutTotal, mark-paid idempotency | ~300 | pending-by-youtuber returns groups; mark-paid creates run + updates commissions | remove edge function; revert mutate changes |
| 3 CommissionsTab | Mount tab + stale badge; no payout actions yet | `ReferidosPage`, `CommissionsTab` modify, hooks, component tests | stale badge visibility, tab switching | ~250 | /admin/referidos shows Comisiones tab; stale badge appears when commissions >30 days | hide tabs; revert CommissionsTab changes |
| 4 PayoutsTab + Bank Form | Full payout UI + YouTuber bank details | `PayoutsTab`, `YoutuberForm` modify, modal component, component tests, E2E | PayoutsTab rendering, form validation, E2E flow | ~350 | Pagos tab lists runs; modal creates payout; commissions disappear from pending; bank form validates | hide Pagos tab; remove bank fields |
| 5 Integration | E2E, integration test, final polish | E2E test, integration test, cleanup | Full flow E2E, webhook→commission→payout integration | ~150 | All tests pass; existing SDD-11 tests green | disable E2E; revert polish |

**Dependency graph:**

```
WU1 → WU2 → WU4
WU1 → WU3 → WU4
WU2 → WU4
WU4 → WU5
```

## Testing Strategy

Strict TDD per WU: failing migration/component/function contract tests first, minimal green, refactor.

- **Unit tests**: Vitest for pure functions (computePayoutTotal, validateBankDetails, buildPayoutRunRecord)
- **pgTAP tests**: Migration-level assertions (columns exist, constraints enforced, RLS enabled, indexes present)
- **Component tests**: Testing Library for PayoutsTab, stale badge, YoutuberForm validation
- **E2E**: Playwright covering full flow: webhook commission → stale badge → payout creation → history display

## Security Model

- All payout endpoints use `requirePlatformAdmin` → JWT + `profiles.is_platform_admin` check
- `serviceClient()` with service_role for DB writes (no RLS policies for authenticated users)
- Bank details validation at API level (CBU 22 digits, CVU 23 digits, CUIT format XX-XXXXXXXX-X)
- Payout idempotency prevents double-payment (409 if commission already paid)
- No workshop_id on payout_runs (platform-global per SDD-9)

## UI Structure

`ReferidosPage` tabs:

- **YouTubers** (existing): table, create/edit modal, codes panel
- **Comisiones** (mount existing): filters, table, CSV export, stale badge (>30 days)
- **Pagos** (new): payout runs table (expandable), "Nuevo pago" button → modal with pending commissions grouped by YouTuber

`YoutuberForm` (create/edit): Additional section "Datos bancarios" with CBU, CVU, Alias, Banco, Titular, CUIT inputs and validation.

## Rollback Strategy (Per WU)

- **WU1**: Revert migrations; `database.ts` types unused until WU2. Safe.
- **WU2**: Remove edge function; revert `admin-youtube-mutate` changes. Commissions continue as ledger-only (SDD-11 behavior).
- **WU3**: Hide tabs; CommissionsTab badge logic harmless if not mounted.
- **WU4**: Hide Pagos tab; bank form fields optional. Existing YouTubers work without bank details.
- **WU5**: E2E tests optional for prod; integration tests don't affect runtime.

## Open Questions

- None blocking. Product decisions confirmed in proposal.
