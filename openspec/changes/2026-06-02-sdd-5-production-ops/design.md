# SDD 5 Design — Production Ops

CarpinteroPro production operations will be delivered as reviewable documentation-first work units. The implementation should make environment setup, Supabase production readiness, migration deployment, rollback, and Vercel configuration decisions explicit without changing application behavior in P1/P2 docs slices.

## Design summary

| Area | Decision |
| --- | --- |
| Delivery model | Four chained/reviewable slices, each kept under the 400 changed-line budget. |
| Runtime behavior | No runtime behavior changes in slices 1-3. Slice 4 is a decision record first; `vercel.json` is deferred unless criteria are satisfied and explicitly accepted. |
| TDD stance | Documentation-only structural exception applies to README, operations docs, and `.env.example` comments/placeholders. Any runtime/build-impacting config requires full test/lint/build verification. |
| Documentation architecture | README is the entry point and quick path; `docs/operations/` owns operational depth, checklists, runbooks, and decision records. |
| Secret safety | All examples use placeholders or empty values; server-only secrets are documented by storage location, never by value. |
| Rollback | Docs can be reverted by slice/file. Optional deployment config, if ever added, must be independently revertible. |

## Current-state inputs

- `README.md` is still the Vite template and needs a project-specific rewrite.
- `.env.example` exists but could not be read in this agent because the safety layer blocked sensitive-path access; prior spec evidence reports it is short/incomplete and missing `VITE_WORKSHOP_ID` plus secret-placement guidance. Apply must inspect it carefully without printing or exposing secret-like values.
- Frontend code reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `import.meta.env`.
- The SDD 5 spec requires `VITE_WORKSHOP_ID` in the Vercel production inventory even if current code does not directly reference it; implementation should either document it as deployment/context inventory or flag the mismatch in apply if found obsolete.
- Supabase Edge Functions read these server-side values: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `APP_ORIGIN`, and `MERCADOPAGO_SANDBOX_PAYER_EMAIL`.
- `docs/operations/supabase-migration-reconciliation.md` already exists and must be linked from the Supabase production checklist.
- No `vercel.json` or `.vercelignore` is present according to prior spec/explore evidence.
- Do not touch pre-existing repo-state risk paths: `supabase/.temp/cli-latest` and `.playwright-mcp/`.

## Documentation architecture

### README ownership

`README.md` should be optimized for first contact and contributor onboarding:

1. What CarpinteroPro is and who it serves.
2. Stack summary: React/Vite/TypeScript/Tailwind, Supabase, MercadoPago, Vitest.
3. Prerequisites.
4. Quick start: install, copy `.env.example` to `.env.local`, fill public Supabase values, run `npm run dev`.
5. Scripts table: `dev`, `build`, `lint`, `test`, `test:watch`, `preview`.
6. Deployment overview: Vercel frontend, Supabase backend/functions/migrations, production checklist before release.
7. Operations links:
   - `docs/operations/environment-setup.md`
   - `docs/operations/supabase-production-checklist.md`
   - `docs/operations/migration-deployment.md` if delivered
   - `docs/operations/rollback-runbook.md` if delivered
   - `docs/operations/vercel-config-decision.md` if delivered

README should not duplicate detailed production procedures. It should link to operations docs instead.

### Operations docs ownership

| File | Owns | Does not own |
| --- | --- | --- |
| `docs/operations/environment-setup.md` | Local, preview/staging, and production environment variable inventory; where to retrieve public keys; where to store server-only secrets; MercadoPago sandbox vs production setup; common setup failures. | Detailed migration recovery or release rollback steps. |
| `docs/operations/supabase-production-checklist.md` | Operator checklist for Supabase readiness: auth URLs, redirect allow-list, Edge Function secrets, RLS sanity checks, migration status, backups, and link to migration reconciliation. | Full migration deployment procedure beyond checklist references. |
| `docs/operations/migration-deployment.md` | Safe Supabase migration workflow, prechecks, approved CLI commands, avoidance of `db push --linked` until ledger reconciliation, post-deploy verification, failure troubleshooting. | Incident communications or Vercel rollback procedure except links. |
| `docs/operations/rollback-runbook.md` | Incident entry criteria, Vercel deployment revert, Supabase recovery choices, Edge Function redeploy, communications/checkpoints. | Monitoring/alerting implementation, which remains SDD 6 scope. |
| `docs/operations/vercel-config-decision.md` | Decision record and criteria for deferring or adding `vercel.json`; compatibility checklist for SPA routing, headers, Supabase Auth, MercadoPago, PWA assets, Vite chunks. | Implementing headers unless explicitly accepted in slice 4. |

### Document format rules

