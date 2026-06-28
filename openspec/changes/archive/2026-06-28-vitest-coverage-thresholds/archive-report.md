# Archive Report — vitest-coverage-thresholds

## Status

**PASS** — Archived successfully.

## Executive Summary

The change adds a V8 coverage regression gate via `@vitest/coverage-v8`, global thresholds, repo-safe excludes, a `test:coverage` npm script, the four-command verification contract in docs, and CI integration. All 19/19 tasks complete, verified post-merge (PR #105, main CI run 28335667544). Delta spec for the new `coverage-regression-gate` domain was promoted to canonical specs. No CRITICAL issues in verify report.

## Artifacts Read

| Artifact | Path | Engram Obs ID | Status |
|----------|------|---------------|--------|
| Proposal | `openspec/changes/vitest-coverage-thresholds/proposal.md` | #821 | Done |
| Spec (delta) | `openspec/changes/vitest-coverage-thresholds/specs/coverage-regression-gate/spec.md` | #825 | Done |
| Design | `openspec/changes/vitest-coverage-thresholds/design.md` | #824 | Done |
| Tasks | `openspec/changes/vitest-coverage-thresholds/tasks.md` | #827 | Done (19/19 complete) |
| Apply progress | `openspec/changes/vitest-coverage-thresholds/apply-progress.md` | #829 | Done |
| Verify report | `openspec/changes/vitest-coverage-thresholds/verify-report.md` | #837 | **PASS**, Blockers: None |

## Engram Observation ID Map

```
#821 → sdd/vitest-coverage-thresholds/proposal
#825 → sdd/vitest-coverage-thresholds/spec
#824 → sdd/vitest-coverage-thresholds/design
#827 → sdd/vitest-coverage-thresholds/tasks
#829 → sdd/vitest-coverage-thresholds/apply-progress
#837 → sdd/vitest-coverage-thresholds/verify-report
```

## Domains Synced

| Domain | Operation | Canonical File |
|--------|-----------|----------------|
| Coverage Regression Gate | ADDED — new domain (6 requirements, 8 scenarios) | `openspec/specs/coverage-regression-gate/spec.md` |

## ADDED Requirements

- V8 coverage provider is enabled — 2 scenarios (V8 engine, default output artifacts)
- Conservative global coverage thresholds — 2 scenarios (thresholds match baseline, dropping below floor fails)
- Repository-safe coverage exclusions — 1 scenario (excluded paths do not affect gate)
- `test:coverage` npm script — 1 scenario (script exists and is one-shot)
- Four-command verification contract — 2 scenarios (contract documented, structural exception path)
- CI gate fails below thresholds — 2 scenarios (pipeline blocks on threshold drop, coverage report is reviewable)

## Same-Domain Active Change Warnings

No active same-domain collisions. This is the first change for the `coverage-regression-gate` domain.

## Verification Basis

- `verify-report.md` Status: **PASS**, Blockers: None
- PR #105 merged to `main` at `2026-06-28T20:53:53Z` (merge commit `b0b2385`)
- Main CI run [28335667544](https://github.com/ferreyrajesus94-dot/carpinteroPro/actions/runs/28335667544): `success`, all 21 steps green
- Local verification commands all PASS (790 tests, coverage thresholds > 50, lint 0 errors, build 3.84s)
- Negative threshold test proved gate fires locally (`--coverage.thresholds.lines=999` exits 1)

## Archived Path

`openspec/changes/archive/2026-06-28-vitest-coverage-thresholds/`

## Residual Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Threshold ratchet could be forgotten | LOW | Documented in `openspec/config.yaml` and `docs/production-sdd-roadmap.md` |
| 6 pre-existing lint warnings | LOW | Tracked as follow-up; not introduced by this change |
| Two extra excludes not in design doc | LOW | Justified inline; suggestion raised to add to design doc |

## Engram Persistence

Artifact store mode: `hybrid`. Archive report written to filesystem and Engram (topic_key `sdd/vitest-coverage-thresholds/archive-report`).
