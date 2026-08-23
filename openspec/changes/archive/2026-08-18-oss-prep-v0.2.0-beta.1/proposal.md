# Proposal: v0.2.0-beta.1 OSS Preparation (2026-08-18)

## Intent

Retrospective documentation of the pre-open-source-release work for CarpinteroPro `v0.2.0-beta.1`. Establishes the canonical capability specs for two net-new capabilities introduced by this release and records the work units for traceability. All work shipped via PR #119 (merged `6ea75ac`) and was tagged as `v0.2.0-beta.1` pointing to release commit `ea0aef3`.

The purpose of this SDD change is **documentation**, not implementation: every code-level and database-level change is already merged on `main` and described in `CHANGELOG.md`, the GitHub Release notes, and the git history of the 8 work-unit commits. This change captures the capability contract so future contributors and the proposal-to-specs traceability remain intact.

## Scope

### In Scope

- `oss-licensing` — AGPL-3.0 LICENSE at repo root with copyright header, README License section, and the SaaS-copyleft rationale preserved in plain language.
- `release-pipeline` — Conventional Commit work-units preserved via merge commit (not squash), semantic-versioned pre-release format `0.x.y-beta.z`, annotated git tags, GitHub Release published automatically, 9 repo topics for discoverability, AGPL-3.0 badge in README, tag-triggered Vercel production deployment via GitHub Actions workflow.
- Companion security hardening recorded as point-fix updates: `tests/e2e/envCheck.ts` throws on missing E2E_ADMIN env vars instead of falling back to hardcoded demo values; `.gitignore` covers `.env` + `.env.*`; `supabase/functions/create-subscription/index.ts:24` no longer logs the user `email` (PII) at info level; `src/features/legal/pages/TermsPage.tsx` + `PrivacyPage.tsx` use the existing `getSupportEmail` / `getSupportMailtoHref` helpers driven by `VITE_SUPPORT_EMAIL`.
- Companion database-level cleanup (out-of-band, not part of the PR): demo workshop password rotated in Supabase; personal account + workshop + profile deleted (FK-correct 4-step order); 5 orphan workshops deleted; the active `pro_monthly` MercadoPago subscription cancelled (`status='cancelled'`, `cancel_at_period_end=true`).

### Out of Scope