- Lead with the action or decision, then provide details.
- Use checklists for operator workflows.
- Use tables for environment inventories and file ownership.
- Keep examples secret-safe: placeholders such as `<supabase-project-url>`, `<anon-key>`, `<set-in-supabase-secrets>`, never real tokens.
- Prefer relative links and verify every cross-link before merge.
- Include an “Out of scope / SDD 6 handoff” note where observability/support could otherwise creep in.

## Environment variable design

`.env.example` should separate public frontend variables from server-only values.

### Public frontend variables

These may appear as empty assignments or placeholder values because Vite exposes `VITE_*` to the browser:

```dotenv
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
VITE_WORKSHOP_ID=<local-or-preview-workshop-id-if-required>
```

Implementation notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are used by frontend Supabase clients.
- `VITE_WORKSHOP_ID` is required by the SDD 5 spec production inventory; apply should verify whether it remains a live app requirement or only an operational/deployment inventory item.
- No service role key belongs in frontend env.

### Server-only values

Server-only values should be listed as comments or explicitly marked `DO NOT put in frontend .env.local` unless a local Supabase Function workflow requires a local secret file outside the browser build. Document where each is stored:

| Variable | Storage | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase Edge Function secret / function runtime | Server-side Supabase client URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secret only | Privileged server-side operations; never exposed in Vercel frontend env. |
| `MERCADOPAGO_ACCESS_TOKEN` | Supabase Edge Function secret | MercadoPago API access. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Supabase Edge Function secret | Webhook signature validation. |
| `APP_ORIGIN` | Supabase Edge Function secret or deployment runtime config | CORS/redirect origin for frontend. |
| `MERCADOPAGO_SANDBOX_PAYER_EMAIL` | Supabase Edge Function secret for sandbox | Sandbox test payer identity. |

## Vercel configuration decision

The preferred SDD 5 design is to deliver a decision record first and defer `vercel.json` implementation. The spec allows implementation only after compatibility criteria are evaluated; the current phase does not have evidence that headers/rewrites are urgent enough to justify build/deploy behavior changes.

### Default decision for apply

- Add `docs/operations/vercel-config-decision.md` in slice 4.
- Record status as `Deferred` unless the implementer has explicit product/security approval to add config.
- Do not add `vercel.json` or `.vercelignore` in this SDD apply by default.

### Criteria that would justify implementation

Add `vercel.json` only if at least one trigger is true:

- Vercel preview/production deep links do not route correctly to the SPA.
- A security review/compliance requirement mandates headers before launch.
- The team accepts the verification burden for preview deployment compatibility.

If implemented, it must be conservative:

- SPA rewrite to `/index.html` must preserve static assets, manifest, service worker, and Vite chunks.
- Headers must not block Supabase Auth redirects, MercadoPago checkout/webhook flows, PWA manifest/service worker, images/icons, or generated JS/CSS chunks.
- Full verification for config changes is mandatory: `npm test`, `npm run lint`, `npm run build`, plus preview deployment smoke checks.

## Work-unit boundaries

Each work unit should be independently reviewable and commit-ready. Do not commit during design; these are boundaries for `sdd-tasks`/apply.

| Slice | Work unit | Files | Acceptance focus | Verification | Rollback |
| --- | --- | --- | --- | --- | --- |
| 1 | Contributor onboarding and env example | `.env.example`, `README.md` | New contributor can identify required public env vars, install, run, test, and find operations docs. | Structural docs exception; manual secret audit; cross-link check for links that exist in same/previous slice; optional `npm run lint` if markdown is linted. | Revert `.env.example`/`README.md` changes only. |
| 2 | Environment and Supabase production readiness | `docs/operations/environment-setup.md`, `docs/operations/supabase-production-checklist.md` | Maintainer can configure local/preview/prod env and complete Supabase production checklist. | Structural docs exception; secret audit; verify link to `supabase-migration-reconciliation.md`; command text sanity check. | Revert these two docs. |
| 3 | Migration deployment and rollback | `docs/operations/migration-deployment.md`, `docs/operations/rollback-runbook.md` | Maintainer can deploy migrations safely and recover from frontend/database/function incidents. | Structural docs exception; secret audit; verify rollback links; review Supabase CLI commands for non-destructive wording. | Revert these two docs. |
| 4 | Vercel config decision | `docs/operations/vercel-config-decision.md` by default; optional `vercel.json`/`.vercelignore` only with approval | Decision explicitly evaluates defer vs implement and compatibility with auth, MercadoPago, PWA, and Vite assets. | Docs-only if decision record only. If config files added: `npm test`, `npm run lint`, `npm run build`, preview smoke test. | Revert decision/config independently; if config broke deployment, remove `vercel.json` first. |

### Workload strategy

- Keep each slice below 400 changed lines.
- If slice 2 or 3 grows over budget, split by document rather than compressing checklists into unreadable prose.
- Prefer concise operator checklists over long background sections.
- Use chained PR-ready commits in the order above; P1 slices 1-2 first, P2 slices 3-4 after.
- If optional `vercel.json` is accepted, it should be its own commit/PR with the decision record and verification evidence.

