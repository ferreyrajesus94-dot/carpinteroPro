# Coverage Regression Gate — Canonical Spec

> Authoritative record for the `coverage-regression-gate` capability. Defines how Vitest coverage is measured, excluded, thresholded, and used as a regression signal in local and CI runs.

## Domain: Test Coverage Gate

### Purpose

Prevent silent reduction of tested surface. Configure the V8 provider, declare a conservative global threshold floor measured from current baseline, and document a four-command verification contract so every SDD change self-verifies coverage.

### Requirements

### Requirement: V8 coverage provider is enabled

The project MUST configure Vitest coverage with V8 (`@vitest/coverage-v8`) compatible with `vitest@^4.1.4`. Configuration MUST live in `vite.config.ts` `test.coverage` so CLI and IDE share policy.

#### Scenario: V8 is the configured engine

- GIVEN the repository root
- WHEN a developer inspects `vite.config.ts` `test.coverage`
- THEN `provider` is `"v8"` and `@vitest/coverage-v8` is in `devDependencies`.

#### Scenario: Default output artifacts are produced

- GIVEN a developer runs `npm run test:coverage`
- WHEN the run finishes
- THEN text summary appears in stdout and `coverage/` contains `html`, `lcov`, and `json` artifacts.

### Requirement: Conservative global coverage thresholds

Coverage MUST declare global thresholds for `lines`, `branches`, `functions`, and `statements`. Initial thresholds MUST be measured from current baseline and MUST NOT exceed it. Ratchet-ups MUST follow policy in `openspec/config.yaml`.

#### Scenario: Thresholds match measured baseline

- GIVEN a developer runs `npm run test:coverage` on `main` with no source changes
- WHEN they capture the four metric values
- THEN `test.coverage.thresholds` values are at or below each captured figure.

#### Scenario: Dropping below the floor fails the run

- GIVEN a developer lowers any threshold metric below current test surface
- WHEN `npm run test:coverage` runs
- THEN Vitest exits non-zero with a threshold-violation message naming the metric.

### Requirement: Repository-safe coverage exclusions

Coverage MUST exclude generated artifacts, the test tree, Playwright E2E specs, build output, Supabase Edge Functions and migrations, and TypeScript declaration files. Excludes MUST live in `test.coverage.exclude` as one declarative list with per-entry rationale in design.

#### Scenario: Excluded paths do not affect the gate

- GIVEN the repo contains `tests/**`, `dist/`, `coverage/`, `**/*.d.ts`, `supabase/functions/**`, and `supabase/migrations/**`
- WHEN `npm run test:coverage` finishes
- THEN those paths contribute zero rows and never trigger a threshold violation.

### Requirement: `test:coverage` npm script

`package.json` MUST expose `test:coverage` so developers and CI invoke coverage with one command. The script MUST run `vitest run --coverage` (no watch) with no extra flags.

#### Scenario: Script exists and is one-shot

- GIVEN a developer reads `package.json`
- WHEN they locate the `scripts` block
- THEN `test:coverage` is present and resolves to a non-watch Vitest invocation with `--coverage`.

### Requirement: Four-command verification contract

SDD verification for any change touching source or tests MUST pass four commands in order: `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`. Contract MUST live in `openspec/config.yaml` and `docs/production-sdd-roadmap.md`.

#### Scenario: Contract is documented

- GIVEN a reviewer opens `openspec/config.yaml` and the production SDD roadmap
- WHEN they look up verification policy
- THEN both list the four commands and require coverage for every behavior-changing package.

#### Scenario: Structural-only changes follow the exception path

- GIVEN an SDD package is purely structural
- WHEN the design doc is approved
- THEN it invokes the structural-exception clause from `openspec/config.yaml` and runs the four commands.

### Requirement: CI gate fails below thresholds

CI MUST run `npm run test:coverage` on every push and PR touching source or tests. Non-zero exit MUST fail the pipeline. Coverage artifacts MUST be uploaded.

#### Scenario: Pipeline blocks on threshold drop

- GIVEN a pull request reduces a metric below the declared threshold
- WHEN CI runs the verification job
- THEN the job fails with the Vitest threshold-violation output and the PR cannot merge.

#### Scenario: Coverage report is reviewable

- GIVEN CI completes the coverage job
- WHEN a reviewer opens the workflow run
- THEN `coverage/lcov.info` and the html report are available as build artifacts.
