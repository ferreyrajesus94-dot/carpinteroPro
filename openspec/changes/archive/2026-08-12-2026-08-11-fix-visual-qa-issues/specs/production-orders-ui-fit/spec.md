# Production Orders UI Fit — Delta

## ADDED Requirements

### Requirement: ProductionBoard Horizontal Overflow Containment

The `ProductionBoard` kanban container MUST be horizontally scrollable when the combined width of all active-state columns exceeds the available viewport width. The board MUST NOT cause the page itself to scroll horizontally. Each column MUST retain its visual identity (header, body, footer) and remain accessible via internal horizontal scroll. The "Listo" column (and every other active-state column) MUST be reachable by horizontal scrolling on a 1440px viewport where the column set measures 1628px.

#### Scenario: Kanban fits within viewport horizontally

- GIVEN the production board renders on a 1440px viewport
- AND the five active-state columns together measure 1628px
- WHEN the user views the board
- THEN the page does not scroll horizontally
- AND the kanban container provides internal horizontal scroll
- AND every column (including "Listo") is reachable by scrolling right

#### Scenario: Column visual identity preserved while scrolling

- GIVEN the kanban is scrolled horizontally
- WHEN the user inspects any column header, body, and footer
- THEN the column retains its header, background, and card layout
- AND no column is clipped in a way that hides its header label

### Requirement: ProductionBoard No Page-level Horizontal Overflow

The `ProductionBoard` root container MUST contain all horizontal overflow inside its scroll region. No parent element (`<main>`, layout root) MUST introduce a horizontal scrollbar at 1440px viewport width when the production board is mounted. The board MUST use a bounded `min-w-0` ancestor and an `overflow-x-auto` scroll region so child columns cannot grow the page width.

#### Scenario: No page horizontal scrollbar

- GIVEN the production board is mounted at `/production`
- WHEN the user checks the page at 1440px viewport width
- THEN the page has no horizontal scrollbar
- AND `document.documentElement.scrollWidth` equals `clientWidth` (no overflow)