## Data flow and operational flow

### Environment setup flow

1. Developer copies `.env.example` to `.env.local`.
2. Developer fills only browser-safe Vite variables for local frontend use.
3. Server-only values are configured in Supabase Edge Function secrets for deployed functions and in secret-safe local function workflows when needed.
4. Vercel receives only frontend-safe `VITE_*` variables for frontend builds unless a future server runtime is introduced.
5. Supabase Auth redirect settings are verified against local, preview, and production origins.

### Deployment flow

1. Confirm local tests and build status for code/config-bearing releases.
2. Check Supabase production readiness: auth URLs, Edge Function secrets, migration ledger, RLS, backups.
3. Deploy/apply migrations only through the documented safe Supabase CLI path.
4. Let Vercel auto-deploy frontend from `main` or use dashboard promotion/revert as documented.
5. Run post-deployment smoke checks and record any SDD 6 observability/support follow-ups separately.

### Rollback flow

1. Classify incident: frontend-only, Edge Function-only, migration/database, or mixed.
2. Prefer least-destructive rollback: Vercel revert for frontend, redeploy previous function for function-only issue, forward-fix or backup restore decision for database issue.
3. For database incidents, do not directly mutate production metadata/data without explicit approval; use Supabase backup/PITR or a reviewed forward-fix migration when appropriate.
4. Communicate impact, action owner, current status, and recovery verification.

## Verification plan

### Structural/documentation TDD exception

Slices that only change `README.md`, markdown files under `docs/operations/`, or `.env.example` comments/placeholders have no runtime behavior. They qualify for the structural exception in `openspec/config.yaml`; no failing Vitest test is required before writing them.

Required checks for docs-only slices:

- Manual review that no real secrets, tokens, passwords, service role keys, or MercadoPago credentials are present.
- Manual or scripted internal link validation.
- Command validation by inspection: commands must be plausible, non-destructive by default, and dangerous commands must be marked approval-only.
- Verify docs do not instruct storing server-only secrets in frontend-exposed Vercel/Vite env.
- Run `npm run lint` only if the project lints markdown or the slice touches linted files.

### Runtime/build-impacting config verification

If any slice adds or changes `vercel.json`, `.vercelignore`, CI workflows, environment validation scripts, app code, SQL, or Supabase function code, the structural exception no longer applies. Required checks:

```bash
npm test
npm run lint
npm run build
```

Additional checks for `vercel.json`:

- Preview deployment loads `/`, `/dashboard`, and a nested app route via direct URL.
- Generated JS/CSS chunks load without 404s.
- PWA manifest and service worker assets load.
- Supabase Auth callback/redirect URL still works.
- MercadoPago checkout return/callback paths documented for the app still work.

### Secret audit pattern

Before merge, inspect only changed files:

```bash
git diff -- README.md docs/operations .env.example
git diff --check
```

Look for real-looking values for:

- `SUPABASE_SERVICE_ROLE_KEY`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- passwords, bearer tokens, JWTs, API keys, private URLs not intended for docs

Do not print real secret values in review notes if discovered; remove them and rotate externally if necessary.

## Rollout plan

1. Deliver slice 1 so README and env onboarding become immediately useful.
2. Deliver slice 2 so production readiness and environment inventories are available before any deployment changes.
3. Deliver slice 3 to cover migration deployment and rollback recovery.
4. Deliver slice 4 as a Vercel decision record. Keep implementation deferred unless criteria and approval exist.
5. Archive SDD 5 only after links and verification evidence are recorded in verify artifacts.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Secret leakage in examples | Placeholders only; changed-file secret audit before merge; never document real dashboard values. |
| Docs drift from external dashboards | Use “verify in dashboard” checklist wording rather than hardcoding unknown settings. |
| `VITE_WORKSHOP_ID` spec/code mismatch | Apply should verify whether it is required operationally; document mismatch rather than inventing runtime usage. |
| Migration ledger confusion | Link to `supabase-migration-reconciliation.md`; warn against `supabase db push --linked` until reconciliation approval. |
| Scope creep into observability/support | Keep monitoring, alerting, support workflow, and dashboards as SDD 6 handoff only. |
| Optional Vercel config breaks production | Decision record first; implementation only with approval and full test/lint/build/preview smoke verification. |
| Dirty repo-state paths are accidentally touched | Explicitly exclude `supabase/.temp/cli-latest` and `.playwright-mcp/`; check changed files before apply. |

## Open decisions for tasks/apply

- Whether to deliver slice 4 as P2 decision-record-only in the same chain or defer it after P1 docs are merged. Design default: include the decision record, defer config.
- Whether `VITE_WORKSHOP_ID` is still operationally required. Design default: include it as required by the spec, with a note if code no longer reads it.
