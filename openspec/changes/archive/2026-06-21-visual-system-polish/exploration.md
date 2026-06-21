# Exploration — visual-system-polish

## Current State

CarpinteroPro has a strong redesign foundation in place ("Sawdust" default
palette, 3 palettes × 2 modes × 2 densities via CSS variables) but ships with
several visual inconsistencies that erode the production polish. The token
system itself is healthy; the leakage is at the seam between
`src/shared/ui/*` (shadcn / legacy HSL tokens) and feature code (mostly
migrated to OKLCH `bg-cp-*`, `text-ink*`, `border-line*`).

### Design system inventory (what exists)

- `src/index.css` — OKLCH tokens (`--bg`, `--surface`, `--ink`, `--line`,
  `--cp-accent`, `--cp-warn`, `--cp-danger`, etc.), 3 palettes (`sawdust`
  default, `workshop`, `graphite`), 2 themes (light/dark), 2 densities, status
  chip classes (`.chip-presupuesto` etc.) with dark variants, and
  `.font-display` / `.font-mono` utilities. Includes `h-screen → 100dvh`
  override for iOS Safari and `env(safe-area-inset-bottom)`-aware layout in
  the app shell.
- `tailwind.config.ts` — HSL bridge to the legacy shadcn tokens (`bg-card`,
  `text-muted-foreground`, `border-input`, etc.); safelist of
  `theme-{name}`/`dense` class names.
- Typography: `Inter` (sans), `Space Grotesk` (display), `JetBrains Mono` (mono).
- Icons: two systems coexist — Flaticon UI Icons (`fi fi-rr-*` classes) and
  Lucide React (`<Plus/>`, `<Pencil/>`, etc.).

### Visual surface

- Global shell (`src/app/layouts/AppLayout.tsx`): sidebar ≥1024, bottom tabs
  mobile, FAB per nav item, theme toggle, brand mark
  (`fi-br-hammer` + "CarpinteroPro").
- Landing (`src/features/landing/`): 12+ marketing sections, custom CSS
  for hero particles / animated bars in
  `landing-visual-demos.css`. Uses `Zap` lucide for the logo and
  `fi-br-hammer` for app-side brand.
- Auth (`LoginPage`): tabs for login/register, password strength meter,
  Google OAuth (currently disabled), registration "check email" success state.
- Dashboard (`features/dashboard/`): period selector, hero KPI, 4-up KPI
  grid, pipeline snapshot, shortcuts, "requires attention" panel, revenue
  chart, active quotes panel.
- Lists with stat strip + filters + table-or-card responsive split:
  `MaterialList` (516 lines), `QuoteList` (436, has Lista + Pipeline DnD
  views), `MuebleList` (341, grid of cards), `TaskList` (251, tabs +
  category chips), `ClientList` (262, card grid).
- Admin (`features/admin/`): `AdminLayout` (sidebar), Overview with
  webhook-failures banner, Workshops / Billing / Support / Referidos /
  Payouts tables. Many ad-hoc raw colors (`bg-amber-50`, `bg-emerald-50`,
  `bg-red-50`) outside the token system.
- Billing surfaces: `BillingGate` (loader + blocked state),
  `BillingBlockedScreen` (Card with status, action, support links),
  `BillingSettingsCard` (settings slot).
- Onboarding wizard: 3 steps (workshop / materials / done) with stepper
  header and seed-material multiselect.
- Generic states: `EmptyState` (icon + title + description + action),
  `Skeleton` (single primitive), section-level inline error/empty in each
  feature.
- Error recovery: `ErrorBoundary` (legacy token card with
  `border-red-200 bg-white text-red-700`, hardcoded slate-900 button) and
  `RouteErrorFallback` (re-uses the same fallback for route errors).
- Maintenance banner: amber-50 strip with dismiss.
- Offline banner: yellow-500 strip.
- Profile page: avatar + workshop/email/ID rows, sign-out button.
- Pricing: monthly via MercadoPago with `trialing` → `active` →
  `past_due`/`unpaid`/`cancelled` states.

## Affected Areas