- Feature changes shipped under `v0.1.0-beta.1` and earlier — already archived under their own SDD changes (see `openspec/changes/archive/2026-05-24-*` through `2026-08-12-*`).
- The localStorage polyfill in `tests/setup.ts` that resolved the 27 pre-existing test failures (Node 22+ jsdom behavior change) — shipped separately via PR #121 as its own chore.
- Future versions (`v0.2.0-beta.2+`, `v0.3.x`).
- Marketplace switch from pro to free at the product level (the underlying billing infrastructure remains; only the demo workshop's active subscription was cancelled for this release).

## Capabilities

### New Capabilities

- `oss-licensing`: CarpinteroPro is open-source software under AGPL-3.0 (network copyleft). The LICENSE file at the repo root is the verbatim GNU canonical text, with a copyright header naming the maintainer. The README carries an AGPL-3.0 badge and a License section linking to `LICENSE` with a 2-sentence plain-language summary of the SaaS-copyleft obligation. SaaS copyleft was chosen over MIT so any modified deployment served over the network must publish its source modifications.

- `release-pipeline`: Releases follow a Conventional Commit discipline with work-unit commits preserved (no squash). Each release ships as a pre-release tag in the form `v0.x.y-beta.z`, anchored at a `chore(release): v<version>` commit that synchronizes `package.json` ↔ `package-lock.json` ↔ `CHANGELOG.md`. After merge to `main`, an annotated tag is pushed, a GitHub Release is published using `gh release create` (which auto-detects the tag), and a Vercel production deployment is triggered automatically by the `release.yml` GitHub Actions workflow when a tag matching `v[0-9]+.[0-9]+.[0-9]+*` is pushed (workflow self-skips when `secrets.VERCEL_TOKEN` is empty so contributor forks don't fail their CI). Repo topics are set via `gh repo edit --add-topic` for discoverability.

### Modified Capabilities

None at the spec/spec level. The remaining code-level changes in PR #119 are point-fix updates to existing patterns that don't change any capability REQUIREMENT:

- `secrets-management` (informational only, no spec change): the envCheck helper now enforces env presence, `.gitignore` covers `.env*`, Edge Function logs no longer include user email. These harden existing patterns; they don't add new user-observable capability.
- `support-contact` (informational only, no spec change): legal pages now use the existing `getSupportMailtoHref` helper driven by `VITE_SUPPORT_EMAIL`. The require­ments were already covered; only the rendering source moved.

The reason these don't generate delta specs: SDD specs capture REQUIREMENTS (what must be true for the user/system), not implementation choices. The internal refactors here are environment/architecture details that don't add or change a user-facing contract.

## Approach

This change is **retrospective** — no work was performed that hasn't already shipped. The PR #119 git history (8 work-unit commits) serves as the implementation log. The database-side cleanup was applied via `supabase db query` directly against the remote Supabase project (no migrations were needed because no schema changed).

The proposed change is "after-the-fact" SDD: the capabilities documented here are net-new contracts that emerged from the release prep but were not formalized at the spec level until now. Future changes touching `oss-licensing` or `release-pipeline` should update the corresponding spec in `openspec/specs/` via the standard SDD flow.

## Affected Areas

| Area | Impact |
|------|--------|
| `LICENSE` | New file — AGPL-3.0 verbatim GNU canonical text |
| `README.md` | Modified — License section, AGPL-3.0 shield badge |
| `.gitignore` | Modified — adds `.env` + `.env.*` (with `!.env.example` exception) |
| `.env.example` | Modified — demo cred placeholders |
| `tests/e2e/envCheck.ts` | Modified — throws on missing env vars |
| `src/features/legal/pages/{Terms,Privacy}Page.tsx` | Modified — `getSupportEmail` + `getSupportMailtoHref` |
| `supabase/functions/create-subscription/index.ts` | Modified — email dropped from console.info |
| `.github/workflows/release.yml` | New — tag-triggered Vercel deploy |
| `CHANGELOG.md`, `package.json`, `package-lock.json` | Synchronized to `0.2.0-beta.1` |
| Supabase remote DB (out-of-band) | Password rotation, 1 user + 5 workshops deleted, 1 subscription cancelled |

## Acceptance Criteria

- [x] `v0.2.0-beta.1` tag pushed to origin (`refs/tags/v0.2.0-beta.1 → f6258b1`)
- [x] GitHub Release published with structured notes (CHANGELOG-extracted)
- [x] README shows AGPL-3.0 badge and License section linking to `LICENSE`
- [x] No `CarpPro#2024` or `admin@carpinteropro.dev` literal in tracked files
- [x] `package.json` and `package-lock.json` synchronized at `0.2.0-beta.1`
- [x] AGPL-3.0 autodetected by GitHub license picker (proves LICENSE is at the canonical path)
- [x] Verified post-cleanup Supabase state: 1 user, 1 profile, 1 workshop, 1 subscription (`status='cancelled'`)

## Risks

| Risk | Mitigation |
|------|------------|
| AGPL-3.0 scares off forkers who prefer MIT | SaaS copyleft rationale documented in CHANGELOG and the License section; MIT-style fork is still legally possible under AGPL |
| `release.yml` deploys to production break staging environments | Workflow triggers only on tag push matching `vX.Y.Z*`, not on regular commits, so staging is unaffected by production deploys |
| Vercel token in GitHub Secrets is a long-lived credential | Scoped to a project-only token, 30-day expiring by default; user can revoke at any time from Vercel dashboard |

## Rollback Plan

Revert PR #119 (single revert). Delete `v0.2.0-beta.1` annotated tag and the GitHub Release. The 3 new specs in `openspec/specs/` (`oss-licensing`, `release-pipeline`, and the `<preserved>/` capability) become orphan files — handle by either reverting them or rolling back the spec sync. The database-side cleanup is out-of-band: a deliberate re-provisioning script would be needed (not part of this SDD change).

## Dependencies

- Supabase CLI v2.113.0 (installed locally, project ref `revbbzqjglqnphjrasvv` linked)
- GitHub CLI authenticated with `repo` scope for the workflow push (workflow scope required for `release.yml` push, handled via dedicated PAT)
- `opencode.json` model assignments for any future SDD phases on the new specs

## PR Slicing Forecast

N/A — this is a documentation-only change. The shipped work in PR #119 is the implementation record; this SDD change adds traceability, not code.

## Notes

The companion `#5` follow-up (resolve the 27 pre-existing test failures via localStorage polyfill in `tests/setup.ts`, PR #121) shipped separately on 2026-08-23 and is also archived as its own chore for clean traceability rather than bundled into this change.
