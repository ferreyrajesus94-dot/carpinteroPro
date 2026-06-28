# Tasks: Vitest Coverage Thresholds

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150–220 (lock file may inflate) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes (forced by session preflight) |
| Suggested split | Single slice → 1 chained PR |
| Delivery strategy | force-chained (auto-chain equivalent) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Stand up V8 coverage gate end-to-end (config, script, thresholds, docs, CI) | PR #1 → tracker branch `feature/coverage-gate` | All deliverable in one slice per design §Migration. Tracker PR stays draft until child merges. Diff expected ~150–220 lines, well under 400 even with lock churn. |

### PR Chain Diagram (Feature Branch Chain)

```text
main
  └─ feature/coverage-gate   (tracker, draft/no-merge PR)
        └─ feat/coverage-gate-impl  (PR #1 — current work) 📍
```

- **Tracker branch**: `feature/coverage-gate` — opened as draft PR, no merge until child lands.
- **PR #1 base**: `feature/coverage-gate` — contains every change in this tasks file. Once approved, squash-merge into tracker; tracker is fast-forwarded to `main` afterward.
- **No follow-up child PRs** — this change is intentionally one slice.

## Phase 1: Foundation — Provider & Script (no app behavior change)

- [x] 1.1 Add dev dependency `@vitest/coverage-v8` aligned with `vitest@^4.1.4` to `package.json` and refresh `package-lock.json`.
- [x] 1.2 Add `"test:coverage": "vitest run --coverage"` to `package.json` `scripts` (no watch, no extra flags).
- [x] 1.3 Extend `vite.config.ts` `test` block with `coverage: { provider: "v8", reporter: ["text", "html", "lcov", "json"], exclude: [...], thresholds: { lines: 0, branches: 0, functions: 0, statements: 0 } }` using the exclude list from design §Interfaces/Contracts (tests, e2e, dist, coverage, `*.d.ts`, `src/shared/lib/database.ts`, supabase functions/migrations).

## Phase 2: Measure & Calibrate Thresholds

- [x] 2.1 Run `npx vitest run --coverage` against the temporary zero-threshold config; capture the four reported metric values for `lines`, `branches`, `functions`, `statements`.
- [x] 2.2 Update `vite.config.ts` thresholds to a conservative floor at or just below each measured baseline (default floor: 50 per design §Approach; lower if baseline requires).
- [x] 2.3 Add a `// coverage-regression-gate` comment above the coverage block in `vite.config.ts` noting the measured baseline date and the ratchet intent (per-entry rationale per spec §Repository-safe coverage exclusions).

## Phase 3: Policy & Documentation

- [x] 3.1 In `openspec/config.yaml`, replace `testing.coverage_tool: "vitest built-in (not configured yet)"` with the configured V8 policy, and add a `ratchet` note in `testing.guidance` describing the four-command verification contract and how to raise thresholds.
- [x] 3.2 In `docs/production-sdd-roadmap.md`, add a "Coverage regression gate" section documenting the four-command verification contract (`npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`) and the ratchet expectation for future SDD packages.
- [x] 3.3 In `docs/testing/runbook.md`, add a "Coverage gate" subsection linking the coverage script to the existing unit-test flow and clarifying it is separate from Playwright E2E.

## Phase 4: CI Integration

- [x] 4.1 In `.github/workflows/ci.yml`, insert a new step `Run coverage` invoking `npm run test:coverage` (with the same env vars as the existing test step) immediately after `Run tests`.
- [x] 4.2 Append an `actions/upload-artifact@v4` step uploading `coverage/` with `if: always()` and a 14-day retention, so `lcov.info` and the html report survive both success and failure.
- [x] 4.3 Reorder the job steps so lint, build, and coverage follow test in that order; verify `concurrency` and `permissions` blocks remain intact.

## Phase 5: Verification

- [x] 5.1 Run `npm test` locally — full Vitest suite still passes (no behavior change).
- [x] 5.2 Run `npm run test:coverage` locally — exits 0; report shows the four threshold metrics at or above configured floor (text output in stdout); `coverage/{html,lcov,json}` artifacts present.
- [x] 5.3 Run `npm run lint` — clean, no new warnings.
- [x] 5.4 Run `npm run build` — production build succeeds.
- [ ] 5.5 Push branch and confirm CI: the new coverage step runs, uploads `coverage/` artifact, and gates merge on threshold violation (intentional negative test: temporarily set one threshold above baseline, confirm job fails with a Vitest threshold-violation message, then revert). _(requires push — deferred to PR phase)_

## Phase 6: Cleanup (if needed)

- [x] 6.1 Remove any temporary scratch files used to capture baseline metrics (do not commit them).
- [x] 6.2 Update `.gitignore` if `coverage/` is not already excluded.

## Rollback Notes

If the gate blocks launch or breaks CI, rollback is a single revert of the merged branch on `feature/coverage-gate` (and a follow-up revert on `main`). No data or schema changes are involved. Specifically, rollback removes:
- `package.json` `test:coverage` script and `@vitest/coverage-v8` dev dep
- `vite.config.ts` `coverage` block
- `openspec/config.yaml` coverage policy edit
- `docs/production-sdd-roadmap.md` and `docs/testing/runbook.md` coverage sections
- `.github/workflows/ci.yml` coverage step and artifact upload

`npm test` remains the source of truth either way.

## Verification Commands (the four-command contract)

```bash
npm test
npm run test:coverage
npm run lint
npm run build
```

Each must exit 0 on `main` after PR #1 merges.
