# SDD8 Archive Report — Architecture Cleanup

## Status

**PASS**

## Executive summary

SDD8 Architecture Cleanup is archived after successful implementation, verification, CI, Playwright smoke checks, and canonical spec sync. The project now has enforceable staged feature-sliced boundaries, shared ownership for cross-feature utilities/contracts, app-level composition seams for dashboard/settings/onboarding, and a documented follow-up decision for remaining core coupling.

SDD7 PR3 remained explicitly out of scope.

## Artifacts read

- `openspec/config.yaml`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/proposal.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/spec.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/design.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/tasks.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/apply-progress.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/verify-report.md`
- `openspec/changes/2026-06-03-sdd-8-architecture-cleanup/decisions/core-coupling.md`

## Domains synced

- `architecture-cleanup` → `openspec/specs/architecture-cleanup/spec.md`

## Requirement changes

- ADDED: canonical `architecture-cleanup` spec covering:
  - shared utility/contract ownership,
  - feature import boundary enforcement,
  - app-owned dashboard composition,
  - app-owned settings/onboarding composition,
  - explicit deferral of core domain coupling.

## Archive checks

- Verification report present and **PASS**.
- No unresolved FAIL, BLOCKED, or CRITICAL markers.
- Required artifacts (proposal, spec, design, tasks, apply-progress, verify-report, core coupling decision) are present.
- Canonical spec synced to `openspec/specs/architecture-cleanup/spec.md`.
- No source/test/package changes are part of the archive step.
- GitHub Actions CI for final SDD8 commit `b11360c` passed.

## Validation evidence

- GitHub Actions CI ✅ — run `26944919990`, conclusion `success`.
- `npm test` ✅ — final WU4 evidence: 38 files / 252 tests passed.
- `npm run lint` ✅ — 0 errors, 6 pre-existing React Compiler/RHF `watch()` warnings.
- `npm run build` ✅.
- `git diff --check` ✅ during apply/review.
- Playwright active-trial browser E2E ✅ — 1/1.
- Temporary SDD8 Playwright smoke ✅ — dashboard/settings/onboarding composition paths passed; temporary spec removed.

## Remaining intentional exceptions

The following lint exceptions remain by design and are deferred to a separate SDD/change:

- `crm → quotes`
- `quotes → crm`
- `quotes → recipes`
- `quotes → settings`
- `recipes → inventory`
- `recipes → settings`

These are documented in `decisions/core-coupling.md` and the canonical `architecture-cleanup` spec.

## Changed files for archive

- `openspec/config.yaml` — SDD8 status updated to `archived`; known gaps updated.
- `openspec/specs/architecture-cleanup/spec.md` — new canonical spec.
- `openspec/changes/archive/2026-06-03-sdd-8-architecture-cleanup/` — archived change artifacts.

## Archived path

- `openspec/changes/archive/2026-06-03-sdd-8-architecture-cleanup/`

## Risks / follow-ups

- Start a separate SDD for core workflow coupling if the team wants to remove the remaining lint exceptions.
- Existing React Compiler warnings for React Hook Form `watch()` are unrelated and remain outside SDD8.
- SDD7 PR3 remains pending and should not be resumed unless explicitly requested.
