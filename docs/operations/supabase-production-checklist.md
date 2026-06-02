# Supabase production checklist

Complete this checklist before production deploys and after schema-affecting changes. Use dashboard verification instead of relying on memory.

## Quick path

1. Verify Auth URLs for the production and preview origins.
2. Confirm all Edge Function secrets are set.
3. Check migration status, RLS coverage, and backups.
4. Record any monitoring/support gaps as SDD 6 follow-ups.

## Auth configuration

- [ ] Site URL matches the production frontend origin.
- [ ] Redirect allow-list includes the production origin.
- [ ] Redirect allow-list includes approved preview/staging origins if used.
- [ ] Local development redirects are present only when appropriate.
- [ ] Email templates and links send users back to the intended frontend origin.

## Edge Function secrets

Verify these in the Supabase dashboard or with a secrets list command. Do not paste values into docs or tickets.

| Secret | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Server-side Supabase client URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged operations from Edge Functions. |
| `MERCADOPAGO_ACCESS_TOKEN` | Yes for billing | MercadoPago API calls. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Yes for webhooks | Webhook signature validation. |
| `APP_ORIGIN` | Yes | CORS and redirect origin. |
| `MERCADOPAGO_SANDBOX_PAYER_EMAIL` | Sandbox only | Test payer identity. |

- [ ] Each required secret exists for the target environment.
- [ ] Service role key is not configured in Vercel frontend env.
- [ ] Billing secrets match the selected MercadoPago mode: sandbox or production.
- [ ] Functions that depend on changed secrets are redeployed or reloaded as required by the current Supabase workflow.

## RLS sanity checks

- [ ] RLS is enabled on every table that stores tenant data.
- [ ] New tables include `workshop_id uuid NOT NULL` unless explicitly documented as global metadata.
- [ ] Policies derive workshop access from authenticated user/profile context, not browser-provided tenant IDs.
- [ ] Cross-tenant reads are denied in SQL or integration tests for security-sensitive changes.
- [ ] Manually maintained database types include `Relationships: []` or real relationship arrays.

## Migration status

- [ ] Latest local migration is present in `supabase/migrations/`.
- [ ] Remote migration ledger matches expectations.
- [ ] Numeric historical migrations and timestamp placeholders are reconciled according to [`supabase-migration-reconciliation.md`](supabase-migration-reconciliation.md).
- [ ] Do not run `supabase db push --linked` while reconciliation warnings still apply.
- [ ] New migrations after reconciliation use normal Supabase timestamped filenames.

## Backup verification

- [ ] Automatic backups are enabled for the production Supabase project.
- [ ] PITR status is known for the current plan, if available.
- [ ] A maintainer knows how to locate the latest restorable backup.
- [ ] Backup/restore permissions are limited to trusted operators.
- [ ] Recovery expectations are documented in [`rollback-runbook.md`](rollback-runbook.md).

## Post-schema-change validation

- [ ] Apply or verify the migration in the target environment.
- [ ] Confirm newly created tables have RLS enabled before exposing UI/API paths.
- [ ] Confirm new tenant tables have `workshop_id uuid NOT NULL`.
- [ ] Regenerate or update Supabase TypeScript types when schema changes affect frontend code.
- [ ] Run a smoke test for auth, dashboard load, quotes, CRM, and billing paths touched by the change.

## Out of scope / SDD 6 handoff

Monitoring dashboards, alert routing, logging pipelines, support workflows, health checks, and performance budgets are deferred to SDD 6. Record gaps found during this checklist as SDD 6 inputs instead of implementing them here.
