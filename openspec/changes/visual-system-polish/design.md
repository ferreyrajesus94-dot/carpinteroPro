# Design: Visual System Polish

## Technical Approach

Polish the existing Sawdust system instead of redesigning it. Add small shared contracts for feedback states and page headers, then migrate high-impact call sites where audits found raw colors, ad-hoc tables, inconsistent headers, or missing accessibility affordances. No product flow, API, or database behavior changes.

## Architecture Decisions

| Decision | Alternatives / tradeoff | Choice |
|---|---|---|
| Feedback states | Restyle every feature inline is faster but keeps drift. | Create `src/shared/ui/feedback-state.tsx` wrapping existing `EmptyState`, `Button`, and token classes; migrate feature error/loading/empty states to it. |
| Color roles | Raw Tailwind palette and inline OKLCH are local and easy but not palette/dark safe. | Add role utilities/tokens in `src/index.css` (`chip-warn/success/info`, chart tokens, focus/motion guards) and replace status/chart leaks. |
| Header/table adoption | A full component-system rewrite is cleaner but too large. | Add `PageHeader`; keep existing `Table*` API and token-align its classes before migrating target tables. |
| Icon boundary | One icon set reduces choices but would churn brand/nav or control code. | Keep both: Flaticon for brand/nav/decorative glyphs; Lucide for controls/actions and size-prop use. Switch landing `Zap` brand marks to `fi-br-hammer`. |
| Delivery | One PR is simpler but likely exceeds 400 lines. | Use stacked PRs to `main`; each slice must stay ≤400 changed lines and verify independently. |

## Data Flow

    Feature query state ──→ ErrorState / EmptyState / LoadingState
            │                         │
            ├── Page content ───────→ PageHeader + Table*
            │                         │
            └── Theme class ────────→ Sawdust CSS variables

ErrorBoundary and RouteErrorFallback become consumers of the same `ErrorState` contract, preserving error reporting while aligning route/render/per-feature fallback visuals.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/index.css` | Modify | Add explicit `theme-sawdust`, status/chart role tokens, global focus-visible and reduced-motion guards. |
| `src/shared/ui/feedback-state.tsx` | Create | Shared `ErrorState`, `EmptyState` variants, and `LoadingState` with live regions/`aria-busy`. |
| `src/shared/ui/page-header.tsx` | Create | Eyebrow/title/subtitle/actions primitive using Sawdust typography. |
| `src/shared/ui/table.tsx` | Modify | Token-align padding, headings, hover states; keep public exports. |
| `src/shared/components/ErrorBoundary.tsx`, `RouteErrorFallback.tsx` | Modify | Render shared `ErrorState` while preserving retry/support/reporting. |
| `src/shared/types/quotes.ts`, `src/shared/ui/PriceSparkline.tsx` | Modify | Replace raw status/chart colors with token classes/variables. |
| `src/features/landing/components/LandingHeader.tsx`, `LandingFooter.tsx` | Modify | Replace Lucide `Zap` brand mark with Flaticon hammer; improve focus/touch targets. |
| `src/app/layouts/AppLayout.tsx` | Modify | Shared loading state, unavailable topbar search badge, focus/touch target fixes. |
| `src/features/{dashboard,inventory,quotes,recipes,clients,tasks}/**` | Modify | Migrate target feedback states, chips, headers, and high-impact tables. |
| `src/features/admin/components/{BillingPage,SupportPage,WorkshopsPage}.tsx` | Modify | Use `PageHeader`, `Table*`, and tokenized empty/error states. |

## Interfaces / Contracts

```ts
const EMPTY_STATE_VARIANT = {
  NO_RESULTS: "no-results",
  EMPTY_FEATURE: "empty-feature",
  UNAVAILABLE: "unavailable",
} as const;

type EmptyStateVariant = (typeof EMPTY_STATE_VARIANT)[keyof typeof EMPTY_STATE_VARIANT];

interface FeedbackStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}
```

New React components should use named exports and avoid manual memoization. Existing shadcn `forwardRef` APIs may remain unless the slice is already touching that primitive.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | FeedbackState live regions, loading `role="status"`, ErrorBoundary retry/support rendering. | Vitest + Testing Library near `src/shared/**` or existing component tests. |
| Integration | Quote/dashboard/admin migrated states and table/header rendering. | Existing Vitest feature tests plus targeted new tests for migrated call sites. |
| Visual/E2E | Dashboard, QuoteList, admin BillingPage in light/dark; reduced motion; chart/status contrast. | Playwright snapshots/manual screenshot notes recorded in verify report. |

## Migration / Rollout

No data migration required. Use stacked PRs to `main`:

1. PR A — tokens, feedback states, ErrorBoundary, chart/status/brand fixes. Forecast: Medium, ≤400 lines.
2. PR B — `PageHeader`, unavailable/focus/touch fixes, primary page-header migrations. Forecast: Medium, ≤400 lines.
3. PR C — `Table*` alignment and quote/dashboard/admin table migrations. Forecast: High; split further by app/admin if it approaches 400 lines.

## Open Questions

- [ ] None blocking; table slice may need one extra PR if changed-line forecast exceeds 400.
