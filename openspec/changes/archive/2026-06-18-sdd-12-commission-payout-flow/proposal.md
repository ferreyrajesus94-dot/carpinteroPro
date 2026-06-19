# Proposal: SDD-12 Commission Payout Flow

## Problem

SDD-11 implemented a commission ledger (`referral_commissions`) that records what the platform owes each YouTuber. But there is no workflow to **act on that ledger** — no way to mark commissions as paid, no structured bank details for YouTubers, no notification when old commissions go unpaid, and no consolidated view of payout history.

The admin can export a CSV and do a manual bank transfer, but the system doesn't track whether that transfer actually happened. This creates operational risk: commissions can be forgotten, double-paid, or disputed without an audit trail.

## Solution

Add a **payout workflow** on top of the existing commission ledger:

1. **Structured bank details** — Add CBU/CVU/alias/bank/holder columns to `youtubers` (replace the free-text `payout_method`).
2. **Commission status tracking** — Add `status`, `paid_at`, `payout_reference` to `referral_commissions` so each row transitions from `pending` → `paid`.
3. **Payout runs** — New `payout_runs` table that groups commissions paid in a single batch, with an audit trail (who, when, how much, reference).
4. **Admin API** — Edge function to list pending commissions grouped by YouTuber, mark commissions as paid (single or bulk), and list payout history.
5. **Admin UI** — Mount `CommissionsTab` (already exists but unmounted), add payout actions (bulk select + "Mark as Paid"), add "Payouts" tab with history.
6. **Stale commission badge** — Visual indicator in admin when commissions are >30 days pending.
7. **Email notification (stub)** — Badge in-panel is primary; email notification is a follow-up once SMTP is configured. For now, the "both" requirement degrades to badge-only with a clear extension point for email.

## Scope

### In scope

- Migration: bank details columns on `youtubers`
- Migration: status/paid_at/payout_reference on `referral_commissions`
- Migration: `payout_runs` table
- Edge function: `admin-referral-payouts` (list pending by YouTuber, mark paid single/bulk, list payout runs)
- Admin UI: mount CommissionsTab, add payout actions, add Payouts tab, add stale badge
- Unit tests for all new pure functions
- pgTAP tests for schema changes
- Component tests for UI changes
- E2E test for payout flow

### Out of scope

- PDF generation (user chose panel-only view)
- Automatic email delivery (no SMTP configured; will stub the integration point)
- MercadoPago Payouts API integration (user chose manual bank transfer)
- Cron/scheduled batch processing (will note as future enhancement)
- YouTuber-facing portal (commissions remain admin-only for now)

## Acceptance Criteria

- [ ] YouTuber bank details (CBU/CVU/alias) stored in structured columns
- [ ] Commission rows have `pending` / `paid` status with `paid_at` timestamp
- [ ] Admin can select multiple pending commissions and mark them as paid with a payment reference
- [ ] Payout runs group paid commissions with audit trail (admin, date, total, reference)
- [ ] CommissionsTab visible and functional in /admin/referidos
- [ ] Stale badge (red) visible when any commission is >30 days pending
- [ ] Payouts tab shows history of payout runs with drill-down to individual commissions
- [ ] All new code has tests (unit, pgTAP, component, E2E)
- [ ] Existing SDD-11 tests remain green

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| `referral_commissions` immutability breaks when adding status column | Medium | Status column is mutable metadata; ledger amounts (payment_amount, commission_pct, commission_amount) remain immutable snapshots |
| Free-text `payout_method` migration | Low | Keep existing data; new columns are additive, old column deprecated but not dropped |
| No email infra for notification requirement | Medium | Badge-only for MVP; stub email service interface for future activation |
| Large migration scope | Low | Split into 3 small migrations (bank details, status columns, payout_runs) |

## Dependencies

- SDD-11 Referral System (archived, complete)
- Existing `CommissionsTab` component (exists, needs mounting)
- Existing `admin-referral-commissions` edge function (extend or new sibling)

## Estimated Effort

~5 Work Units, ~600-800 lines total, chained PRs recommended (stacked-to-main).

## Non-Goals

- Automated payment execution (manual bank transfer only)
- YouTuber self-service portal
- Multi-currency support
- Tax/compliance reporting
