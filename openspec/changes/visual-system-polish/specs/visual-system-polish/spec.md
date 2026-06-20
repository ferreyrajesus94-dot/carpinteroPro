# Visual System Polish Specification

## Purpose

Define token, feedback-state, primitive, icon-boundary, and accessibility contracts that make generic UI states production-polished and palette-aware across landing, app, and admin — without changing workflows.

## Requirements

### Requirement: Token & Color Role Consistency

Status, feedback, and chart UI MUST consume Sawdust tokens (`--cp-*`, `bg-cp-*`, `text-ink*`, `border-line*`) and MUST NOT introduce raw palette, hex, or inline `oklch()`. `index.css` MUST add `chip-warn`, `chip-success`, `chip-info`. Charts MUST use `--chart-up`, `--chart-down`, `--chart-neutral`. The `theme-sawdust` safelist MUST have a CSS block or be removed.

#### Scenario: Status UI is palette-aware

- GIVEN a status surface under any palette/theme
- WHEN the page renders
- THEN colors resolve from CSS variables, not raw palette/hex/inline `oklch()`
- AND contrast stays legible in every palette × light/dark combination

### Requirement: Feedback State Wrappers

`shared/ui/feedback-state.tsx` MUST expose `<ErrorState>`, `<EmptyState variant="no-results" | "empty-feature" | "unavailable">`, and `<LoadingState>`. Per-feature error/empty blocks MUST migrate to them. Spinners MUST carry `role="status"` and `aria-busy="true"`.

#### Scenario: Error and empty use shared wrappers

- GIVEN a feature query fails or returns zero rows
- WHEN the list renders
- THEN it shows `<ErrorState>` or `<EmptyState>` with retry/action
- AND the treatment matches the ErrorBoundary fallback in tokens and tone
- AND a live region announces the state to assistive tech

### Requirement: Page Header & Data Table Primitives

`shared/ui/page-header.tsx` MUST expose `<PageHeader>` (eyebrow, title, subtitle, actions). `Table*` MUST be the single data-table contract. All app/admin headers MUST use `<PageHeader>`; all data tables in quotes, dashboard, and admin MUST use `Table*`.

#### Scenario: Headers and tables are uniform

- GIVEN a feature or admin page renders
- WHEN it mounts
- THEN its top header uses `<PageHeader>` with consistent hierarchy
- AND any tabular data uses `Table*` with consistent padding, header, and hover
- AND no ad-hoc `<table>` markup remains in feature or admin code

### Requirement: Icon System Boundary & Brand Mark

Flaticon MUST be used for navigation, brand, and decorative glyphs. Lucide MUST be used for interactive controls and icons needing per-instance sizing. The landing brand mark MUST switch from Lucide `Zap` to Flaticon `fi-br-hammer` to match the app.

#### Scenario: Boundary is enforced

- GIVEN a brand, nav, control, or feature icon renders
- WHEN it mounts
- THEN brand/nav uses Flaticon and controls/actions use Lucide
- AND no `fi fi-rr-*` class appears inside `src/shared/ui/*` or form/row controls
- AND no Lucide `Zap` import remains in landing brand positions

### Requirement: Disabled & Unavailable Affordances

Intentionally disabled controls (e.g. topbar search) MUST communicate unavailability with a visible badge, tooltip, or label — not only a `disabled` attribute. Mobile icon-only controls MUST measure at least 44×44 CSS pixels.

#### Scenario: Disabled control and touch target

- GIVEN a disabled control or a mobile icon-only control
- WHEN it renders
- THEN the disabled state shows a "Pronto" badge or tooltip explaining the unavailability
- AND mobile icon-only controls measure at least 44×44 CSS pixels with a visible focus ring

### Requirement: Accessibility & Reduced-Motion Guard

Links, icon-only buttons, and toggles MUST show a visible focus ring. Decorative animations (`animate-pulse`, landing demos) MUST be suppressed under `prefers-reduced-motion: reduce`.

#### Scenario: Focus visible, motion reduced

- GIVEN focus reaches a link/icon-only button/toggle OR `prefers-reduced-motion: reduce` is set
- WHEN the page renders
- THEN a `focus-visible` ring appears using the design token ring color
- AND `animate-pulse` and landing animations are suppressed or replaced with static states
- AND layout and information remain intact

### Requirement: Visual Regression Validation

PRs touching tokens, feedback states, or page/table primitives MUST ship Playwright snapshots for `Dashboard`, `QuoteList`, and admin `BillingPage` in light and dark. Snapshots MUST pass before merge.

#### Scenario: Snapshots cover high-impact pages

- GIVEN a PR touches tokens, feedback states, or page/table primitives
- WHEN verification runs
- THEN Playwright snapshots exist for those pages in both themes
- AND they're recorded in the change's verify report
