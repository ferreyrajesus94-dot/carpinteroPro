# Tasks: v0.2.0-beta.1 OSS Preparation (2026-08-18)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Code changed lines | ~1014 / -87 (PR #119) |
| New tracked files | 2 (`LICENSE`, `.github/workflows/release.yml`) |
| Database changes | 1 password rotation + 1 user/workshop/profile/account deletion + 5 workshop deletions + 1 subscription cancellation (applied out-of-band via `supabase db query`) |
| 400-line risk | Medium (PR #119) / Low (this SDD change) |
| Chained PRs | No — PR #119 was a single PR (8 work-unit commits preserved via merge commit, no squash). PR #121 (`tests/setup.ts` localStorage polyfill) shipped separately, 2026-08-23 |
| Chain strategy | N/A |
| 400-line budget risk | Low for this SDD change |

Decision needed before apply: No (retrospective documentation)
Chained PRs recommended: No
Chain strategy: N/A
400-line budget risk: Low

## Scope

Retrospective SDD change for `v0.2.0-beta.1`. All implementation work shipped in PR #119 (merged `6ea75ac` to `main`). This document records the work units retroactively for the canonical capability contracts.

### Work Units (PR #119, 8 commits, all merged)

| # | Commit | Scope | Files touched | Rollback |
|---|--------|-------|---------------|----------|
| 1 | `chore(gitignore): cover .env files to prevent secret leaks` | `.gitignore` | +6 lines | revert gitignore |
| 2 | `chore(legal): add AGPL-3.0 LICENSE` | NEW file `LICENSE` (663 lines) | +663 lines | remove file |
| 3 | `chore(secrets): replace demo credentials with placeholders in .env.example` | `.env.example` | ±4 lines | revert env.example |
| 4 | `chore(tests): require E2E_ADMIN env vars in envCheck helper` | `tests/e2e/envCheck.ts` | +8/-4 | revert envCheck |
| 5 | `refactor(legal): use configurable support email in legal pages` | `TermsPage.tsx` + `PrivacyPage.tsx` | +48/-20 | revert imports + literal |
| 6 | `chore(security): remove user email from create-subscription Edge Function logs` | `create-subscription/index.ts` | ±1 line | revert Edge Function |
| 7 | `docs(readme): remove demo credentials and add License section` | `README.md` | +235/-58 | revert README |
| 8 | `chore(release): v0.2.0-beta.1` | `package.json` + `package-lock.json` + `CHANGELOG.md` | +51/-2 | revert 3 files + delete tag |

### Companion DB work (out-of-band, applied via `supabase db query`)

| # | Step | Verification |
|---|------|--------------|
| 1 | Rotate demo workshop password | `SELECT updated_at::date = CURRENT_DATE` confirmed |
| 2 | Soft-cancel + cascade-delete personal user, workshop, profile, subscription | One FK-correct transaction: `UPDATE subscriptions` → `DELETE profiles` → `DELETE workshops` → `DELETE auth.users` |
| 3 | Delete 5 orphan workshops (verified 0 data across 24 tables) | Verified before delete |
| 4 | Cancel the demo workshop's `pro_monthly` MercadoPago subscription | `status='cancelled'`, `cancel_at_period_end=true` |

### Companion releases / process work

| # | Action | Artifact |
|---|--------|----------|
| 1 | Push annotated tag `v0.2.0-beta.1` to origin | `f6258b1` |
| 2 | Publish GitHub Release via `gh release create v0.2.0-beta.1` | Release ID + URL |
| 3 | Add 9 repo topics via `gh repo edit --add-topic` | `carpentry`, `multi-tenant`, `react`, `supabase`, `tailwindcss`, `tanstack-query`, `typescript`, `vite`, `workshop-management` |
| 4 | Configure 3 GitHub Actions secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | `gh secret list` confirms |
| 5 | Add `.github/workflows/release.yml` (via dedicated PAT with `workflow` scope) | SHA `2aa0c74`, status `active` |

### Companion fix shipped 2026-08-23 (PR #121, its own chore)

| # | Commit | Scope |
|---|--------|-------|
| 1 | `chore(tests): add localStorage polyfill to test setup` | 27 pre-existing test failures (Node 22+ jsdom localStorage) resolved; 122/122 test files pass, 972/972 tests pass |

## Phase 1: This SDD change (documentation only)

- [x] 1.1 **Retrospective proposal** — `proposal.md` documenting Intent, Scope, Capabilities, Approach, Affected Areas, Acceptance Criteria, Risks, Rollback, Dependencies for `v0.2.0-beta.1`; depends: —
- [x] 1.2 **oss-licensing capability** — NEW spec file at `specs/oss-licensing/spec.md` covering: LICENSE file at repo root with verbatim GNU AGPL-3.0 text, copyright header (`Copyright (C) 2026 Jesus Elias Ferreyra`), README badge + License section, plain-language summary of SaaS-copyleft obligation; depends: —
- [x] 1.3 **release-pipeline capability** — NEW spec file at `specs/release-pipeline/spec.md` covering: Conventional Commit discipline with work-unit preservation, `v0.x.y-beta.z` versioning, annotated tags, GitHub Release publication, repo topics for discoverability, tag-triggered Vercel deploy via `release.yml`, `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` secrets; depends: —
- [x] 1.4 **Tasks retrospective** — `tasks.md` capturing the 8 PR #119 commits + the 4 out-of-band DB steps + the 5 release-process actions + the PR #121 follow-up; depends: —
- [x] 1.5 **Sync delta specs to main specs** — mechanical copy of `specs/oss-licensing/spec.md` → `openspec/specs/oss-licensing/spec.md` and same for release-pipeline; depends: 1.2, 1.3
- [x] 1.6 **Archive change** — `git mv openspec/changes/2026-08-18-oss-prep-v0.2.0-beta.1 openspec/changes/archive/2026-08-18-oss-prep-v0.2.0-beta.1`; depends: 1.5
- [x] 1.7 **Verify archive integrity** — `diff -r` between pre-move snapshot and archived folder must be empty; depends: 1.6
- [x] 1.8 **Commit + push + PR + merge** — Conventional Commits, branch `docs/openspec-release-retro-v0.2.0-beta.1`, issue-first per `AGENTS.md` rule, CI must be green, merge with `--merge` (not squash) to preserve the work-unit commits; depends: 1.7

## Acceptance Criteria (re-stated from proposal)

- [x] `v0.2.0-beta.1` tag pushed to origin
- [x] GitHub Release published with structured notes
- [x] README shows AGPL-3.0 badge and License section
- [x] No `CarpPro#2024` or `admin@carpinteropro.dev` literal in tracked files
- [x] `package.json` and `package-lock.json` synchronized at `0.2.0-beta.1`
- [x] AGPL-3.0 autodetected by GitHub license picker
- [x] Post-cleanup Supabase state: 1 user, 1 profile, 1 workshop, 1 subscription (`status='cancelled'`)

## Dependencies

- Existing archived SDD changes for context on format conventions
- `openspec/changes/archive/` directory (already exists; created earlier)
- `openspec/specs/` directory containing capability specs (some related: `cache-pwa-privacy` for the no-PII-log hygiene reference; `production-ops` for env/CI tooling reference)

## PR Slicing Forecast

N/A — single-PR documentation change, same as the work it documents. Cleanly mapped 1:1 to this SDD change.
