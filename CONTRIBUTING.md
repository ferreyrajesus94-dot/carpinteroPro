# Contributing to CarpinteroPro

## Workflow (effective 2026-09-05)

**Branch from `main`. Open a PR. Wait for review. Merge.**

```bash
git checkout main
git pull origin main
git checkout -b feat/short-description    # or fix/, refactor/, chore/
# ... work, conventional commits ...
git push origin feat/short-description
gh pr create --base main --head feat/short-description --fill
```

**Never commit directly to `main`.** Every change — no matter how small — goes through a PR. The exception is release commits (version bumps, CHANGELOG updates), which always land on `main` via a `chore(release):` PR that closes itself when merged.

## Why

- **Code review at PR time, not at debug time.** Direct commits to `main` made the audit hard to review in chunks.
- **Bisectability.** PRs split the work into reviewable units. `git bisect` is meaningful when each commit is a reviewable diff, not when 13 commits land in one session.
- **CI runs on PR, not on push to main.** Without PRs there is no place where checks can fail and a human reviews.

## Branch names

Use the prefix that matches the change:

- `feat/` — new feature, new component, new screen (e.g. `feat/brandmark-component`)
- `fix/` — bug fix (e.g. `fix/vite-supabase-redaction`)
- `refactor/` — extract / restructure without behavior change (e.g. `refactor/eyebrow-component`)
- `perf/` — performance (e.g. `perf/memo-production-board`)
- `test/` — tests only (e.g. `test/smoke-button`)
- `chore/` — tooling, deps, releases (e.g. `chore/bump-v0.3.2`, `chore/release-0.3.2-beta.1`)
- `docs/` — CHANGELOG, README, CONTRIBUTING, this file

## Commit messages — Conventional Commits

Format: `<type>(<scope>): <subject>` in imperative mood, lowercase, no period.

```
feat(brandmark): extract shared component with size/shape variants
fix(supabase): rename VITE_SUPABASE_* to VITE_DB_*
refactor(ui): migrate shared/ui to OKLCH redesign tokens
test(shared-ui): add smoke tests for 12 components
chore(release): 0.3.1-beta.2
```

**No `Co-Authored-By:` footers.** No AI attribution. No emoji. Conventional commits only.

## PR description

Include:
1. **What** changed (1–3 sentences)
2. **Why** (link to issue, audit finding, or business need)
3. **How** to verify (commands to run, screenshots if visual)

Templates are auto-populated by `gh pr create --fill` for simple cases. For the audit-style multi-fix PRs, the body should be the relevant CHANGELOG draft.

## Local checks before pushing

```bash
npm run lint      # 0 errors expected
npm test         # 999 tests expected (post W5 baseline)
npm run build    # tsc + vite build, no errors
```

## Run locally

Prerequisites: Node ≥ 20.0.0 (the repo pins Node 24 in CI; `.nvmrc` ships with `24`), npm 10+, and Docker if you want to run the Supabase local stack and the pgTAP / Playwright suites.

```bash
nvm use         # or ensure Node >=20.0.0
npm ci
npm run lint
npm run test:coverage
npm run build
# Optional: disposable DB + pgTAP + e2e
supabase start
supabase db reset
supabase test db --local
npm run test:e2e -- tests/e2e/browser/free-journey.spec.ts
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values you need. The runtime contract is **`VITE_DB_URL` / `VITE_DB_ANON_KEY`** — that is what `src/shared/lib/supabase.ts` reads. The legacy `VITE_SUPABASE_*` names are not consumed by the app; Vite would silently substitute them with `[SENSITIVE]` and the runtime would fail.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_DB_URL` | yes | Supabase project URL. |
| `VITE_DB_ANON_KEY` | yes | Supabase anon key (browser-safe). |
| `VITE_USE_LOCAL_MOCKS` | no | Set to `true` to preview the UI without a Supabase stack. See [Demo data](#demo-data). |
| `VITE_SENTRY_DSN` | no | If set, `@sentry/react` is loaded dynamically and reports are sent to that project. |
| `VITE_SUPPORT_EMAIL` | no | Operator support inbox displayed in the legal pages and the error boundary. |

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, MercadoPago tokens, etc.) belong in Supabase Edge Function secrets, never in `.env.local`. See `docs/operations/environment-setup.md`.

