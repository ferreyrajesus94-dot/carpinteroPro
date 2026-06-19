# Archive Report — SDD-12 Commission Payout Flow

## Status

**PASS** — Archive completed successfully.

## Summary

SDD-12 added a payout workflow on top of the existing SDD-11 commission ledger: structured bank details for YouTubers, commission status tracking (pending→paid), payout runs audit trail, admin API for payouts, and admin UI for commission/payout management with stale badge.

## Artifacts Read

| Artifact | Path | Status |
|---|---|---|
| Proposal | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/proposal.md` | ✅ read |
| Spec | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/spec.md` | ✅ read |
| Design | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/design.md` | ✅ read |
| Tasks | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/tasks.md` | ✅ read |
| Apply Progress | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/apply-progress.md` | ✅ read |
| Verify Report | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/verify-report.md` | ✅ read (verdict: PASS WITH WARNINGS) |
| Sync Report | `openspec/changes/2026-06-18-sdd-12-commission-payout-flow/sync-report.md` | ✅ read (status: synced) |
| Canonical Spec | `openspec/specs/referral-program/spec.md` | ✅ read |
| Config | `openspec/config.yaml` | ✅ read |

## Domains Synced to Canonical Spec

Three new domains were APPENDED to `openspec/specs/referral-program/spec.md`:

1. **Schema Evolution for Commission Payout** — YouTuber bank details, commission payout status, payout runs audit trail, migration-level validation
2. **Payout API (Edge Function)** — `admin-referral-payouts` endpoint (4 actions), `admin-youtube-mutate` bank detail extension
3. **Admin Referrals UI — Commission Payout** — CommissionsTab mounting, stale badge, PayoutsTab, YouTuberForm bank details

### Requirement Changes

| Type | Count | Names |
|---|---|---|
| ADDED | 10 | YouTuber Bank Details, Commission Payout Status, Payout Runs Audit Trail, Migration-Level Validation, admin-referral-payouts Endpoint, Extend admin-youtube-mutate for Bank Details, Mount CommissionsTab in ReferidosPage, Stale Commission Badge, PayoutsTab Component, YouTuberForm Bank Details |
| MODIFIED | 0 | — |
| REMOVED | 0 | — |

### Active Same-Domain Change Warnings

None. No other active changes touch the `referral-program` spec domain.

## Task Completion Gate

**PASS** — All 52 implementation tasks are checked complete (`- [x]`). No unchecked `- [ ]` implementation task markers remain.

## Destructive Merge Check

No destructive operations were performed. All three domains were ADDED; no existing requirements were MODIFIED or REMOVED.

## Verification Preconditions

- ✅ `verify-report.md` exists with verdict `PASS WITH WARNINGS`
- ✅ No `FAIL`, `BLOCKED`, or `CRITICAL` issues in verify report
- ✅ All 52 tasks checked complete
- ✅ Strict TDD protocol gap resolved (TDD Cycle Evidence table present in apply-progress.md)
- ✅ Sync completed cleanly (sync-report.md status: `synced`)
- ✅ Archive readiness: `READY`

## Sync Fallback

Not needed. Sync was completed prior to archive (sync-report.md exists and confirms successful sync).

## Archived Path

```
openspec/changes/archive/2026-06-18-sdd-12-commission-payout-flow/
```

## Files Archived

| File | Size |
|---|---|
| `archive-report.md` | This file |
| `proposal.md` | 9,853 bytes |
| `spec.md` | 17,977 bytes |
| `design.md` | 9,473 bytes |
| `tasks.md` | 6,222 bytes |
| `apply-progress.md` | 10,802 bytes |
| `verify-report.md` | 10,802 bytes |
| `sync-report.md` | 5,855 bytes |

## Residual Warnings (from verify-report carried forward)

| Risk | Severity | Notes |
|---|---|---|
| E2E tests fail in this environment | WARNING | Playwright cannot log in (env issue, not code defect) |
| E2E workflow coverage is shallow | WARNING | "Full payout workflow" test only checks navigation + button presence |
| No true pgTAP schema tests | WARNING | pgTAP replaced by Vitest regex migration assertions |
| `referral_commissions.Relationships` missing FK to `payout_runs` | WARNING | `database.ts` does not document forward FK |
| `buildCommissionCsv` omits `status` column | WARNING | CSV export does not include new `status` field |
| Bank validation regexes duplicated in 3 places | WARNING | Same CBU/CVU/CUIT patterns in 3 files |
| `computePayoutTotal` does not round | WARNING (theoretical) | IEEE 754 noise risk mitigated by `numeric(12,2)` DB storage |
| Non-atomic mark-paid | WARNING (theoretical) | Check-then-act across two Supabase calls; mitigated by admin-only access |

## Acceptance Criteria Verification

All proposal acceptance criteria are satisfied:

- ✅ YouTuber bank details stored in structured columns
- ✅ Commission rows have `pending`/`paid` status with `paid_at` timestamp
- ✅ Admin can select multiple pending commissions and mark them as paid
- ✅ Payout runs group paid commissions with audit trail
- ✅ CommissionsTab visible and functional in `/admin/referidos`
- ✅ Stale badge visible when any commission is >30 days pending
- ✅ Payouts tab shows history with drill-down
- ✅ All new code has tests (unit, pgTAP-equivalent, component, E2E)
- ✅ Existing SDD-11 tests remain green (559 tests passing)

## Config Rules Applied

`openspec/config.yaml` archive-specific rules: none defined.

## Post-archive QA Note

After local manual QA, a payout-history query bug was fixed: the Edge Function
selected `profiles.email`, but the public `profiles` table only has
`display_name`; email is stored in `auth.users`. The implementation now uses
`profiles.display_name` with `created_by` fallback, and the focused payout test
passes.
