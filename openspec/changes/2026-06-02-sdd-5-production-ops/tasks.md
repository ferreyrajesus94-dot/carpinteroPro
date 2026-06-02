# SDD 5 — Production Ops: Implementation Tasks

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~600–750 across all four slices |
| 400-line budget risk | Low per slice; High if combined |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (slice 1) → PR 2 (slice 2) → PR 3 (slice 3) → PR 4 (slice 4) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low (per slice) / High (if combined)
```

## Key Discovery: VITE_WORKSHOP_ID Is Obsolete

SDD-1 (tenant RLS security) **removed `VITE_WORKSHOP_ID` from `.env.example`** and confirmed it obsolete. Server-side workshop identity is now derived via `auth.uid() → profiles.workshop_id`. No source code in `src/` references `VITE_WORKSHOP_ID`.

**Stale references that need cleanup:**
- `CLAUDE.md` lines 69 and 77 still mention `VITE_WORKSHOP_ID`
- The SDD 5 spec references `VITE_WORKSHOP_ID` in the environment-setup inventory

**Tasks below handle this:** Slice 1 cleans up `CLAUDE.md`; slice 2 documents the change in the environment setup guide instead of including the obsolete variable.

## Exclusions — Do Not Touch

- `supabase/.temp/cli-latest` — repo-state risk, leave as-is
- `.playwright-mcp/` — repo-state risk, leave as-is

---

## Slice 1 — Contributor Onboarding & Env Example (P1)

**PR target:** ~150 changed lines. Low risk.

### TDD Stance

Structural/documentation exception. No runtime behavior change. These files are `README.md`, `.env.example` (comments/placeholders only), and `CLAUDE.md` (documentation). Verification is manual audit + lint if applicable.

### Task 1.1 — Rewrite `.env.example`

- [x] **Inspect current `.env.example`** without printing secret values. Confirm which variables are present and which are missing.
- [x] **Update `.env.example`** with the following structure:

```dotenv
# === Public Frontend Variables (Vite — exposed to browser) ===
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>

# === Server-Only Secrets ===
# DO NOT add these to .env.local or Vercel frontend env.
# Store in Supabase Edge Function secrets:
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
#   MERCADOPAGO_ACCESS_TOKEN
#   MERCADOPAGO_WEBHOOK_SECRET
#   APP_ORIGIN
#   MERCADOPAGO_SANDBOX_PAYER_EMAIL
```

- [x] **Do NOT include `VITE_WORKSHOP_ID`** — it was removed as obsolete in SDD-1.
- [x] **Do NOT include any real secret values** — placeholders only.

**Expected file:** `.env.example`
**Acceptance:** `grep -i 'service_role\|mercadopago_access\|webhook_secret\|VITE_WORKSHOP_ID' .env.example` returns no non-comment matches. `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present as placeholder assignments.

### Task 1.2 — Rewrite `README.md`

- [x] **Replace the Vite boilerplate README** with project-specific content following the cognitive-doc-design skill structure:

  1. **Title + one-paragraph summary** — what CarpinteroPro is (carpentry workshop management), who it serves (woodworking shops), why it matters.
  2. **Quick path** — 3-step start: clone, install, copy `.env.example` → `.env.local` → fill values → `npm run dev`.
  3. **Stack summary table** — React 19, Vite 8, TypeScript, Tailwind CSS, Supabase, MercadoPago, Vitest.
  4. **Prerequisites** — Node.js ≥20, npm, Supabase project.
  5. **Scripts table** — `dev`, `build`, `lint`, `test`, `test:watch`, `preview`.
  6. **Deployment overview** — Vercel (frontend auto-deploy from `main`), Supabase (migrations/Edge Functions).
  7. **Operations docs links** — relative links to:
     - `docs/operations/environment-setup.md`
     - `docs/operations/supabase-production-checklist.md`
  8. **Out of scope note** — monitoring/observability deferred to SDD 6.

- [x] **Do not duplicate** detailed operational procedures in the README; link to `docs/operations/` instead.
- [x] **Verify all relative links** point to files that exist or will exist in slice 2 (forward-links to environment-setup and supabase-production-checklist are expected to resolve after slice 2).

**Expected file:** `README.md`
**Acceptance:** README contains no Vite boilerplate text. Contains "CarpinteroPro" or "carpintería". Contains `docs/operations/environment-setup.md` and `docs/operations/supabase-production-checklist.md` as relative links.

### Task 1.3 — Clean up stale `VITE_WORKSHOP_ID` references in `CLAUDE.md`

- [x] **Remove or update** `CLAUDE.md` line 69: change "The current placeholder is `VITE_WORKSHOP_ID=00000000-0000-0000-0000-000000000001`." to note that workshop identity is now server-derived via `auth.uid() → profiles.workshop_id`.
- [x] **Remove** `VITE_WORKSHOP_ID=` from the Environment section (line 77 area).
- [x] **Update the environment section** to show only `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`.