## Demo data

`src/shared/lib/mockData.ts` seeds a single demo workshop for local visual inspection behind the gate
`import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_MOCKS === "true"`. The post-W2 mock has the following shape:

- One workshop (`Carpintería El Ñandú`) with `is_active: true` and a stable `MOCK_WORKSHOP_ID`.
- One user (`taller@demo.carpintero.pro`, name `Martín Gómez`) whose `is_platform_admin` flag is `false` so the demo session cannot reach `/admin/*`.
- The `subscriptions` key in `MOCK_DATA_MAP` is an empty object — the W2 free-launch removed `MOCK_SUBSCRIPTION` so a `null` subscription is the only state a mock client can observe. The `subscriptions` table itself is preserved for historical rows and continues to be readable by platform-admin tooling.
- Four demo clients (Spanish placeholder names), six materials (generic catalogue names), three furniture templates, six quotes, and a small `quote_extras` table.

No real customer data, addresses, or prices are bundled. Phone numbers use the standard `+54 11 5555-XXXX` placeholder range; the support email is `taller@demo.carpintero.pro` (non-routable). The full safety check is recorded at
[`docs/operations/production-readiness-audit-2026-09-13.md`](docs/operations/production-readiness-audit-2026-09-13.md) under the W6 phase-2 completion record.

`Vite`'s tree-shaking guarantees the dynamic-import gate above strips the mock module from production builds. Verify locally with `grep -rl 'taller@demo\|MOCK_WORKSHOP_ID' dist/assets/` after `npm run build`; only the runtime module graph should be reachable, and only inside a `--mode development` build that has `VITE_USE_LOCAL_MOCKS=true` exported at build time.

## Review

Every change — no matter how small — is reviewed before merge. PRs are gated by the CI workflow (`.github/workflows/ci.yml`) which runs Vitest, ESLint, the coverage threshold, `vite build`, and `npm audit` split into production / dev sweeps. Vercel auto-deploys only on tag pushes whose `workflow_run` conclusion is `success` for the same commit SHA, so the released revision always matches the revision CI tested.

The free-launch verification surface — build / lint / coverage / Playwright list / pgTAP count / demo-data safety / env-name rename — is consolidated in the audit completion record at
[`docs/operations/production-readiness-audit-2026-09-13.md`](docs/operations/production-readiness-audit-2026-09-13.md). Reviewers and contributors alike should treat the "Remaining remote checks or missing inputs" table in that document as the authoritative backlog for hosted-only work (signup email delivery, staging backup restore, support inbox wiring, hosted Supabase ledger diff, browser preview CSP smoke check).

## Code review checklist

- Functional impact (does it do what the PR says?)
- Tests cover the change (added test files? existing tests still pass?)
- Feature-slicing boundaries respected (no cross-feature imports, feature has its own components/hooks/api)
- ESLint warnings: zero new ones
- No untracked dependencies in `package.json`
- No `.env` changes (commit only `.env.example`, never `.env` or `.env.local`)
- Commit history is clean (no `wip` / `fix typo` commits rebased into the PR)

## Out of scope

- Don't ship PRs that depend on unmerged other PRs. Land dependencies first, branch from the merged tip.
- Don't ship PRs that need a remote-only env var the reviewer can't set. Document the required env vars in the PR description.
- Don't ship screenshots in the PR if the change is data-fetching-only — verify visually first against a dev seed.

## Background

Before this policy, every UI audit cycle was a series of direct commits to `main`. The v0.3.1-beta.2 release consolidated 13 such commits. The audit was effective at changing code, but the lack of PRs meant:

- No bisect-friendly units
- No formal review gates
- No automatic CI per PR
- A single session's worth of changes felt all-or-nothing

This document is the durable artifact of that lesson.
