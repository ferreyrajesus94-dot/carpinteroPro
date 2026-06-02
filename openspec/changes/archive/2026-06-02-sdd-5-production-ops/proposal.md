# SDD 5 Proposal — Production Ops

CarpinteroPro already has CI, Vercel auto-deploys from `main`, and tracked Supabase migrations. SDD 5 will make that production path operable and reviewable by documenting environment setup, deployment, Supabase production checks, and rollback procedures without expanding into full observability.

## Intent

Reduce launch and maintenance risk by replacing implicit production knowledge with clear operational documentation and minimal deployment configuration decisions. The outcome should let a maintainer answer: what secrets are required, how production is configured, how to deploy safely, and how to recover from a bad release.

## Scope

### P1 deliverables

- Complete `.env.example` with all required local/frontend variables and comments that point server-only secrets to Supabase/Vercel secret stores instead of exposing values.
- Rewrite `README.md` from Vite boilerplate into project-specific onboarding: purpose, stack, setup, scripts, tests, and deployment overview.
- Add `docs/operations/environment-setup.md` for local, preview/staging, and production environment management.
- Add `docs/operations/supabase-production-checklist.md` covering auth redirects, Edge Function secrets, RLS/migration checks, backups, and production readiness.

### P2 deliverables, if still within review budget

- Add `docs/operations/migration-deployment.md` or integrate equivalent steps into the Supabase checklist.
- Add `docs/operations/rollback-runbook.md` for Vercel frontend rollback, Supabase migration recovery, and Edge Function recovery.
- Decide whether to add `vercel.json` for SPA routing and conservative security headers; if headers require product/security tradeoffs, document the decision before implementation.

## Non-goals

- No monitoring dashboards, uptime checks, alert routing, logging pipeline, performance budgets, Lighthouse CI, or support workflows beyond a short handoff checklist for SDD 6.
- No database schema, RLS, billing, auth, or cache-behavior changes.
- No deployment automation unless later phases identify a very small, testable configuration-only improvement.
- No edits to existing repo-state risk paths: `supabase/.temp/cli-latest` and `.playwright-mcp/`.

## Affected areas

| Area | Expected change |
| --- | --- |
| `.env.example` | Document required public Vite variables and secret placement guidance. |
| `README.md` | Replace boilerplate with CarpinteroPro setup and operations entry point. |
| `docs/operations/` | Add production operations guides/checklists/runbooks. |
| `vercel.json` | Optional P2 configuration only after explicit design decision. |
| OpenSpec artifacts | Spec/design/tasks should keep scope constrained and reviewable. |

## TDD stance

Strict TDD remains required for any runtime behavior, scripts, CI automation, SQL/RLS, or validation logic. The planned P1 work is documentation/configuration structure, so it qualifies for the documented structural exception: no failing runtime test is required for README, operational docs, or `.env.example` comments. If later phases add environment validation code, CI jobs, migration checks, or Vercel behavior with observable runtime impact, tests or executable verification must be defined first.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Secret leakage while documenting env vars | Use placeholders only; explicitly mark service role and MercadoPago secrets as server-only/Supabase secrets. |
| Docs become inaccurate because production dashboard settings are external | Use checklist language with “verify in dashboard” steps and capture unknowns as follow-ups. |
| Scope creep into SDD 6 observability | Keep monitoring/support as non-goal; include only a future handoff checklist. |
| Security headers break Supabase auth, MercadoPago, PWA, or assets | Treat `vercel.json` headers as P2 design decision with verification checklist. |
| Review exceeds 400 changed lines | Split into work units: env/README, Supabase/env ops docs, rollback/deploy docs, optional Vercel config. |
| Pre-existing dirty/untracked state causes accidental churn | Do not touch `supabase/.temp/cli-latest` or `.playwright-mcp/`; verify changed files before apply. |

## Rollback

Documentation changes can be reverted per file. Optional `vercel.json` can be reverted independently if deployment behavior changes. No data migrations or application behavior changes are proposed for P1, so rollback should not require database recovery.

## Success criteria

- `.env.example` lists required public environment variables and clearly separates server-only secrets.
- `README.md` is project-specific and gives a new contributor a working local setup path.
- Supabase production configuration has a checklist covering auth redirects, secrets, RLS/migrations, and backup/recovery verification.
- Deployment and rollback steps are documented enough for a maintainer to follow without reconstructing prior SDD history.
- SDD 6 handoff is limited to observability/support items and does not implement monitoring.
- Review workload forecast is at or below 400 changed lines per PR/slice, with larger docs split into reviewable work units.