### Token / primitive inconsistencies (the "two systems" problem)

- `src/shared/ui/card.tsx` — shadcn `Card` uses `rounded-lg border bg-card
  text-card-foreground shadow-sm` (HSL). Used by `BillingSettingsCard`,
  `WorkshopSettings`, `ProfilePage`, `LoginPage`.
- `src/features/dashboard/components/Dashboard.tsx`,
  `MaterialList`, `QuoteList`, `MuebleList`, `ClientList`, `TaskList`,
  `ActiveQuotesPanel` — hand-rolled `rounded-xl border border-line
  bg-surface` divs using the redesign tokens.
  → Mixed cards on the same page (Settings shows both styles).
- `src/shared/ui/dialog.tsx` — shadcn `Dialog` (uses `bg-background`,
  OK through HSL bridge) is used for confirm dialogs and forms; works
  but visual language differs from the redesign cards.
- `src/features/dashboard/components/ActiveQuotesPanel.tsx` — only
  Dashboard component still on legacy tokens (`bg-card`,
  `text-muted-foreground`, `hover:bg-muted/30`).
- `src/shared/types/quotes.ts:15-22` — `QUOTE_STATUS_COLORS` uses hard
  raw Tailwind palette (`bg-gray-100 text-gray-700`, `bg-emerald-100
  text-emerald-700`, etc.) that does NOT respect the chosen palette
  and has no dark variant. The `chip-*` classes in `index.css:170-182`
  already provide palette/dark-aware versions.
- `src/features/landing/components/LandingHeader.tsx:43` — uses Lucide
  `Zap` for the brand mark; the app uses `fi-br-hammer` (Flaticon).
  Inconsistent brand icon between marketing site and authenticated app.
- `src/features/quotes/components/QuoteList.tsx:306-357`,
  `src/features/admin/components/BillingPage.tsx:184-223`,
  `SupportPage.tsx:131-223`, `WorkshopsPage.tsx:181-290`,
  `src/features/dashboard/components/ActiveQuotesPanel.tsx:53-83` —
  hand-rolled `<table>` markup with slightly different padding,
  header treatment, and hover states (vs. the shadcn `Table*`
  primitives used in `MaterialList`).

### Errors, empty, loading, and disabled states

- `src/shared/components/ErrorBoundary.tsx:63-90` — fallback card uses
  raw `border-red-200 bg-white text-red-700`, slate-900 button,
  slate-300 outline button. Bypasses the redesign tokens entirely.
- `src/shared/components/RouteErrorFallback.tsx` — wraps
  `ErrorBoundaryFallback`, so router-level errors look like boundary
  errors but with no `aria-live` region.
- Per-feature error fallback (e.g. `MaterialList.tsx:156-162`,
  `QuoteList.tsx:159-165`, `ClientList.tsx:85-91`, `TaskList.tsx:136-142`,
  `MuebleList.tsx:104-112`) — same copy, plain `<p>` with
  `text-destructive`, no icon, no card, no retry CTA.
- "Sin resultados" inline messages are inconsistent: "Sin resultados en
  este estado." (QuoteList:260), "Sin resultados para "X"." (ClientList:222),
  "Sin resultados." (MuebleList:167), and a "No hay tareas para este
  filtro." (TaskList:236) — three copy variants, no icon.
- "No hay presupuestos activos" in `ActiveQuotesPanel:30` is plain
  text, no `EmptyState` treatment.
- `src/features/dashboard/components/Dashboard.tsx:55-63` — KPI
  loading is `<div className="h-20 animate-pulse rounded-xl
  bg-muted" />` × 4 (no role, no aria-label).
- `src/features/billing/components/BillingGate.tsx:62-70` and
  `AppLayout.tsx:42-49` — both show a 6×6 spinning circle with
  `aria-label`, no `aria-busy` and no skeleton.
- The "Pronto"/coming-soon disabled topbar search (`AppLayout.tsx:325-333`)
  looks identical to enabled fields except the cursor and `disabled` attr;
  no "Pronto" badge or tooltip explaining why it's disabled.
