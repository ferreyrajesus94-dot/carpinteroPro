# Tenant-Security Testing Specification

## Purpose

Provide ongoing regression coverage that proves authenticated cross-tenant isolation remains enforced across real Supabase client queries and critical business tables. This spec defines testing contracts that guard against RLS policy drift and frontend query leaks that could allow one workshop to access another workshop’s data.

## Requirements

### Requirement: Cross-Tenant SELECT Denial Regression

The system MUST include integration tests that prove an authenticated user for workshop A cannot SELECT rows belonging to workshop B across all business-critical tables.

#### Scenario: Subscriptions are tenant-isolated in integration tests

- GIVEN subscription rows exist for workshop A and workshop B
- AND a test user whose profile maps to workshop A is authenticated via the typed Supabase client
- WHEN the user queries `subscriptions`
- THEN the result set MUST contain only the workshop A row
- AND it MUST NOT contain the workshop B row

#### Scenario: Quotes are tenant-isolated in integration tests

- GIVEN quote rows exist for workshop A and workshop B
- AND a test user whose profile maps to workshop A is authenticated
- WHEN the user queries `quotes`
- THEN the result set MUST contain only workshop A quotes
- AND it MUST NOT contain workshop B quotes

#### Scenario: Clients are tenant-isolated in integration tests

- GIVEN client rows exist for workshop A and workshop B
- AND a test user whose profile maps to workshop A is authenticated
- WHEN the user queries `clients`
- THEN the result set MUST contain only workshop A clients
- AND it MUST NOT contain workshop B clients

#### Scenario: Inventory materials are tenant-isolated in integration tests

- GIVEN material rows exist for workshop A and workshop B
- AND a test user whose profile maps to workshop A is authenticated
- WHEN the user queries `materials`
- THEN the result set MUST contain only workshop A materials
- AND it MUST NOT contain workshop B materials

### Requirement: Cross-Tenant INSERT Denial Regression

The system MUST include integration tests that prove an authenticated user for workshop A cannot INSERT rows that appear to belong to workshop B.

#### Scenario: Direct INSERT into another workshop is denied

- GIVEN a test user whose profile maps to workshop A
- WHEN the user attempts to INSERT a subscription row with `workshop_id` set to workshop B
- THEN the INSERT MUST be denied by RLS
- AND no new row MUST appear in `subscriptions` for workshop B

#### Scenario: Direct INSERT into quotes for another workshop is denied

- GIVEN a test user whose profile maps to workshop A
- WHEN the user attempts to INSERT a quote row with `workshop_id` set to workshop B
- THEN the INSERT MUST be denied by RLS

### Requirement: Cross-Tenant UPDATE/DELETE Denial Regression

The system MUST include integration tests that prove an authenticated user for workshop A cannot UPDATE or DELETE rows belonging to workshop B.

#### Scenario: UPDATE another workshop’s row is denied

- GIVEN a quote row exists for workshop B
- AND a test user whose profile maps to workshop A is authenticated
- WHEN the user attempts to UPDATE the workshop B quote row
- THEN the UPDATE MUST be denied by RLS
- AND the row MUST remain unchanged

#### Scenario: DELETE another workshop’s row is denied

- GIVEN a material row exists for workshop B
- AND a test user whose profile maps to workshop A is authenticated
- WHEN the user attempts to DELETE the workshop B material row
- THEN the DELETE MUST be denied by RLS
- AND the row MUST remain in the database

### Requirement: Auth/Profile Context Isolation in Browser

The system MUST include a Playwright E2E test that proves a user who switches workshops (or a multi-profile edge case) does not see cached data from a previous workshop.

#### Scenario: Logout and login to different workshop clears data

- GIVEN user A is authenticated for workshop A and has loaded quotes and clients
- WHEN user A logs out and user B logs in for workshop B in the same browser session
- THEN the UI MUST NOT display workshop A quotes or clients
- AND the dashboard MUST show workshop B data only

#### Scenario: Browser reload preserves correct workshop context

- GIVEN a user is authenticated for workshop A
- AND the browser page is reloaded
- WHEN the app re-initializes auth and profile loading
- THEN the user MUST remain associated with workshop A
- AND no data from workshop B MUST be visible

### Requirement: Tenant Isolation Coverage for New Tables

The system MUST ensure that any new table introduced after SDD 7 receives tenant-isolation regression coverage before that table is considered production-ready.

#### Scenario: New table must include isolation test

- GIVEN a new table is added to the schema
- AND the table includes `workshop_id uuid NOT NULL`
- AND RLS is enabled
- WHEN the SDD package for that table reaches the spec phase
- THEN the spec MUST include an integration test proving cross-tenant SELECT/INSERT/UPDATE/DELETE denial
- OR it MUST reference this tenant-security-testing spec as the source of the regression requirement

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Test data setup creates false positives | Low | High | Strict fixture isolation; verify workshop_id linkage in every test |
| RLS policy drift not caught | Medium | Critical | Run tenant tests in CI on every PR that touches `supabase/migrations` |
