# Dashboard UI Fit — Delta

## ADDED Requirements

### Requirement: Recent Quotes Table Fits the Viewport

The Dashboard "Recent Quotes" table MUST fit within a 1440px viewport without horizontal page overflow. The system MUST either (a) constrain each column's width so the table fits, or (b) wrap the table in a bounded horizontal scroll region so the page itself does not scroll. In either case, all column headers and at least the first data row MUST be visible without page-level horizontal scrolling.

#### Scenario: No horizontal overflow at 1440px

- GIVEN the dashboard renders on a 1440px viewport
- WHEN the recent-quotes table mounts
- THEN the page has no horizontal scrollbar
- AND `document.documentElement.scrollWidth` equals `clientWidth`
- AND every column header is visible (no header clipped off the right edge)

#### Scenario: Table content remains readable

- GIVEN the recent-quotes table renders
- WHEN the user reads any row
- THEN each cell's content is visible (full text, status chip, or numeric value)
- AND no content is hidden behind a horizontal-only viewport edge

### Requirement: Recent Quotes Table Uses Bounded Columns or Scroll Wrapper

The recent-quotes table MUST be implemented with either constrained column widths (via `Table*` primitive from `visual-system-polish` with explicit widths or `truncate` on cells) OR be wrapped in a horizontal-scroll container with `min-w-0` on the parent. The implementation MUST NOT rely on `whitespace-nowrap` cells to force the table past the viewport width.

#### Scenario: Table does not exceed container

- GIVEN the recent-quotes table renders inside its dashboard card
- WHEN the user inspects the table element's `scrollWidth` vs `clientWidth`
- THEN either the table equals the container width (no overflow), or it overflows only inside its own scroll wrapper
- AND no parent dashboard card grows past the viewport width