**Expected file:** `CLAUDE.md`
**Acceptance:** `grep 'VITE_WORKSHOP_ID' CLAUDE.md` returns no matches.

### Task 1.4 — Slice 1 verification

- [x] **Secret audit:** Run `git diff -- .env.example README.md CLAUDE.md` and confirm no real secrets, tokens, or API keys are present.
- [x] **Cross-link check:** Verify all relative links in README point to existing or planned files.
- [x] **Lint check (optional):** Run `npm run lint` if the project lints markdown.
- [x] **Build check:** Run `npm run build` to confirm no excluded files break the build.
- [ ] **Commit:** Not run per delegated apply constraint; suggested commit remains: `docs(ops): rewrite README and .env.example for contributor onboarding`

**Exit criteria:** New contributor can read README, set up env, and find operations docs. No stale `VITE_WORKSHOP_ID` references remain.

---

## Slice 2 — Environment & Supabase Production Readiness (P1)

**PR target:** ~250 changed lines. Low risk.

### TDD Stance

Structural/documentation exception. Two new markdown files only. Verification is manual audit + link validation.

### Task 2.1 — Create `docs/operations/environment-setup.md`

- [x] **Write environment setup guide** covering:

  1. **Overview** — local, preview/staging, and production environment contexts.
  2. **Public frontend variables** — how to obtain Supabase URL and anon key from the Supabase dashboard.
  3. **MercadoPago sandbox setup** — sandbox vs production mode, sandbox credentials, sandbox payer email.
  4. **Server-only secrets inventory table:**

     | Variable | Storage | Purpose |
     |----------|---------|---------|
     | `SUPABASE_URL` | Supabase Edge Function secret | Server-side Supabase client |
     | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secret only | Privileged operations |
     | `MERCADOPAGO_ACCESS_TOKEN` | Supabase Edge Function secret | MercadoPago API |
     | `MERCADOPAGO_WEBHOOK_SECRET` | Supabase Edge Function secret | Webhook validation |
     | `APP_ORIGIN` | Supabase Edge Function secret | CORS/redirect origin |
     | `MERCADOPAGO_SANDBOX_PAYER_EMAIL` | Supabase Edge Function secret | Sandbox test payer |

  5. **Vercel environment variables** — only `VITE_*` variables go in Vercel frontend env.
  6. **`VITE_WORKSHOP_ID` status note** — document that this variable was removed as obsolete in SDD-1; workshop identity is now server-derived.
  7. **Troubleshooting** — common setup failures (wrong Supabase URL, missing anon key, CORS errors, MercadoPago sandbox config).

- [x] **All examples use placeholders** — `<your-supabase-project-url>`, `<anon-key>`, `<set-in-supabase-secrets>`.
- [x] **No real secret values** in the document.

**Expected file:** `docs/operations/environment-setup.md`
**Acceptance:** Document covers local, preview, and production contexts. Server-only secrets table is present with all six variables. `VITE_WORKSHOP_ID` is documented as obsolete. No real secrets.

### Task 2.2 — Create `docs/operations/supabase-production-checklist.md`

- [x] **Write Supabase production checklist** as an operator checklist covering:

  1. **Auth redirect URLs** — verify site URL and redirect allow-list match production domain.
  2. **Edge Function secrets** — verify all six server-only variables are set in Supabase dashboard.
  3. **RLS sanity checks** — verify RLS is enabled on all tables with `workshop_id`.
  4. **Migration status** — verify latest migration is applied; link to `docs/operations/supabase-migration-reconciliation.md` for ledger status.
  5. **Backup verification** — confirm automated backups are enabled, PITR status if applicable.
  6. **Post-schema-change validation** — checklist after new migrations.
  7. **Out of scope / SDD 6 handoff** — monitoring, alerting, and support workflows are deferred.

- [x] **Use checklist format** (checkbox items) for operator workflows per cognitive-doc-design skill.
- [x] **Link to `docs/operations/supabase-migration-reconciliation.md`** — this file already exists.

**Expected file:** `docs/operations/supabase-production-checklist.md`
**Acceptance:** Checklist covers auth URLs, Edge Function secrets, RLS, migrations, and backups. Contains relative link to `supabase-migration-reconciliation.md`. Checklist format used throughout.

### Task 2.3 — Slice 2 verification

- [x] **Secret audit:** `git diff -- docs/operations/environment-setup.md docs/operations/supabase-production-checklist.md` — confirm no real secrets.
- [x] **Link validation:** Verify `supabase-migration-reconciliation.md` link resolves to the existing file.
- [x] **Command audit:** Any CLI commands in the docs are non-destructive by default; dangerous commands marked with approval warnings.
- [ ] **Commit:** Not run per delegated apply constraint; suggested commit remains: `docs(ops): add environment setup guide and Supabase production checklist`

