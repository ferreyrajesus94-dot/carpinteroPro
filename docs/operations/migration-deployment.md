# Migration deployment guide

Use this guide when applying Supabase migrations to shared or production environments. The safe default is to verify first, mutate second, and avoid ledger-changing commands without approval.

## Quick path

1. Confirm local tests and build for releases that include code changes.
2. Review the migration file and backup status.
3. Check the remote migration ledger.
4. Apply only the intended migration workflow.
5. Verify schema, RLS, and app smoke paths after deploy.

## Pre-deployment checks

- [ ] `npm test` passes when the release includes behavior changes.
- [ ] `npm run build` passes when frontend code or build config changed.
- [ ] Migration SQL was reviewed for tenant isolation and RLS.
- [ ] Backup or PITR status is confirmed in Supabase production.
- [ ] The current remote migration ledger was checked.
- [ ] The migration is linked to a rollback or forward-fix plan.

## Command inventory

| Command | Default status | Use |
| --- | --- | --- |
| `npx supabase migration list --linked` | Safe read/check | Compare local and remote migration state. |
| `npx supabase db push --dry-run --linked` | Check only | Preview pending changes when reconciliation is safe. |
| `npx supabase db push --linked` | Approval required | Applies pending migrations to the linked project. Do not use while ledger reconciliation warnings apply. |
| `npx supabase migration repair --linked ...` | Approval required | Mutates migration metadata; use only for approved reconciliation. |
| `npx supabase gen types typescript ...` | Safe output generation | Regenerate database types after schema changes. |

## Reconciliation warning

Do **not** run `supabase db push --linked` until the migration ledger status is understood. CarpinteroPro has a documented reconciliation history; read [`supabase-migration-reconciliation.md`](supabase-migration-reconciliation.md) before pushing remote migrations.

## Safe deployment workflow

1. Run a ledger check:
   ```bash
   npx supabase migration list --linked
   ```
2. Confirm only the intended migration appears pending.
3. Confirm backup/PITR status in the Supabase dashboard.
4. If reconciliation is safe and approved, run a dry-run where supported:
   ```bash
   npx supabase db push --dry-run --linked
   ```
5. Apply the migration only after approval for the target environment:
   ```bash
   npx supabase db push --linked
   ```
6. Regenerate types if frontend code depends on schema changes.

## Post-deploy verification

- [ ] Migration appears applied in the remote ledger.
- [ ] New tenant tables include `workshop_id uuid NOT NULL`.
- [ ] RLS is enabled before the table is reachable from frontend queries.
- [ ] Policies use server-derived workshop identity, not client-provided tenant IDs.
- [ ] App smoke paths still work: auth, dashboard, quotes, CRM, billing paths touched by the change.
- [ ] Any type updates are committed with the schema-dependent code.

## Troubleshooting

| Problem | First response |
| --- | --- |
| Ledger shows unexpected pending historical migrations | Stop and revisit [`supabase-migration-reconciliation.md`](supabase-migration-reconciliation.md). |
| Migration fails before data changes | Capture error output, fix locally, and rerun only after review. |
| Migration partially applied or changed data | Stop direct mutation and use [`rollback-runbook.md`](rollback-runbook.md). |
| RLS is missing on a new table | Add a reviewed follow-up migration before exposing frontend access. |
| Types are stale | Regenerate types and run focused build/test checks. |

## Out of scope

Incident communication, Vercel rollback, and Edge Function redeploy steps are covered in [`rollback-runbook.md`](rollback-runbook.md).
