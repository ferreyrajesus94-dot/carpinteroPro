# release-pipeline Specification

## Purpose

CarpinteroPro ships through a reproducible release pipeline that survives maintainer rotation and is auditable after the fact. Each release is a single identifiable event: a tag pointing at a release commit, a GitHub Release with structured notes, a Vercel production deployment, and matching version triples in `package.json`, `package-lock.json`, and `CHANGELOG.md`. This pipeline is what makes the project trustworthy for forkers and contributors who joined after v0.2.0-beta.1.

## Requirements

### Requirement: Conventional Commit format with work-unit preservation

Each commit on `main` MUST follow Conventional Commits. Releases MUST preserve each work-unit as its own commit — squash merges are not allowed for releases.

#### Scenario: Release preserves work-unit commits

- GIVEN a release PR with N logically-distinct work units
- WHEN the PR is merged
- THEN `git log` on `main` shows N+1 distinct commits (N work-units + 1 release commit)
- AND the squashed-diff count is `0` (no squash merge used)

#### Scenario: Commit message format

- GIVEN a commit on any branch targeting `main`
- WHEN the commit is being merged
- THEN the message matches `^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([a-z0-9\._-]+\))?!?: .+`
- AND it does not include a `Co-Authored-By:` trailer

### Requirement: Versioning follows `v0.x.y-beta.z`

Releases use the format `v<MAJOR>.<MINOR>.<PATCH>-beta.<N>` while the project is in pre-1.0 testing. Each increment of `<N>` is for additional release candidates at the same planned base; if impact changes the planned base, restart at `.1`.

#### Scenario: Version increment rule

- GIVEN a release at `v0.4.0-beta.2`
- WHEN another release candidate is needed at the same planned base
- THEN the next version is `v0.4.0-beta.3` (counter only)

#### Scenario: Base version change

- GIVEN an impact change (e.g., `compatible feature` to `breaking change` in pre-1.0)
- WHEN the next release is cut
- THEN the next base is computed from the impact matrix; the channel resets to `.1`; the suffix is dropped only at explicit `1.0.0` stable promotion

#### Scenario: No auto-promotion to stable

- GIVEN the project at `v0.x.y-beta.z`
- WHEN time passes without explicit release-stage authorization
- THEN no commit, hook, or pipeline auto-bumps to `1.0.0` or removes the `beta` suffix

### Requirement: Authored tag points at the release commit

Each release MUST be cut as an annotated tag whose target is the `chore(release): v<version>` commit.

#### Scenario: Tag is annotated, not lightweight

- GIVEN `git tag -n v0.2.0-beta.1`
- WHEN the tag is fetched
- THEN it is annotated (`git cat-file -t v0.2.0-beta.1` returns `tag`, not `commit`)

#### Scenario: Tag target is the release commit

- GIVEN the annotated tag `v0.2.0-beta.1` at SHA `f6258b1`
- WHEN `git show v0.2.0-beta.1 --no-patch` is run
- THEN the commit it points at is `chore(release): v0.2.0-beta.1` (commit `ea0aef3`)

### Requirement: Synchronized version sources

At release time, `package.json`, `package-lock.json`, and `CHANGELOG.md` MUST all reference the same version.

#### Scenario: Version synchronized at `v0.2.0-beta.1`

- GIVEN the repository immediately after the `v0.2.0-beta.1` tag is pushed
- WHEN `grep '"version"' package.json package-lock.json CHANGELOG.md` is run
- THEN the version reads `0.2.0-beta.1` consistently across all three files

#### Scenario: CHANGELOG entry moves from `[Unreleased]` to versioned section

- GIVEN a `CHANGELOG.md` with `[Unreleased]` accumulating changes
- WHEN a release is cut
- THEN a fresh empty `[Unreleased]` section is introduced at the top
- AND the previous `[Unreleased]` content is moved into a new `## [<version>] — <YYYY-MM-DD>` section
- AND the new section follows Keep a Changelog format (`### Added`, `### Changed`, `### Fixed`, `### Security`, etc.)

### Requirement: GitHub Release publishes with structured notes

After the merge, a GitHub Release MUST be published using `gh release create` against the new tag.

#### Scenario: Release exists with title and notes

- GIVEN a successful merge to `main`
- WHEN `gh release view <tag>` is run
- THEN the release exists with a structured title (not just the raw tag) and body containing at least: the user-visible summary, the include-the-changelog link, and a "Migration" or "Upgrade" subsection when applicable

### Requirement: Repo topics aid discoverability

The repo MUST carry topics that reflect the actual stack and domain so a casual searcher can find it.

#### Scenario: Stack/domain topics present

- GIVEN the repo at v0.2.0-beta.1
- WHEN `gh api /repos/{owner}/{repo}/topics` is run
- THEN `names` includes at minimum a stack set (`react`, `typescript`, `vite`, `supabase`, `tailwindcss`) and a domain set (`carpentry`, `workshop-management`)

### Requirement: Tag-triggered Vercel deploy workflow

A `.github/workflows/release.yml` MUST deploy the application to Vercel production when a tag matching `vX.Y.Z*` is pushed.

#### Scenario: Tag push triggers production deploy

- GIVEN a tag push to `origin` matching `v[0-9]+.[0-9]+.[0-9]+*`
- WHEN the workflow runs
- THEN it installs Vercel CLI, runs `vercel pull`, then `vercel deploy --prod --yes`, and reports `✅ Deployed v<tag>` on success

#### Scenario: Workflow self-skips on contributor forks

- GIVEN a fork of the repo where `secrets.VERCEL_TOKEN` is unset
- WHEN a tag is pushed by a contributor
- THEN the workflow's `if: ${{ secrets.VERCEL_TOKEN != '' }}` guard skips the deploy job silently (no CI failure)

#### Scenario: Three required Vercel secrets present in origin

- GIVEN the canonical repo on GitHub
- WHEN `gh secret list` is run against the origin
- THEN `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are all present and non-empty

### Requirement: PAT scope limitation acknowledged

The dedicated PAT used to push workflow files MUST carry the `workflow` scope. OAuth tokens that lack `workflow` MUST NOT block releases — the PAT is created ad-hoc with `repo` + `workflow` scopes and a short expiration.

#### Scenario: Workflow file push rejection

- GIVEN only an OAuth token without `workflow` scope
- WHEN `git push` adds `.github/workflows/release.yml`
- THEN the remote rejects with `refusing to allow an OAuth App to create or update workflow ... without workflow scope`

#### Scenario: Recovery via dedicated PAT

- GIVEN the rejection above
- WHEN the user creates a new PAT with `repo` + `workflow` scopes and uses it inline in the push URL (`https://x-access-token:<PAT>@github.com/...`)
- THEN the push succeeds and the workflow file lands on the branch

## Notes

- The PAT pushed via the alternative auth method MUST be revoked after the workflow-related push is complete (it's ad-hoc and short-lived).
- Future versions may extend the workflow (e.g., Slack notification, automatic GitHub Release from `release.yml`, coverage gate) — those are scoped future changes via separate SDD PRs, not amendments to this spec.
- Releases do NOT auto-cleanup old tags. Tag management is a maintainer responsibility, not automated (avoids accidental branch protection bypass).
- This spec documents the pipeline contract for the `v0.2.x-beta.x` series. When the project promotes to stable `1.0.0`, a follow-up SDD change SHOULD amend this spec to drop the `beta` suffix rules and document the stable-branch-protection policy.
