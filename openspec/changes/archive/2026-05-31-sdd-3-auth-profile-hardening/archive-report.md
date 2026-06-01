# Archive Report — sdd-3-auth-profile-hardening

## Status

PASS — SDD 3 verified complete enough to archive; archive-time fallback was approved for the flat spec and a canonical fallback copy was preserved before move.

## Artifacts read

- `openspec/config.yaml`
- `docs/production-sdd-roadmap.md`
- `openspec/changes/sdd-3-auth-profile-hardening/proposal.md`
- `openspec/changes/sdd-3-auth-profile-hardening/spec.md`
- `openspec/changes/sdd-3-auth-profile-hardening/design.md`
- `openspec/changes/sdd-3-auth-profile-hardening/tasks.md`
- `openspec/changes/sdd-3-auth-profile-hardening/verify-report.md`
- `openspec/changes/sdd-3-auth-profile-hardening/apply-progress.md`
- `git diff --numstat -- src/shared/providers/AuthProvider.tsx src/shared/providers/AuthProvider.test.tsx src/shared/hooks/useWorkshopId.test.ts`
- `git diff --numstat -- src/app/layouts/AppLayout.tsx src/app/layouts/AppLayout.test.tsx`

## Domains reviewed

- Auth/Profile State Contract
- Profile Query Error Handling
- Missing Profile Handling
- Valid Not-Onboarded Profile Behavior
- Retry Rules
- Fail-Closed AppLayout and Recovery UX
- Workshop ID Safety During Errors
- Tests and Validation

## Archive notes

- Functional verification passed, including focused tests, full tests, lint, build, diff check, and review-budget checks after churn reduction.
- PR1 and PR2 remained separate review slices under the 400-line budget after reducing formatting-only churn.
- No active same-domain sibling change was found under `openspec/changes/*/spec.md`.
- Archive-time fallback was approved because this change uses a flat `spec.md` and has no `sync-report.md`.
- Canonical fallback copy was preserved at `openspec/specs/sdd-3-auth-profile-hardening/spec.md` before moving the change.
- No destructive merge was required.
- No Engram memory tool was available in this toolset, so no memory observation ID was recorded here.

## Archived path

`openspec/changes/archive/2026-05-31-sdd-3-auth-profile-hardening/`
