# Quote-Inventory Testing Specification

## Purpose

Define E2E and integration test coverage for the quote creation journey and inventory stock movement flows. This domain is scoped as a **follow-up chained PR** (PR 3) and MUST NOT be included in PR 1 or PR 2 unless review budget allows after the higher-priority flows are complete.

## Scope

- **Quote creation E2E**: Select recipe, add materials/labor/waste, calculate quote, render contract, generate PDF surface.
- **Inventory stock movement integration**: Create material, apply stock movement RPC, verify stock level and movement log.

## Requirements

### Requirement: Quote Creation Browser Journey

The system MUST include a Playwright E2E test that proves a user can create a quote from recipe selection through cost calculation in a real browser.

#### Scenario: Create quote from recipe

- GIVEN a test user with an active subscription and an existing furniture template/recipe
- AND the recipe has associated materials, labor, and waste configured
- WHEN the user navigates to the quote creation flow
- AND selects the recipe
- AND adjusts quantities if needed
- AND submits the quote form
- THEN the app MUST persist a new quote row linked to the user’s workshop
- AND the quote MUST contain the calculated total cost

#### Scenario: Quote calculation is accurate in browser

- GIVEN a test recipe with known material costs and labor rates
- WHEN the user creates a quote from that recipe
- THEN the displayed total cost in the browser MUST match the expected sum of materials + labor + waste + margin
- AND the persisted quote row MUST store the same total cost

### Requirement: Contract and PDF Surface E2E

The system MUST include a Playwright E2E test that proves the contract rendering and PDF generation surface is reachable and produces expected output.

#### Scenario: Contract renders quote variables

- GIVEN a persisted quote with known customer name, project name, and total cost
- WHEN the user navigates to the contract view for that quote
- THEN the contract page MUST display the customer name, project name, and total cost correctly
- AND a PDF generation action MUST be available

#### Scenario: PDF generation is triggered

- GIVEN the contract page for a quote is open in a browser
- WHEN the user triggers the PDF export action
- THEN the app MUST initiate PDF generation
- AND the user MUST receive a downloadable PDF or a preview containing the contract content

### Requirement: Inventory Stock Movement Integration

The system MUST include an integration test that proves stock movement RPC updates real stock levels and creates movement history.

#### Scenario: Stock movement increases quantity

- GIVEN a test material with an initial stock quantity of 10 units
- WHEN the integration test calls the stock movement RPC to add 5 units
- THEN the material’s stock quantity MUST be 15
- AND a `stock_movements` row MUST exist recording the +5 movement

#### Scenario: Stock movement decreases quantity

- GIVEN a test material with an initial stock quantity of 10 units
- WHEN the integration test calls the stock movement RPC to remove 3 units
- THEN the material’s stock quantity MUST be 7
- AND a `stock_movements` row MUST exist recording the -3 movement

#### Scenario: Stock movement is tenant-isolated

- GIVEN a test material exists for workshop A
- AND a test user for workshop B is authenticated
- WHEN the user attempts to create a stock movement for the workshop A material
- THEN the operation MUST be denied by RLS
- AND no stock_movements row MUST be created for workshop B referencing the workshop A material

### Requirement: Inventory E2E Browser Flow

The system SHOULD include a Playwright E2E test that proves a user can create a material and view stock movements in the UI.

#### Scenario: Create material and view stock

- GIVEN a test user with an active subscription
- WHEN the user navigates to inventory, creates a new material with initial stock 20, and saves
- THEN the materials list MUST display the new material
- AND the stock level MUST display 20
- AND the stock movement history MUST show the initial stock entry

## Delivery Guidance

This spec is intentionally scoped for **PR 3** in the SDD 7 chained PR sequence. It MUST NOT be implemented in PR 1 or PR 2. If PR 2 exceeds the 400 changed-line budget, PR 3 MAY be deferred to a later SDD or sprint.
