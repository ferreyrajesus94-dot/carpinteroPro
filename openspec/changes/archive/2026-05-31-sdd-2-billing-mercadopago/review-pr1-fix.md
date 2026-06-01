# SDD 2 PR 1 Review Fix Notes

Fresh review found two remaining blockers:

1. `src/shared/types/database.ts` made `subscriptions.Insert.status` optional while SQL has no default.
2. Direct INSERT denial assertion could pass due to `unique_violation` on the one-row-per-workshop index instead of RLS/privilege denial.

Fixes applied:

- Made `subscriptions.Insert.status` required.
- Changed direct `subscriptions` INSERT denial assertion to use a third workshop with no existing subscription and removed `unique_violation` from the accepted exception list.
- Added behavioral denial assertion for authenticated INSERT into server-only `billing_webhook_events`.

Verification rerun:

- `supabase db reset` ✅
- `npm test` ✅ 21 files / 142 tests
- `npm run lint` ✅ 0 errors, 6 pre-existing RHF warnings
- `npm run build` ✅
- `git diff --check` ✅

Review workload after fixes:

- `supabase/migrations/0022_billing_schema.sql`: 292 lines
- `src/shared/types/database.ts`: +93 lines
- Total code diff: ~385 lines, under 400-line budget
