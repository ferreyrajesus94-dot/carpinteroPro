# Business-Critical Testing Specification

## Purpose

Establish a deterministic, maintainable E2E and integration test harness that proves CarpinteroPro’s highest-risk user journeys and data-integrity contracts across real application boundaries. The outcome MUST enable a maintainer to run business-critical regression tests locally and in CI without manual steps, and MUST preserve the existing fast unit/component test suite.

## Scope Split

### First PR Scope (PR 1 — Harness + One Critical Contract)
- Playwright installation, configuration, and one browser E2E journey.
- Deterministic fixture model and teardown helper.
- Integration-test environment contract and one Supabase-level integration test.
- Runbook and CI documentation.

### Follow-Up Chained PRs
- PR 2: Billing/webhook/tenant integration coverage.
- PR 3: Inventory stock movement and quote creation journey (if not deferred).

## Requirements

### Requirement: E2E Framework Selection

The system MUST use Playwright for real-browser E2E tests unless the spec/design phase uncovers a project-blocking constraint.

#### Scenario: Framework is Playwright

- GIVEN the E2E test harness is introduced
- WHEN `package.json` devDependencies and npm scripts are inspected
- THEN `@playwright/test` MUST be present
- AND there MUST be a documented `npm run test:e2e` command
- AND there MUST be a documented `npm run test:e2e:ui` command for headed local debugging

#### Scenario: Playwright config is TypeScript-first

- GIVEN the project uses TypeScript ~6.0
- WHEN `playwright.config.ts` is inspected
- THEN it MUST define at least one project for Chromium
- AND it MUST use a `baseURL` derived from an environment variable or default to `http://localhost:5173`
- AND it MUST specify `testDir` as `tests/e2e/`

### Requirement: Deterministic Test Data Setup and Teardown

The system MUST provide deterministic test data setup and teardown so that E2E and integration tests are repeatable and do not pollute production or shared databases.

#### Scenario: Seeded test identities

- GIVEN the test harness runs
- WHEN setup helpers are invoked
- THEN they MUST create documented test users, profiles, and workshops with stable identifiers
- AND those identities MUST NOT overlap with production data
- AND the setup MUST be idempotent across repeated test runs

#### Scenario: Cleanup after test execution

- GIVEN a test or test suite completes, whether passing or failing
- WHEN teardown helpers run
- THEN they MUST remove all test-created rows from `profiles`, `workshops`, `subscriptions`, and any other tables mutated during the test
- AND orphaned rows MUST NOT remain

#### Scenario: Isolated workshops for tenant tests

- GIVEN a tenant-isolation regression test
- WHEN the test creates workshops A and B with distinct test users
- THEN each test user MUST be linked to exactly one workshop
- AND no shared workshop MUST exist between tenant-isolation test users

### Requirement: No Service-Role Exposure in Frontend Tests

The system MUST NOT use the Supabase service-role key in frontend test code, E2E test code, or browser-accessible environment variables.

#### Scenario: Test helpers use the same typed client as production

- GIVEN an E2E or integration test that interacts with Supabase
- WHEN the test makes an authenticated request
- THEN it MUST use the typed `supabase` client from `@/shared/lib/supabase` or an equivalent anon-key-based browser client
- AND the service-role key MUST NOT appear in `tests/`, `src/`, or any `.env.*` file readable by the test runner browser

#### Scenario: Integration tests that need admin operations use a backend path

- GIVEN an integration test that needs to create or clean up data beyond what an authenticated user can do
- WHEN the test performs that setup or teardown
- THEN it MUST use a Supabase Edge Function, a local Supabase CLI admin command, or a server-only test helper process
- AND it MUST NOT embed the service-role key in frontend or browser test code

### Requirement: Existing Unit Test Suite Remains Green

The system MUST keep `npm test` passing and MUST not break existing Vitest + Testing Library tests.

#### Scenario: Existing tests after harness addition

- GIVEN the existing `npm test` command runs Vitest
- WHEN the E2E/integration harness is added
- THEN `npm test` MUST still pass without modification
- AND `npm run test:e2e` MUST be a separate command
- AND any shared test utilities MUST not introduce side effects into the Vitest environment

### Requirement: Integration-Test Environment Contract

The system MUST define whether integration tests run against a local Supabase instance, a staging project, or a dedicated test project, and MUST document required environment variables.

#### Scenario: Environment is documented

- GIVEN `docs/testing/environment.md` or equivalent runbook section exists
- WHEN it is reviewed
- THEN it MUST state the integration-test target (e.g., local Supabase started via CLI)
- AND it MUST list all required environment variables for local and CI execution
- AND it MUST provide a one-command startup path for local integration testing

#### Scenario: CI execution is defined

- GIVEN CI runs the test suite
- WHEN E2E or integration tests are executed
- THEN they MUST use the documented environment
- AND CI MUST fail if required environment variables are missing
- AND CI MUST NOT use production database credentials

### Requirement: Review-Budget Split and Chained PR Discipline

The system MUST respect the 400 changed-line review budget per PR. Harness and first-flow files MUST be sized so that PR 1 stays under the budget.

#### Scenario: PR 1 line count

- GIVEN the first implementation PR is opened
- WHEN its changed-line count is inspected
- THEN it MUST NOT exceed 400 changed lines unless recorded as a `size:exception` with explicit justification
- AND the PR MUST include only the Playwright config, one fixture/helper file, one E2E journey, one integration test, and runbook docs

#### Scenario: Follow-up PRs are scoped

- GIVEN PR 2 or PR 3 is planned
- WHEN its scope is reviewed
- THEN each PR MUST be scoped to one additional critical flow or small group of related flows
- AND each PR MUST stay within the 400 changed-line budget or be split further

### Requirement: Runbook and Command Documentation

The system MUST document how to run E2E and integration tests locally, how to debug failures, and what to do when tests flake.

#### Scenario: Local runbook exists

- GIVEN a developer new to the project
- WHEN they read `docs/testing/runbook.md`
- THEN they MUST find step-by-step instructions for:
  - Starting the required environment
  - Running `npm run test:e2e`
  - Running a single test file
  - Opening the Playwright UI debugger
  - Cleaning up stale test data

#### Scenario: Framework commands are discoverable

- GIVEN `package.json` scripts
- WHEN they are inspected
- THEN there MUST be scripts for `test:e2e`, `test:e2e:ui`, and `test:e2e:debug`
- AND `README.md` MUST reference the testing runbook

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| E2E flakiness | Medium | High | Seeded data, stable selectors, minimal UI scope, small first suite |
| Test DB pollution | Medium | High | Isolated fixtures, teardown helpers, documented test identities |
| Local Supabase setup complexity | Medium | High | One-command startup path documented before apply |
| Review scope exceeds budget | High | Medium | Strict PR 1 scope: config + one E2E + one integration + docs only |
