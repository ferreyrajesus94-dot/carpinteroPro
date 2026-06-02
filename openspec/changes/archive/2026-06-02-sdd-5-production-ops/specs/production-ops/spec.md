# Production Ops Specification

## Purpose

Define the documentation, environment configuration, and operational procedures required to deploy, maintain, and recover CarpinteroPro in production. The outcome MUST enable a maintainer to answer: what secrets are required, how production is configured, how to deploy safely, and how to recover from a bad release — without relying on undocumented institutional knowledge.

## Requirements

### Requirement: Complete Environment Variable Example

The repository MUST provide a `.env.example` file that enumerates all required and optional environment variables for local development and deployment. The file MUST clearly separate public frontend variables (`VITE_*`) from server-only secrets, MUST contain no real secret values, and MUST comment on where each secret is stored (Supabase Edge Function secrets, Vercel dashboard).

#### Scenario: New developer local setup

- GIVEN a developer has cloned the repository and installed dependencies
- WHEN they copy `.env.example` to `.env.local` and supply valid values for all uncommented variables
- THEN `npm run dev` starts successfully and the application can authenticate against Supabase

#### Scenario: No secret leakage in example file

- GIVEN `.env.example`
- WHEN reviewed for secret values
- THEN no non-placeholder values exist for `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or any other secret, and comments mark them as server-only

### Requirement: Project-Specific README

`README.md` MUST be rewritten from Vite template boilerplate into project-specific onboarding. It MUST include: project purpose, tech stack summary, prerequisites, local setup steps, available npm scripts, test commands, deployment overview, and links to operational documentation in `docs/operations/`.

#### Scenario: New contributor onboarding

- GIVEN a new contributor opens `README.md`
- WHEN they follow the setup steps through the "Quick start" section
- THEN they have a working local dev environment with `npm run dev` serving the app

#### Scenario: README links to operational docs

- GIVEN `README.md`
- WHEN reviewed
- THEN it contains relative links to `docs/operations/environment-setup.md` and `docs/operations/supabase-production-checklist.md`

### Requirement: Environment Setup Guide

The repository MUST contain `docs/operations/environment-setup.md` documenting environment management for local, preview/staging, and production contexts. The guide MUST include: how to obtain Supabase credentials, how to configure MercadoPago sandbox vs production, where each secret is stored (Vercel env vars, Supabase Edge Function secrets), and a troubleshooting section for common setup failures.

#### Scenario: MercadoPago sandbox configuration

- GIVEN a developer needs to test billing flows locally
- WHEN they follow `docs/operations/environment-setup.md`
- THEN they know which Supabase secrets to set and which MercadoPago dashboard values to copy, without the doc containing any secret values

#### Scenario: Production environment variable inventory

- GIVEN a maintainer needs to verify the Vercel production project configuration
- WHEN they read the environment setup guide
- THEN they find a checklist of required Vercel environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WORKSHOP_ID`) and a reference to the Supabase Edge Function secrets that must be set separately

### Requirement: Supabase Production Checklist

The repository MUST contain `docs/operations/supabase-production-checklist.md` covering production readiness for the Supabase project. The checklist MUST include: auth redirect URL allow-list verification, Edge Function secret inventory, RLS policy sanity check steps, migration status verification, backup verification, and a reference to `docs/operations/supabase-migration-reconciliation.md` for migration ledger status.

#### Scenario: Pre-deployment verification

- GIVEN a deployment to production is planned
- WHEN the maintainer completes the Supabase production checklist
- THEN auth site URLs and redirect URLs match the production domain, all Edge Function secrets are set, the latest migration is applied, and RLS is enabled on all new tables

#### Scenario: Post-schema-change validation

- GIVEN a new database migration was deployed
- WHEN the maintainer follows the checklist
- THEN they confirm RLS policies exist for newly created tables and that the remote migration ledger matches expectations

### Requirement: Migration and Deployment Procedures

The repository SHOULD contain `docs/operations/migration-deployment.md` documenting safe migration deployment. The document MUST include: pre-deployment checks (local test, backup confirmation), the correct Supabase CLI workflow (avoiding `db push --linked` until migration reconciliation is complete), verification steps after deployment, and troubleshooting for common failures.

#### Scenario: Safe migration deployment

- GIVEN a new migration file exists in `supabase/migrations/`
- WHEN a maintainer follows the migration deployment document
- THEN they deploy the migration using a safe CLI sequence that does not mutate the remote ledger without explicit reconciliation approval

#### Scenario: Deployment failure recovery

