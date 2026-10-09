---
name: carpinteropro-release
description: "Trigger: CarpinteroPro release, tag, CI, production deploy, release migrations. Deliver this project's verified release workflow."
license: MIT
metadata:
  author: ferreyrajesus94-dot
  version: "1.0"
---

## Activation Contract

Use for authorized CarpinteroPro releases and checking whether a merged change reached production. Re-read the current repository configuration before relying on this workflow.

## Hard Rules

- Keep unrelated working-tree changes out of the release. Tag an exact reviewed remote commit; never retag or force-push an existing version.
- Preserve existing authorization; creating a tag that triggers production requires release authorization. Database application is a separate action and must be in scope.
- Do not bypass CI or the release gate with a direct CLI deploy.
- Never print credentials. Distinguish preview success, production success and database migration status.

## Decision Gates

| Evidence | Action |
| --- | --- |
| Current configuration retains the tag route | Publish an unused semver tag and follow its CI run |
| Configuration or release plan differs | Inspect the actual route before deploying |
| Pending migrations are in scope | Review and apply the exact remote plan; verify it |
| CI or deployment fails | Diagnose the failed step; do not claim release success or retry blindly |

## Execution Steps

1. Verify repository, remote `main`, working-tree status, merged PRs, latest remote tags, package version and release notes. Select the next appropriate version without overwriting an existing tag.
2. Read `vercel.json`, `.github/workflows/ci.yml`, `.github/workflows/release.yml` and `scripts/release/verify-release.mjs`. Currently `main` auto-deploy is disabled; tag pushes matching `v*` run CI, then the gated production workflow.
3. Create and push an annotated tag on the reviewed commit. Observe that tag's run through tests, coverage, lint, build and production deployment. Confirm the deployed SHA and production alias from its output.
4. Check database parity separately using the Supabase skill: verify the production project, migration list, dry run, SQL and affected data. Apply only within authorization, then verify history, objects and behavior.
5. Report tag, SHA, CI result, production URL and database status. If migrations are deferred, explain the remaining user-visible effect.

## Output Contract

Return confirmed release evidence and remaining work. Never infer a production release from a merge or preview alone.

## References

The workflow, release gate and migration files in this repository are authoritative; paths above are relative to its root.