- Theme toggle in landing mobile header (`LandingHeader.tsx:139-145`)
  is `h-9 w-9` (36px), below the recommended 44px touch target.

### Page header / hierarchy inconsistencies

Five different page-header patterns in active use:

1. Dashboard (`Dashboard.tsx:70-88`) — period selector on the right.
2. MaterialList parent `InventoryRoutes.tsx:38-44` — `font-display
   text-2xl` + plain Button.
3. QuoteList (`QuoteList.tsx:193-201`) — `text-2xl font-bold` (no
   `font-display`).
4. RecipesPage / RecipesRoutes — `text-2xl font-bold` + subtitle
   paragraph.
5. ClientList (`ClientList.tsx:107-127`), TaskList, WorkshopSettings —
   eyebrow label (`font-mono text-[11px] uppercase tracking-[0.1em]
   text-ink3`) + `font-display text-2xl md:text-[32px]` + subtitle.
6. ProfilePage, LoginPage — `text-2xl font-bold tracking-tight
   text-foreground` (no `font-display`).

### Hardcoded values that should reference tokens

- `src/features/inventory/components/MaterialList.tsx:425, 481` —
  `style={{ background: 'oklch(94% 0.06 70)', color: 'oklch(40% 0.14 40)' }}`
  for the inline "Stock bajo" badge — should use `.chip-warn` or a
  shared `<StatusBadge variant="warn">` component.
- `src/features/recipes/components/MuebleList.tsx:192` — typo
  `hover:border-line-2` (should be `hover:border-line2`).
- `src/features/recipes/components/MuebleList.tsx:208` —
  `bg-destructive text-white` for the stock-shortage badge (raw
  destructive color, not palette-aware).
- `src/shared/ui/PriceSparkline.tsx:28-30` — raw hex
  `#dc2626` / `#16a34a` / `#6b7280` (should use `var(--cp-danger)` /
  `var(--cp-success)` / a chart neutral token).
- `src/features/admin/components/OverviewPage.tsx:52-53`,
  `SupportPage.tsx:69-72`, `BillingPage.tsx:91-94`, `PayoutsTab.tsx` —
  `bg-amber-50`, `bg-emerald-50`, `bg-red-50`, `bg-amber-100` raw
  Tailwind colors.
- `tailwind.config.ts:11` — `theme-sawdust` is in the safelist but
  `index.css` has no `.theme-sawdust { ... }` block; the default values
  come from `:root`, so the class is technically inert. Either remove
  from safelist or add the block (recommended: keep the entry and add
  the block for explicitness).

### Accessibility / focus gaps

- `Button` (`shared/ui/button.tsx:8`) has `focus-visible:ring-2
  focus-visible:ring-ring focus-visible:ring-offset-2` ✅.
- `Input` (`shared/ui/input.tsx:11`) has the same focus-visible
  treatment ✅.
- `<a>` and `<Link>` elements: rely on default browser focus only;
  no `focus-visible:ring` or `focus-visible:underline` in Tailwind base.
- Icon-only buttons throughout (e.g. theme toggle, sidebar
  NavLinks in `AppLayout.tsx:225-258`, dashboard shortcut cards
  `Dashboard.tsx:183-196`) have `aria-label` but no `focus-visible`
  ring style override; they inherit only the hover bg color.
- `SectionHowto` toggle button (`section-howto.tsx:22-31`) has no
  focus ring.
- `EmptyState` does not include `role="status"` or live region for
  dynamic empty-state transitions.
- The `bg-cp-accent text-white` chips on filter rows (MaterialList
  `bg-cp-accent text-white` at :354, QuoteList `:250`) use hardcoded
  `text-white` instead of the palette-aware `--cp-accent-ink`.

## Approaches

### 1. Single polish package (≤400-line review budget)