- GIVEN a migration deployment failed or caused unexpected behavior
- WHEN the maintainer consults the migration deployment doc
- THEN they find troubleshooting steps and a link to `docs/operations/rollback-runbook.md`

### Requirement: Rollback Runbook

The repository SHOULD contain `docs/operations/rollback-runbook.md` documenting rollback procedures. The runbook MUST cover: Vercel frontend deployment revert, Supabase migration recovery (restore from backup or repair ledger), and Edge Function redeployment of a previous version. It MUST state when rollback is appropriate and what communication steps are recommended.

#### Scenario: Frontend bad release rollback

- GIVEN a bad release is deployed to Vercel production
- WHEN the runbook is followed
- THEN the previous Vercel deployment is restored within minutes and the production URL serves the last known good build

#### Scenario: Database recovery path

- GIVEN a bad migration was applied to the production database
- WHEN the runbook is followed
- THEN the maintainer knows whether to use Supabase PITR, restore from a backup, or run a forward-fix migration, and when to escalate rather than attempt direct database manipulation

### Requirement: Vercel Configuration Decision

A decision record MUST exist in `docs/operations/vercel-config-decision.md` (or an equivalent section in another operations doc) that evaluates whether to add `vercel.json` for SPA routing and conservative security headers. The decision MUST explicitly consider impact on Supabase Auth redirects, MercadoPago integrations, PWA service worker/assets, and Vite chunk loading. If `vercel.json` is added, it MUST include a rewrite for SPA routing and headers that do not break those integrations.

#### Scenario: Decision to defer `vercel.json`

- GIVEN the decision record is read
- WHEN the conclusion is to defer `vercel.json`
- THEN the record explains the risk accepted (missing security headers) and the conditions that would trigger implementation (e.g., security audit, compliance requirement)

#### Scenario: Decision to implement `vercel.json`

- GIVEN the decision is to add `vercel.json`
- WHEN it is implemented and `npm run build` is run
- THEN the build succeeds and the output assets load correctly in a preview deployment, including the PWA manifest, service worker, and all chunks referenced by the generated HTML

## Verification

### Code/Config Changes

If any slice introduces files with runtime or build-time impact — including but not limited to `vercel.json`, `.vercelignore`, CI workflow changes, or environment validation scripts — the following MUST pass before the slice is considered complete:

- `npm test` exits 0
- `npm run lint` exits 0
- `npm run build` exits 0

### Documentation-Only Changes

Slices that change only markdown documentation, `.env.example` comments, or `README.md` qualify for the structural exception defined in `openspec/config.yaml`. No failing runtime test is required for these slices. They MUST still pass `npm run lint` if the project lints markdown, and `npm run build` MUST pass if the build is affected by excluded files (e.g., `.vercelignore`).

### Cross-Link Accuracy

All internal documentation links MUST be verified manually or via a link check before merge:

- `README.md` links to `docs/operations/environment-setup.md` and `docs/operations/supabase-production-checklist.md`
- `docs/operations/supabase-production-checklist.md` links to `docs/operations/supabase-migration-reconciliation.md`
- `docs/operations/migration-deployment.md` links to `docs/operations/rollback-runbook.md`
- Any decision record links back to the proposal or prior design context

### Secret Value Audit

Before merge, the changed files MUST be audited to confirm:

- No real API keys, tokens, passwords, or service role keys are present
- `.env.example` contains only placeholders or empty values for secrets
- Operational docs describe where to obtain secrets but do not contain them

## Delivery Slices

To respect the 400 changed-line review budget per PR, the implementation SHOULD be split into the following reviewable slices. Line counts are estimates based on current file sizes and expected documentation length.

| Slice | Contents | Estimated Lines | Risk |
|---|---|---|---|
| 1 | `.env.example` (completion) + `README.md` (rewrite) | ~150 | Low |
| 2 | `docs/operations/environment-setup.md` + `docs/operations/supabase-production-checklist.md` | ~250 | Low |
| 3 | `docs/operations/migration-deployment.md` + `docs/operations/rollback-runbook.md` | ~200 | Low |
| 4 | `vercel.json` + `.vercelignore` + `docs/operations/vercel-config-decision.md` | ~80 | Medium |

**Notes:**
- Slice 1 is P1 and MUST be delivered first.
- Slice 2 is P1 and can be delivered in parallel with or after slice 1.
- Slice 3 is P2 and SHOULD be delivered after slice 2.
- Slice 4 is P2 and MUST wait for the explicit decision criteria to be evaluated.
- If any slice grows beyond 400 changed lines during implementation, it MUST be split further or recorded as a `size:exception` per `openspec/config.yaml` conventions.