**Exit criteria:** Maintainer can configure any environment and complete Supabase production readiness checklist. All links valid.

---

## Slice 3 — Migration Deployment & Rollback (P2)

**PR target:** ~200 changed lines. Low risk.

### TDD Stance

Structural/documentation exception. Two new markdown files only. Verification is manual audit + link validation.

### Task 3.1 — Create `docs/operations/migration-deployment.md`

- [x] **Write migration deployment guide** covering:

  1. **Pre-deployment checks** — local `npm test` pass, backup confirmation, migration file review.
  2. **Safe CLI workflow** — approved Supabase CLI commands. **Explicitly warn against `supabase db push --linked`** until migration reconciliation is complete (link to `supabase-migration-reconciliation.md`).
  3. **Post-deploy verification** — confirm migration applied, RLS policies exist for new tables, app smoke test.
  4. **Troubleshooting** — common migration failures and recovery steps. Link to `docs/operations/rollback-runbook.md`.
  5. **Out of scope** — incident communications and Vercel rollback (linked from rollback runbook).

- [x] **Mark dangerous commands** (e.g., `db push`, `migration repair`) with approval-required warnings.
- [x] **Use tables** for CLI command inventory per cognitive-doc-design skill.

**Expected file:** `docs/operations/migration-deployment.md`
**Acceptance:** Document warns against `db push --linked`. Links to `supabase-migration-reconciliation.md` and `rollback-runbook.md`. Pre-deployment and post-deployment checklists present.

### Task 3.2 — Create `docs/operations/rollback-runbook.md`

- [x] **Write rollback runbook** covering:

  1. **Incident classification** — frontend-only, Edge Function-only, migration/database, or mixed.
  2. **Vercel frontend rollback** — use Vercel dashboard to revert to previous deployment. Steps to verify the reverted deployment is serving correctly.
  3. **Supabase migration recovery** — decision tree: PITR vs backup restore vs forward-fix migration. When to escalate rather than attempt direct database manipulation.
  4. **Edge Function redeployment** — redeploy previous function version from Supabase dashboard or CLI.
  5. **Communication steps** — what to record: incident time, impact, action taken, current status, verification.
  6. **Out of scope / SDD 6 handoff** — monitoring and alerting for proactive incident detection.

- [x] **Use decision tree format** for database recovery scenarios.
- [x] **Mark destructive operations** (direct database manipulation) as escalation-required.

**Expected file:** `docs/operations/rollback-runbook.md`
**Acceptance:** Covers all four incident types. Decision tree present for database recovery. Communication template or checklist present.

### Task 3.3 — Slice 3 verification

- [x] **Secret audit:** `git diff -- docs/operations/migration-deployment.md docs/operations/rollback-runbook.md` — confirm no real secrets.
- [x] **Link validation:** Verify links to `supabase-migration-reconciliation.md` and between migration-deployment ↔ rollback-runbook resolve correctly.
- [x] **Command audit:** Dangerous Supabase CLI commands are marked approval-required.
- [ ] **Commit:** Not run per delegated apply constraint; suggested commit remains: `docs(ops): add migration deployment guide and rollback runbook`

**Exit criteria:** Maintainer can deploy migrations safely and recover from any incident type. All cross-links valid.

---

## Slice 4 — Vercel Config Decision Record (P2)

**PR target:** ~50–80 changed lines. Medium risk if `vercel.json` is implemented; Low if decision-record only.

### TDD Stance

- **Decision record only (default):** Structural/documentation exception. One markdown file.
- **If `vercel.json` is approved:** Full verification required — `npm test`, `npm run lint`, `npm run build`, plus preview deployment smoke test.

### Task 4.1 — Create `docs/operations/vercel-config-decision.md`

- [x] **Write decision record** with the following structure:

  1. **Decision: Deferred** — default status per design.
  2. **Context** — Vercel auto-deploys from `main`. No `vercel.json` exists. SPA routing currently works (Vite build + Vercel default behavior).
  3. **Options evaluated:**
     - **Defer** (accepted): No additional config needed. Risk: no explicit security headers.
     - **Implement `vercel.json`**: SPA rewrite + conservative security headers. Risk: may break Supabase Auth redirects, MercadoPago flows, PWA assets, or Vite chunks.
  4. **Compatibility checklist** — items that must pass before implementation:
     - Supabase Auth callback/redirect URL still works
     - MercadoPago checkout return/callback paths work
     - PWA manifest and service worker load
     - Generated JS/CSS Vite chunks load without 404
     - Deep links to nested app routes resolve to SPA
  5. **Trigger criteria for implementation** — at least one must be true:
     - Deep links break in preview/production
     - Security review/compliance mandates headers before launch
     - Team accepts verification burden
  6. **Risk accepted by deferring** — no explicit CSP or security headers in production.