- Touch only the highest-impact, narrow files:
  - Add `.theme-sawdust { ... :root copy ... }` block to `index.css`
    for safelist consistency.
  - Replace `QUOTE_STATUS_COLORS` raw classes with the existing
    `chip-*` classes (delete the constant or repoint its consumers).
  - Replace `PriceSparkline` raw hex with `var(--cp-danger)` /
    `var(--cp-success)` / a new `--chart-neutral` token.
  - Rewire `ActiveQuotesPanel` to redesign tokens.
  - Replace the `ErrorBoundaryFallback` card with redesign tokens
    (sawdust destructive surface, `text-[var(--cp-danger)]`).
  - Fix the `MuebleList` typo and the inline OKLCH badge in
    `MaterialList`.
- Pros: one PR, < 400 changed lines, immediate visible quality bump.
- Cons: does not address page-header inconsistency, mixed card
  styles, table primitive, empty-state copy, or icon-system
  consolidation.
- Effort: **Low** (≤ 1 day, single PR, no breaking changes).

### 2. Two chained PRs (recommended)

**PR A — Tokens & states (≤ 400 lines)**
- `index.css`: add `.theme-sawdust` block; add `.chip-warn` /
  `.chip-success` / `.chip-info` consistent with the existing
  pipeline chips; chart tokens (`--chart-up`, `--chart-down`,
  `--chart-neutral`).
- `shared/types/quotes.ts`: deprecate `QUOTE_STATUS_COLORS` or
  re-point to the new `chip-*` classes; update consumers.
- `shared/ui/PriceSparkline.tsx`, `shared/components/ErrorBoundary.tsx`,
  `features/dashboard/components/ActiveQuotesPanel.tsx`,
  `features/inventory/components/MaterialList.tsx:425,481` (badge
  style), `features/recipes/components/MuebleList.tsx:192,208` (typo
  + badge): swap raw values for tokens.
- Add one new shared component:
  `shared/ui/feedback-state.tsx` exposing `<EmptyState variant="no-results">`,
  `<ErrorState>`, and `<LoadingState>` wrappers, all using
  `EmptyState`'s icon container + title/description/action contract.
- Refactor per-feature error copy blocks (`MaterialList`,
  `QuoteList`, `ClientList`, `TaskList`, `MuebleList`,
  `ActiveQuotesPanel`) to use `<ErrorState>`.
- Add a `prefers-reduced-motion` global guard (currently absent
  for the `animate-pulse` and the landing CSS animations).
- Add a `text-ink` / `bg-cp-bg` `focus-visible:ring-2 focus-visible:ring-cp-accent`
  utility to `index.css` so `<a>` and `<Link>` get consistent focus
  treatment.
- Add `aria-busy="true"` on the billing/initialization spinners.

**PR B — Page header, table primitive, icon audit (≤ 400 lines)**
- Extract `shared/ui/page-header.tsx` with optional eyebrow label,
  title, subtitle, actions slot; refactor 6 call sites to use it.
- Promote `shared/ui/table.tsx` as the single data-table primitive
  and migrate the admin `BillingPage`, `WorkshopsPage`,
  `SupportPage`, `ActiveQuotesPanel`, `QuoteList` table block to it.
- Document the `Card` story: either update the shadcn `Card` to
  use the redesign tokens (so `BillingSettingsCard`,
  `WorkshopSettings`, `ProfilePage` match the rest of the app) or
  add a thin `<Surface>` wrapper used by the hand-rolled
  `rounded-xl border border-line bg-surface` blocks.
- Document the icon system decision: keep both for now but
  settle on Lucide for **interactive controls** (the ones inside
  dialogs, list rows, and forms) and Flaticon for **navigation
  and brand**. Brand mark in landing switches to `fi-br-hammer`
  to match the app.
- Replace the disabled topbar search with a "Pronto · ⌘K" badge
  to set the right expectation.
- Bump landing theme toggle to `h-11 w-11` (44px) to match the
  mobile menu button.

- Pros: two reviewable PRs, each ≤ 400 lines, each ships a coherent
  improvement, allows TDD on the new primitives.
- Cons: requires a follow-up to fully unify tables, requires the
  icon system decision to be made upfront.
- Effort: **Medium** (2–3 days total, both PRs run through
  sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify).

### 3. Big bang (NOT recommended)

