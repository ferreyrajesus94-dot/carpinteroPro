# SDD 2 PR 1 Apply Progress — Billing Schema, RLS, Trial Trigger, SQL Tests

## Status

`apply_pr1_fixed_after_review` — PR 1 schema slice implemented, reviewer blockers addressed, local verification passing.

## Scope Delivered

- `supabase/migrations/0022_billing_schema.sql`
  - `subscriptions` table scoped by `workshop_id`, RLS enabled, own-workshop SELECT policy only.
  - `billing_webhook_events` table scoped by `workshop_id`, RLS enabled, no client policies, unique `(provider, provider_event_id)`.
  - `updated_at` triggers on both tables; `billing_webhook_events` now includes `updated_at`.
  - Idempotent trial trigger on `profiles.onboarded_at` NULL → non-NULL transition.
  - Behavioral migration assertions for own SELECT, cross-tenant denial, direct INSERT/UPDATE/DELETE denial, trial creation/idempotency, and duplicate webhook event prevention.
- `src/shared/types/database.ts`
  - Minimal type additions only for `subscriptions` and `billing_webhook_events`.
  - `Relationships: []` preserved for both new tables.

## Review Fixes Applied

1. Replaced catalog-only RLS checks with real fixture-backed behavioral assertions.
2. Fixed invalid `billing_webhook_events_updated_at` trigger by adding `updated_at` column and matching TS type.
3. Restored `src/shared/types/database.ts` formatting to avoid polluted whole-file diff.
4. Reduced SQL artifact size while preserving behavioral assertions; review workload now stays under 400 changed lines.

## TDD Evidence

### RED

Initial fresh review found PR 1 incomplete:
- SQL assertions were catalog-only and did not prove cross-tenant behavior.
- `billing_webhook_events` had an `updated_at` trigger without an `updated_at` column.
- `database.ts` was reformatted, causing a >1,600-line polluted diff.

### GREEN

Implemented schema/assertion fixes and reran local DB reset from scratch:

```bash
supabase db reset
# Finished supabase db reset on branch main.
```

### TRIANGULATE

Added fixture-backed assertions proving:
- authenticated user A sees only workshop A subscription;
- authenticated user A cannot see workshop B subscription;
- authenticated direct INSERT is denied;
- authenticated UPDATE/DELETE mutate zero rows without mutation policies;
- onboarding completion creates exactly one trial row;
- non-null → non-null onboarding update does not create/reset another trial;
- duplicate provider webhook event IDs are rejected.

### REFACTOR

- Removed broad TS formatting churn; `database.ts` diff is now only +93 intended lines.
- Removed nonessential SQL comments to keep PR 1 under the 400-line review budget.

## Verification Results

| Command | Result |
|---------|--------|
| `supabase db reset` | ✅ Applied all migrations including `0022_billing_schema.sql` from scratch |
| `npm test` | ✅ 21 files passed, 142 tests passed |
| `npm run lint` | ✅ 0 errors, 6 pre-existing RHF `watch()` warnings |
| `npm run build` | ✅ Built successfully |
| `git diff --check` | ✅ No whitespace errors |

## Review Workload

| File | Changed lines |
|------|---------------|
| `supabase/migrations/0022_billing_schema.sql` | 279 new lines |
| `src/shared/types/database.ts` | +93 lines |
| **Total PR 1 code diff** | **~372 lines** |

Budget: under 400 changed lines. PR 1 remains a focused DB/RLS/types slice.

## Risks

- Existing profiles with `onboarded_at` already set are not backfilled by this trigger; only future onboarding transitions create trial rows.
- `billing_webhook_events` is service-role/server maintained; PR 2 must use Edge Functions with service role.
- Test fixtures insert temporary `auth.users`; the migration cleans them up before completion.

## Next Recommended

Run fresh review again. If clean, PR 1 is ready for user review/commit/PR preparation. Do not start PR 2 until MercadoPago sandbox/access token, webhook signature mechanism, Supabase Function secrets, and PR 1 staging verification are confirmed.