- [x] **Status must be `Deferred`** unless user has explicitly approved implementation.
- [x] **Do NOT add `vercel.json` or `.vercelignore`** in this task unless explicitly approved.

**Expected file:** `docs/operations/vercel-config-decision.md`
**Acceptance:** Decision is recorded as `Deferred`. Compatibility checklist is present. Trigger criteria are explicit. No `vercel.json` or `.vercelignore` created.

### Task 4.2 — Slice 4 verification

- [x] **Secret audit:** `git diff -- docs/operations/vercel-config-decision.md` — confirm no secrets.
- [x] **Decision audit:** Confirm the record does not instruct implementation by default.
- [x] **Link validation:** Any links to README or other ops docs resolve correctly.
- [ ] **Commit:** Not run per delegated apply constraint; suggested commit remains: `docs(ops): add Vercel config decision record (deferred)`

**Exit criteria:** Decision record is explicit about deferral, risk accepted, and trigger criteria. No deployment config files added.

### Gate: If `vercel.json` Implementation Is Requested

If the user explicitly approves adding `vercel.json`:

- [ ] **Add `vercel.json`** with conservative config:
  - SPA rewrite: all routes → `/index.html`, excluding static assets (`_next/`, `assets/`, `manifest`, `sw.js`, file extensions).
  - No security headers by default; add only if compatibility is verified.
- [ ] **Update decision record status** from `Deferred` to `Implemented` with date and approval reference.
- [ ] **Run full verification:**
  ```bash
  npm test
  npm run lint
  npm run build
  ```
- [ ] **Preview deployment smoke test** (manual or scripted):
  - [ ] `/` loads
  - [ ] `/dashboard` deep link loads
  - [ ] JS/CSS chunks load (check browser console for 404)
  - [ ] PWA manifest accessible at `/manifest.webmanifest`
  - [ ] Supabase Auth callback path works
- [ ] **Commit:** Not run per delegated apply constraint; suggested commit remains: `feat(ops): add vercel.json for SPA routing with decision record update`

---

## Post-Slice Cross-Link Verification (After All Slices Merged)

- [x] **README** links resolve to:
  - [x] `docs/operations/environment-setup.md` ✓
  - [x] `docs/operations/supabase-production-checklist.md` ✓
- [x] **Supabase production checklist** links to:
  - [x] `docs/operations/supabase-migration-reconciliation.md` ✓
- [x] **Migration deployment** links to:
  - [x] `docs/operations/rollback-runbook.md` ✓
  - [x] `docs/operations/supabase-migration-reconciliation.md` ✓
- [x] **Vercel config decision** — self-contained, no broken outgoing links.

## Full Changed-File Inventory

| Slice | Files | Type | Lines (est) |
|-------|-------|------|-------------|
| 1 | `.env.example` | config (comments only) | ~15 |
| 1 | `README.md` | docs (rewrite) | ~80 |
| 1 | `CLAUDE.md` | docs (cleanup) | ~5 |
| 2 | `docs/operations/environment-setup.md` | docs (new) | ~130 |
| 2 | `docs/operations/supabase-production-checklist.md` | docs (new) | ~100 |
| 3 | `docs/operations/migration-deployment.md` | docs (new) | ~100 |
| 3 | `docs/operations/rollback-runbook.md` | docs (new) | ~90 |
| 4 | `docs/operations/vercel-config-decision.md` | docs (new) | ~50 |
| 4 | `vercel.json` (conditional) | config | ~20 |
| **Total** | **8–9 files** | | **~590 (+20 if vercel.json)** |

## Dependency Graph

```
Slice 1 (P1) ──► Slice 2 (P1) ──► Slice 3 (P2) ──► Slice 4 (P2)
   │                                                  │
   │                                                  └── Gate: needs explicit
   │                                                       approval for vercel.json
   └── CLAUDE.md cleanup is part of slice 1
```

Slices 1 and 2 are P1. Slice 2 can start as soon as slice 1 is merged (or in parallel if cross-links are tracked). Slices 3 and 4 are P2 and should follow after P1 is merged. Slice 4 has an explicit gate before any `vercel.json` implementation.

## SDD 6 Handoff Items (Do Not Implement)

These items are explicitly out of scope and should be noted for SDD 6:

- Monitoring dashboards / uptime checks
- Alert routing / notification channels
- Logging pipeline / structured logging
- Performance budgets / Lighthouse CI
- Support workflow documentation
- Health check endpoints