Single PR that does everything (token refresh + page header +
table primitive + icon consolidation + accessibility pass +
admin rebrand). Exceeds the 400-line review budget and risks
regression because of how many files are touched across features
and admin.

- Pros: consistent in one shot.
- Cons: review burnout, hard to roll back partial progress, lots
  of files outside the typical SDD slice.
- Effort: **High**, very high PR risk.

## Recommendation

**Approach 2 (two chained PRs)**, scoped as:

- **PR A: tokens + feedback states** — small, high-impact, easy to
  review, can ship within the 400-line budget. It also removes the
  two most visible inconsistencies (raw `border-red-200` error card
  and the legacy `bg-card` Dashboard panel) without changing the
  information architecture.
- **PR B: page header + table primitive + icon decision + a11y pass**
  — gated on PR A's components so reviewers can see the contract
  before mass migration. Also ≤ 400 lines because most of the
  work is moving existing markup into the new primitives (not new
  logic).

The icon-system decision should be settled up-front (recommendation:
keep both, but document the boundary) and the brand mark swap
(`Zap` → `fi-br-hammer` in landing) should land in PR A as a quick
visual win.

## Risks

- **Visual regression risk on dark mode** when swapping
  `QUOTE_STATUS_COLORS` for `chip-*` classes — the new chips have
  oklch-tuned dark variants; need a Playwright visual smoke test
  in `*.test.tsx` for at least `Dashboard`, `QuoteList`, and
  `Admin/BillingPage` in both light and dark before merge.
- **RevenueChart / PriceSparkline regressions** when the
  `--chart-up` / `--chart-down` tokens are introduced — these are
  embedded SVG/Recharts strokes, not className-controlled, so
  validation requires manual screenshot review.
- **Color contrast in the "stock bajo" badge** when migrating
  from the inline OKLCH pair to a token-based chip — verify with
  a tool like `axe` or manual WCAG check (4.5:1 for normal text).
- **Icon system boundary** is a behavior decision, not just a
  visual one: Flaticon classes can't be sized/styled with
  `lucide-react`-style props, so component code that needs
  per-instance sizing (e.g. `h-4 w-4`) needs Lucide. Document
  this clearly so contributors don't reach for Flaticon inside
  `shared/ui/*`.
- **Landing CSS scope** (`landing-visual-demos.css`) is `.landing-page`
  scoped, so the icon decision does not break landing animations,
  but PR A must not remove `--cp-accent` references from that
  file.
- **TypeScript & ESLint regressions** on the `QUOTE_STATUS_COLORS`
  refactor: `Record<QuoteStatus, string>` stays valid whether
  the value is a class or an `oklch(...)` style, but consumers
  that read the value at runtime (e.g. `cn(QUOTE_STATUS_COLORS[s])`
  vs `<span className={QUOTE_STATUS_COLORS[s]}>`) need to be
  checked. No typed `TailwindClassString` exists in the project,
  so a runtime smoke test is the only safety net.
- **`theme-sawdust` block** (recommendation to add to `index.css`):
  the `:root` values are the sawdust values, so duplicating them
  into `.theme-sawdust` doubles the maintenance cost. Safer
  alternative: define the sawdust variables on `:root.theme-sawdust`
  in a single block, then leave the plain `:root` as a fallback.
  Document this in the design decision so the safelist entry
  becomes meaningful.

## Ready for Proposal

**Yes.** The user asked for a comprehensive visual polish pass, and
the exploration surfaces enough concrete, file-level changes to
write a tight `proposal.md` with scope, acceptance criteria, and
the token/primitive contracts that PR A needs.

Recommended next steps for the orchestrator:

1. Ask the user to confirm the **icon system boundary** decision
   (keep both, document boundary) and the **brand mark** decision
   (switch landing `Zap` to `fi-br-hammer` to match the app).
2. Confirm the two-PR split (A: tokens + states; B: header +
   table + a11y) vs. a single bigger PR — recommend chained.
3. Once confirmed, run `sdd-propose` for `visual-system-polish`
   with the Affected Areas as the basis of scope.
