# Tasks: SDD-12 Commission Payout Flow

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

5 stacked PRs to main, ~1250 total lines estimated.

## Phase 1: WU1 — Schema + DB Types

- [x] 1.1 RED: Write pgTAP test for youtuber bank columns migration
- [x] 1.2 GREEN: Create migration `20260618000001_youtuber_bank_details.sql` — Add `payout_cbu`, `payout_cvu`, `payout_alias`, `payout_bank_name`, `payout_holder_name`, `payout_holder_cuit` to `youtubers`
- [x] 1.3 RED: Write pgTAP test for commission status columns migration
- [x] 1.4 GREEN: Create migration `20260618000002_commission_status.sql` — Add `status`, `paid_at`, `payout_reference`, `payout_run_id` to `referral_commissions` with CHECK constraint
- [x] 1.5 RED: Write pgTAP test for payout_runs table migration
- [x] 1.6 GREEN: Create migration `20260618000003_payout_runs.sql` — Create `payout_runs` table with no `workshop_id`
- [x] 1.7 RED: Write pgTAP assertion for partial index on `status = 'pending'`
- [x] 1.8 REFACTOR: Update `src/shared/types/database.ts` — Add new column types and `payout_runs` table type with `Relationships: []`
- [x] 1.9 VERIFY: Run `supabase db reset` + pgTAP tests — All schema assertions pass

## Phase 2: WU2 — Payout Edge Function

- [x] 2.1 RED: Write unit test `computePayoutTotal` — sums commission amounts correctly
- [x] 2.2 RED: Write unit test `validateBankDetails` — valid CBU (22 digits), invalid CBU (3 digits), valid CVU (23 digits), invalid CUIT format
- [x] 2.3 RED: Write unit test `buildPayoutRunRecord` — builds correct record with all fields
- [x] 2.4 GREEN: Create `supabase/functions/admin-referral-payouts/payouts.ts` — Pure functions: `computePayoutTotal`, `validateBankDetails`, `buildPayoutRunRecord`
- [x] 2.5 RED: Write contract test for `pending-by-youtuber` endpoint — groups by YouTuber, filters by date, returns correct structure
- [x] 2.6 RED: Write contract test for `mark-paid` endpoint — creates payout run, updates commissions, rejects already-paid with 409
- [x] 2.7 RED: Write contract test for `payout-history` endpoint — returns runs with nested commissions
- [x] 2.8 RED: Write contract test for `youtuber-bank-details` endpoint — returns bank fields
- [x] 2.9 GREEN: Create `supabase/functions/admin-referral-payouts/index.ts` — Main handler with `requirePlatformAdmin` and all actions
- [x] 2.10 GREEN: Create `supabase/functions/admin-referral-payouts/mapping.ts` — Request validation and response mapping
- [x] 2.11 RED: Write contract test for bank details in `admin-youtube-mutate` — validates on create/update
- [x] 2.12 GREEN: Modify `supabase/functions/admin-youtube-mutate/index.ts` — Add bank detail fields to create/update actions with validation
- [x] 2.13 VERIFY: Unit tests pass; contract tests pass with mocked DB

## Phase 3: WU3 — Admin UI: Commissions Tab + Stale Badge

- [x] 3.1 RED: Write component test — `ReferidosPage` shows "Comisiones" tab
- [x] 3.2 GREEN: Modify `src/features/admin/components/ReferidosPage.tsx` — Add "Comisiones" and "Pagos" to TABS array, render `CommissionsTab`
- [x] 3.3 RED: Write component test — Stale badge appears when commission >30 days pending
- [x] 3.4 GREEN: Modify `src/features/admin/components/CommissionsTab.tsx` — Add stale badge with date math for >30 days
- [x] 3.5 RED: Write hook test — `useAdminPayoutPending` fetches and caches pending commissions grouped by YouTuber
- [x] 3.6 GREEN: Add `useAdminPayoutPending` to `src/features/admin/hooks/useReferrals.ts`
- [x] 3.7 RED: Write API test — `getPayoutPending` calls correct Edge Function
- [x] 3.8 GREEN: Add `getPayoutPending` to `src/features/admin/api/referrals.ts`
- [x] 3.9 VERIFY: Component tests pass; `/admin/referidos` shows Comisiones tab; stale badge visible with old commissions

## Phase 4: WU4 — Admin UI: Payouts Tab + Bank Details Form

- [x] 4.1 RED: Write component test — `PayoutsTab` renders payout runs table with expandable rows
- [x] 4.2 GREEN: Create `src/features/admin/components/PayoutsTab.tsx` — Table with date, total, count, reference, expandable commission details
- [x] 4.3 RED: Write component test — "Nuevo pago" modal opens, shows pending commissions, checkbox selection, disabled confirm until selected
- [x] 4.4 GREEN: Create `PayoutModal` component — Select commissions, enter reference/notes, confirm payout
- [x] 4.5 RED: Write hook test — `useMarkCommissionsPaid` mutation marks paid and invalidates queries
- [x] 4.6 GREEN: Add `useMarkCommissionsPaid` to `src/features/admin/hooks/useReferrals.ts`
- [x] 4.7 RED: Write hook test — `usePayoutHistory` fetches payout runs
- [x] 4.8 GREEN: Add `usePayoutHistory` to `src/features/admin/hooks/useReferrals.ts`
- [x] 4.9 RED: Write API test — `markCommissionsPaid`, `getPayoutHistory` call correct endpoints
- [x] 4.10 GREEN: Add `markCommissionsPaid`, `getPayoutHistory` to `src/features/admin/api/referrals.ts`
- [x] 4.11 RED: Write component test — `YoutuberForm` shows bank details inputs with validation messages
- [x] 4.12 GREEN: Modify `src/features/admin/components/YoutuberForm.tsx` — Add CBU, CVU, Alias, Banco, Titular, CUIT inputs with validation on blur
- [x] 4.13 VERIFY: All component tests pass; Payouts tab functional; form validation works

## Phase 5: WU5 — Integration + Polish

- [x] 5.1 RED: Write E2E test `tests/e2e/admin/payout-flow.spec.ts` — Full flow: webhook → commission → stale badge → payout creation → history display
- [x] 5.2 GREEN: Implement E2E test with Playwright
- [x] 5.3 RED: Write integration test — webhook commission → pending-by-youtuber → mark-paid → payout-history chain works
- [x] 5.4 GREEN: Create `tests/integration/payoutWorkflow.test.ts`
- [x] 5.5 REFACTOR: Ensure all `database.ts` relationships updated for new tables
- [x] 5.6 REFACTOR: Review error handling in Edge Functions — consistent error codes and messages
- [x] 5.7 VERIFY: Run full test suite — 70+ suites, all green, no SDD-11 regressions
- [x] 5.8 VERIFY: Manual QA — Create YouTuber with bank details, simulate commission via webhook, verify stale badge, execute payout, verify history
