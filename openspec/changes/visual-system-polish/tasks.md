# Tasks: Visual System Polish

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Changed lines | ~750-1200 across 4 PRs; each ≤400 |
| 400-line risk | High overall; per-slice Medium/Low |
| Chained PRs | Yes |
| Split | A → B → C1 → C2 |
| Strategy | stacked-to-main, auto-forecast |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Work Units

| Unit | Goal | PR | Dep |
|------|------|----|-----|
| A | Tokens, feedback, ErrorBoundary, brand | PR A | — |
| B | PageHeader, a11y, topbar search badge | PR B | A |
| C1 | Table* + quotes/dashboard tables | PR C1 | A |
| C2 | Admin tables | PR C2 | C1 |

## Phase 1: Tokens & Feedback (PR A) ✅

- [x] 1.1 `src/index.css`: add `chip-warn/success/info`, `--chart-up/down/neutral`, `focus-visible`, reduced-motion guards.
- [x] 1.2 `src/index.css`: resolve `theme-sawdust` cascade (`.theme-sawdust` before `.dark`). NOTE: `tailwind.config.ts` unchanged in PR A — safelist was not needed; cascade fix in `index.css` was sufficient.
- [x] 1.3 Vitest: `FeedbackState` `aria-live` + `LoadingState` `role="status"`/`aria-busy`.
- [x] 1.4 Create `src/shared/ui/feedback-state.tsx` with `ErrorState`, `EmptyState` (3 variants), `LoadingState`.
- [x] 1.5 Refactor `ErrorBoundary.tsx` to render `ErrorState`; keep retry/support. NOTE: `RouteErrorFallback.tsx` was NOT changed — it already inherits via `ErrorBoundaryFallback`.
- [x] 1.6 `PriceSparkline.tsx`: replace raw colors with `--chart-up/down/neutral`. Extracted `resolveSparklineColor()` pure function; added 5 assertion tests.
- [x] 1.7 `quotes.ts`: replace raw status colors with `chip-*` token classes. NOTE: `ActiveQuotesPanel.tsx` NOT changed — belongs to PR C (dashboard tables scope).
- [x] 1.8 `LandingHeader.tsx`/`LandingFooter.tsx`: swap Lucide `Zap` brand mark for Flaticon `fi-br-hammer`.
- [x] 1.9 Migrate error/loading states in `features/{quotes,inventory,recipes,clients,tasks}` (5 files) to shared wrappers. NOTE: `dashboard` NOT in PR A — dashboard is PR B/C scope.
- [x] 1.10 Create `verify-report.md` with honest evidence gap documentation.

## Phase 2: Headers & A11y (PR B) ✅ (complete)

- [x] 2.1 Create `src/shared/ui/page-header.tsx` with `PageHeader` (eyebrow/title/subtitle/actions), Sawdust type.
- [x] 2.2 Migrate top headers in `features/{dashboard,inventory,quotes,recipes,clients,tasks}` to `PageHeader`.
- [x] 2.3 Migrate `admin/components/{BillingPage,SupportPage,WorkshopsPage}.tsx` headers to `PageHeader`.
- [x] 2.4 `AppLayout.tsx`: add "Pronto" badge with `aria-describedby` to disabled topbar search.
- [x] 2.5 `AppLayout.tsx`: raise mobile icon-only controls to ≥44×44 CSS px with focus ring.
- [x] 2.6 Playwright: focus + reduced-motion guard tests for PageHeader pages. Created `tests/e2e/browser/visual-polish-a11y.spec.ts` with 3 assertion-based tests: (1) focus-ring sidebar NavLink receives visible outline via keyboard Tab; (2) PageHeader period buttons are keyboard-reachable and focusable; (3) `animate-pulse`/`animate-spin` suppressed under `prefers-reduced-motion: reduce` (test-element + stylesheet guard verification). 3/3 passing with `VITE_USE_LOCAL_MOCKS=true`. No hardcoded credentials. No admin pages tested (mock is not platform admin). No snapshot infrastructure used.
- [x] 2.7 Verify global `focus-visible` ring; suppress `animate-pulse`/landing demos under reduced motion. NOTE: `.focus-ring` utility and `@media (prefers-reduced-motion: reduce)` guard already exist from PR A. Added `focus-ring` class to interactive elements in AppLayout (desktop + mobile toggles, mobile nav links). CSS verification: reduced-motion guard suppresses `animate-pulse`/`animate-bounce`/`animate-spin` globally; landing transitions zeroed.

## Phase 3: Tables — App (PR C1) 🟢 (complete)

- [x] 3.1 Token-align padding/headers/hover in `src/shared/ui/table.tsx`. `TableHead` → Sawdust typography (`text-ink3`, `text-[11px]`, uppercase, tracking). `TableRow` → `border-line`, `hover:bg-cp-bg2/40`. `TableCell` → `text-ink2`, `px-4 py-3`. `TableHeader` → `border-line` separator.
- [x] 3.2 Migrate `features/quotes/components/**` data tables to `Table*`. `QuoteList.tsx`: replaced ad-hoc `<table>/<thead>/<tbody>/<tr>/<th>/<td>` with `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` imports and usage.
- [x] 3.3 Migrate `features/dashboard/components/**` data tables to `Table*`. `ActiveQuotesPanel.tsx`: replaced ad-hoc `<table>` markup with `Table*` components.
- [x] 3.4 Vitest + Testing Library for `Table*` and `PageHeader`. Created `src/shared/ui/table.test.tsx` — 7 component-contract tests (semantic HTML structure, all sections). `PageHeader` tests already exist (8 tests, pass).
- [ ] 3.5 Re-run Playwright snapshots for Dashboard + QuoteList (light + dark). **GAP**: Playwright snapshot infrastructure not yet set up. Noted in `verify-report.md` — deferred to per-PR visual regression phase.

## Phase 4: Tables — Admin (PR C2)

- [ ] 4.1 Migrate `BillingPage.tsx` to `Table*` + shared `EmptyState`/`ErrorState`.
- [ ] 4.2 Migrate `SupportPage.tsx` + `WorkshopsPage.tsx` to `Table*` + shared feedback states.
- [ ] 4.3 Re-run Playwright snapshots for admin BillingPage (light + dark); record in verify report.
- [ ] 4.4 Update `verify-report.md` with reduced-motion + chart/status contrast checks.

## Phase 5: Verification (per PR)

- [ ] 5.1 `npm test` + `npm run lint`; feedback/header/table tests green.
- [ ] 5.2 Playwright snapshots for Dashboard, QuoteList, BillingPage in light/dark per PR scope.
- [ ] 5.3 Manual WCAG contrast check across `sawdust`, `workshop`, `graphite` × light/dark.
