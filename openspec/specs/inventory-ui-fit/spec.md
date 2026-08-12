# Inventory UI Fit — Delta

## ADDED Requirements

### Requirement: MaterialForm Dialog Body Scrolls Inside the Modal

`MaterialForm` MUST render inside a `Dialog` whose body region scrolls when the form content exceeds the available viewport height. The submit footer (containing the "Agregar material" button) MUST stay pinned inside the dialog and remain reachable via internal scroll only — the dialog MUST NOT push the page itself to scroll. At a 900px viewport, when content scrolls to 950px, the submit button MUST be reachable by scrolling the dialog body, not the page.

#### Scenario: Submit button reachable at 900px viewport

- GIVEN the `MaterialForm` dialog is open on a 900px viewport
- AND the form content measures 950px
- WHEN the user opens the dialog and attempts to reach the submit button
- THEN the dialog body scrolls internally
- AND the "Agregar material" submit button becomes visible without scrolling the page

#### Scenario: Page does not scroll while dialog is open

- GIVEN the `MaterialForm` dialog is open
- WHEN the user scrolls inside the dialog body
- THEN the underlying page does not scroll
- AND on Escape or close, the page returns to its original scroll position

### Requirement: MaterialForm Placeholder Is Not Truncated

The "Precio por pack" input field in `MaterialForm` MUST display its full Spanish placeholder ("Precio por pack") without ellipsis or clipping at the standard dialog width. The input MAY be widened, or the placeholder text MAY be shortened to a Spanish equivalent that fits, but the placeholder MUST be fully visible on a 900px viewport.

#### Scenario: Placeholder fits the input width

- GIVEN the `MaterialForm` dialog renders on a 900px viewport
- WHEN the user looks at the price-per-pack input
- THEN the placeholder text "Precio por pack" (or shorter Spanish equivalent) is fully visible
- AND no `…` or trailing clipping indicator appears

### Requirement: InventoryTable Removes Empty Tendencia Column

`InventoryTable` MUST NOT render a "Tendencia" column that displays a constant "—" placeholder. The system MUST either (a) drop the column entirely from the table header and rows, or (b) populate it with a real trend signal. Until a real trend signal exists, the column MUST be removed.

#### Scenario: Tendencia column is not rendered

- GIVEN the inventory table renders a list of materials
- WHEN the user inspects the table headers
- THEN no column header labeled "Tendencia" is present
- AND no row cell contains a constant "—" trend indicator

### Requirement: Modal Escape Tears Down Overlay

Every modal dialog driven by the shared `Dialog` primitive MUST unmount both the dialog content and the backdrop overlay (`fixed inset-0 z-50 bg-black/80`) when the user presses Escape. The overlay MUST NOT remain visible after the dialog closes. The system MUST remove the overlay element from the DOM (not merely hide it) so subsequent focus, scroll, and `pointer-events` are not blocked.

#### Scenario: Escape removes overlay

- GIVEN a modal dialog is open
- WHEN the user presses Escape
- THEN the dialog content unmounts
- AND the backdrop overlay element is removed from the DOM
- AND the page beneath becomes interactive again

#### Scenario: No focus trap leak after close

- GIVEN a modal dialog is closed via Escape
- WHEN the user tabs through the page
- THEN focus is not trapped behind a stale overlay
