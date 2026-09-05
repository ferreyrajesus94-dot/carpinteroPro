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
npm test         # 967 tests expected (post v0.3.1-beta.2 baseline)
npm run build    # tsc + vite build, no errors
```

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
