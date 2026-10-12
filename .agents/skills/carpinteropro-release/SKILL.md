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
- Never print credentials. Distinguish merge, preview, production deployment and database migration status; evidence for one does not prove another.
- Keep required progress tracking current, but consolidate final delivery evidence before the last documentation-only update. Never change reviewed source to record a receipt, repeat deployment for bookkeeping, or bypass native review/consent.
- Use safe fixtures for visual checks; never infer permission to modify production data or reuse privileged credentials.

## Decision Gates

| Evidence | Action |
| --- | --- |
| Current configuration retains the tag route | Publish an unused semver tag and follow its CI run |
| Configuration or release plan differs | Inspect the actual route before deploying |
| Pending migrations are in scope | Review and apply the exact remote plan; verify it |
| CI or deployment fails | Diagnose the failed step; do not claim release success or retry blindly |
| Only passive tracking changed after approval | Identify it as documentation, not a new application release; honor the harness review policy |
| Human requests visual inspection | Open a visible browser at the intended environment; confirm it is navigable and remains open |

## Execution Steps

1. Verify repository, remote `main`, working-tree status, merged PRs, latest remote tags, package version and release notes. Select the next appropriate version without overwriting an existing tag.
2. Read `vercel.json`, `.github/workflows/ci.yml`, `.github/workflows/release.yml` and `scripts/release/verify-release.mjs`. Currently `main` auto-deploy is disabled; tag pushes matching `v*` run CI, then the gated production workflow.
3. Create and push an annotated tag on the reviewed remote commit, not ambient local `HEAD`. Observe that tag's run through tests, coverage, lint, build and production deployment. Confirm the deployed SHA and production alias from its output.
4. Check database parity separately using the Supabase skill when applicable: verify the production project, migration list, dry run, SQL and affected data. Apply only within authorization, then verify history, objects and behavior. Report unverified parity honestly; do not invent a migration requirement for a UI-only release.
5. Perform scoped read-only production checks. If a visual handoff is requested, inspect installed browser tools first; open the intended page in a visible browser, verify navigation, and keep its session/routing process alive after the agent returns. Do not call a login-only page dashboard-ready. State whether the session uses real or simulated data, any blocked connections, and whether foreground focus was confirmed. Never substitute a local demo for production evidence.
6. Gather terminal CI/deployment results, SHA, alias, checks and limitations; consolidate final evidence in the existing task record and memory. Re-read the record before reporting completion. Preserve uncommitted tracking updates and report their disposition; do not create an extra commit, PR or review cycle solely to store review metadata unless repository policy or the user requires it.

## Output Contract

Return tag, deployed SHA, CI/deployment result, production URL, database status and failed/skipped checks. For visual handoff, add the exact open URL, session type and limitations. Identify any local-only tracking changes. Never infer production success from a merge, preview or local browser session.

## References

The workflow, release gate and migration files in this repository are authoritative; paths above are relative to its root.
