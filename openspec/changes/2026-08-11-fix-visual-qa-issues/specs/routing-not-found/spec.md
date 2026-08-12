# Routing — Not Found Page

## ADDED Requirements

### Requirement: Branded 404 Catch-all Route

The system MUST register a `path: "*"` catch-all route in `src/app/router.tsx` placed AFTER all named routes so that any URL that does not match a named route renders a branded `NotFoundPage`. The 404 page MUST render under production builds and MUST NOT expose the React Router dev error UI ("Hey developer 👋" / stack traces). The route MUST render the same component on both development and production builds; only the dev-only error overlay is forbidden.

#### Scenario: Unknown URL renders the branded 404

- GIVEN a user navigates to `/this-page-does-not-exist` in production build
- WHEN React Router resolves the URL
- THEN the page renders `NotFoundPage` with a Spanish-language heading
- AND the page does NOT render the React Router default error component

#### Scenario: Named routes still resolve

- GIVEN the user is logged in
- WHEN the user navigates to a valid route (e.g. `/dashboard`, `/inventory`)
- THEN the catch-all does not intercept the request
- AND the named route's component renders normally

#### Scenario: Catch-all placed last

- GIVEN the router configuration
- WHEN the routes are listed in order
- THEN the `path: "*"` route is the last entry after every named route

### Requirement: NotFoundPage Content Contract

`NotFoundPage` MUST display a Spanish-language "Página no encontrada" heading, a short Spanish explanation, and a primary action link/button labeled "Volver al inicio" that navigates to `/dashboard`. The page MUST consume Sawdust design tokens (`--cp-*`, `text-ink*`, `bg-cp-*`, `border-line*`) and MUST NOT introduce raw palette, hex, or inline `oklch()` values. The page MUST NOT leak route internals, stack traces, or framework debug copy.

#### Scenario: Spanish copy and Sawdust tokens

- GIVEN the 404 page renders
- WHEN the page mounts
- THEN the heading reads "Página no encontrada"
- AND a "Volver al inicio" link/button is present and routes to `/dashboard`
- AND colors resolve from Sawdust CSS variables

#### Scenario: No dev error UI leaks

- GIVEN the 404 page renders in production
- WHEN the user inspects the DOM and the browser console
- THEN no "Hey developer" copy, stack traces, or React Router dev affordances are visible
- AND no console errors are emitted by the 404 path

### Requirement: 404 Status Code

The server response for an unmatched route MUST return HTTP status `404`. Client-side routing within the SPA MUST set the document title to indicate "Página no encontrada" so assistive tech and external tooling can detect the 404 state.

#### Scenario: Document title reflects 404

- GIVEN the user lands on a non-matching URL
- WHEN the 404 page renders
- THEN the document title contains "404" or "Página no encontrada"
