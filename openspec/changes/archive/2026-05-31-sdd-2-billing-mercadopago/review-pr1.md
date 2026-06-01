## Review

**Verdict:** ❌ Not complete for PR 1. Scope is mostly correct, but there are blockers in SQL assertions/verification and review workload pollution.

**I did not write** `/home/elias/Proyectos/carpinteroPro/openspec/changes/sdd-2-billing-mercadopago/review-pr1.md` because the task also says “Do not edit files”; no-edit wins.

### Correct
- PR 1 scope is respected: inspected changes are DB migration + database types only. No Edge Functions/frontend/settings/legal changes found in `git diff --name-only`.
- `subscriptions` table includes the required core columns, RLS, own-workshop SELECT policy, one-row-per-workshop unique index, and provider preapproval index: `supabase/migrations/0022_billing_schema.sql:12-48`.
- Trial trigger is present and idempotent via `ON CONFLICT (workshop_id) DO NOTHING`: `supabase/migrations/0022_billing_schema.sql:86-120`.
- Type additions include `Relationships: []` for both new tables: `src/shared/types/database.ts:714-803`.

### Blockers
1. **SQL/RLS assertions do not meet the spec/tasks.**  
   Spec requires assertions that fail if a user can SELECT/INSERT/UPDATE/DELETE another workshop’s subscription: `spec.md:65-71`. Tasks require actual cross-tenant SELECT, direct INSERT denial, trigger firing, and idempotency assertions: `tasks.md:74-81`, plus own SELECT/trigger edge cases: `tasks.md:142-149`.  
   Current migration only checks catalog metadata/policy text/function body: `0022_billing_schema.sql:126-230`. This does not prove tenant isolation or trigger behavior.

2. **Invalid `updated_at` trigger on `billing_webhook_events`.**  
   The table has no `updated_at` column: `0022_billing_schema.sql:60-69`, but a trigger calls `set_updated_at()` on update: `0022_billing_schema.sql:78-81`. Existing `set_updated_at()` assigns `NEW.updated_at := now()`, so any update to this table will fail at runtime. Fix by adding `updated_at timestamptz NOT NULL DEFAULT now()` and updating types, or remove the trigger.

3. **Review workload budget is blown by database type reformatting.**  
   Claimed workload says `database.ts` is `+90` and total `~320`: `apply-pr1-progress.md:17-23`, but actual `git diff --stat` shows:
   - `src/shared/types/database.ts | 1655` changed lines, `865 insertions / 790 deletions`
   - migration adds another 230 lines untracked
   This exceeds the 400-line budget and pollutes review. Diff shows broad formatting changes at file top, not only table additions.

### Concerns
- Verification claim is weak: `supabase migration up --local --include-all` reported “Local database is up to date”: `apply-pr1-progress.md:43-47`. That does not prove the current migration file applies cleanly from reset, especially if local ledger already marked 0022 applied.
- Migration assertions are production-safe in the sense that they only inspect catalogs, but that safety was achieved by dropping the behavioral guarantees required by PR 1.

### Required fixes
1. Replace/augment catalog-only checks with real SQL assertions for:
   - own-workshop SELECT allowed
   - cross-workshop SELECT denied
   - authenticated direct INSERT/UPDATE/DELETE denied
   - onboarding transition creates one trial row
   - non-null → non-null onboarded update does not reset/create trial
2. Fix `billing_webhook_events_updated_at` trigger mismatch.
3. Restore `src/shared/types/database.ts` formatting and make a minimal diff containing only intended table type additions.
4. Update apply progress/review workload numbers after the real diff is clean.

### Suggested verification
Parent should rerun after fixes:
```bash
supabase db reset
supabase migration up
npm test
npm run lint
npm run build
git diff --stat
git diff --check
```

### review_workload
- Current PR is **over budget** due to `database.ts` churn.
- Should be corrected before considering PR 1 complete.

### scope_check
- ✅ Scope stays within PR 1 functional boundary.
- ❌ Quality/verification and review-budget requirements are not satisfied.