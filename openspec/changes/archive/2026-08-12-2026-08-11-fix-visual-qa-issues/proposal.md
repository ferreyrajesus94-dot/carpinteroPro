# Proposal: Fix Visual QA Issues (2026-08-11)

## Intent

A Playwright tour of `https://carpintero-pro.vercel.app` (14 pages + 404, using the demo workshop admin account) surfaced 8 user-visible defects: 4 critical (dev-leaking 404 page, submit button clipped below the material modal fold, two horizontal-overflow layouts clipping columns at 1440px) and 4 minor (truncated placeholder, empty "Tendencia" column, em-dash for missing client, modal overlay that persists after Escape). These break first-impression core flows (submit material, view production board, see quote status) without changing product behavior. Evidence: `/tmp/opencode/visual-tour/_report.json` + 15 PNGs.

## Scope

### First Slice — PR A (critical 4)
- Branded Spanish 404: add `path: "*"` catch-all in `src/app/router.tsx` + `NotFoundPage` (Sawdust tokens, back-to-dashboard).
- `MaterialForm`: cap dialog height + pin submit footer inside 900px viewport.
- `ProductionBoard`: replace fixed `min-w-[260px]` with horizontally-scrollable columns; "Listo" never clipped.
- Dashboard `RecentQuotesTable`: `Table*` primitive with constrained widths, or wrap in `overflow-x-auto`.

### Later Slice — PR B (minor 4)
- `MaterialForm`: shorten "Precio por pack" placeholder or widen the field.
- `InventoryTable`: drop "Tendencia" column until a trend signal exists.
- `QuoteList`: render `Sin cliente` instead of `—` when client missing.
- Modal overlay: Escape unmounts the `fixed inset-0 z-50 bg-black/80` overlay alongside the dialog.

### Out of Scope
- Production board data bug (`actual_start_date`/`actual_end_date` NULL) — separate fix.
- New features, landing/admin redesign, billing, work shipped under `2026-06-21-visual-system-polish`.

## Capabilities

### New Capabilities
- `routing-not-found`: branded 404 page contract (Spanish, Sawdust tokens, back-to-dashboard).

### Modified Capabilities
- `inventory`: MaterialForm scroll + placeholder, "Tendencia" column, dialog Escape.
- `production-orders`: ProductionBoard column overflow.
- `dashboard`: recent-quotes table overflow.
- `quotes`: missing-client label.

## Approach

Localize each fix to its owning feature module. Reuse `Table*`, `EmptyState`, `Dialog` primitives from `visual-system-polish` — no new shared contracts. One Vitest regression per fix (strict TDD). Verification gate: re-run `/tmp/opencode/visual-tour.mjs` on the Vercel preview; assert `issues: []`.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/app/router.tsx` | Modified — `path: "*"` catch-all |
| `src/app/pages/NotFoundPage.tsx` (new) | New — branded 404 |
| `src/features/inventory/components/MaterialForm.tsx` | Modified — modal scroll, placeholder |
| `src/features/inventory/components/InventoryTable.tsx` | Modified — drop "Tendencia" |
| `src/features/production/components/ProductionBoard.tsx` | Modified — kanban overflow |
| `src/features/dashboard/components/Dashboard.tsx` | Modified — recent quotes table |
| `src/features/quotes/components/QuoteList.tsx` | Modified — "Sin cliente" |
| `src/shared/ui/dialog/*` or feature dialog | Modified — Escape tears down overlay |

## Acceptance Criteria

- [ ] `visual-tour.mjs` reports `issues: []` on the deployed preview.
- [ ] No `consoleErrors` for the React Router default 404 path.
- [ ] Each fix has a Vitest regression test (red → green).
- [ ] `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build` green.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Catch-all 404 swallows admin/legal routes | Med | Place `path: "*"` only at top-level, after named routes |
| Kanban horizontal scroll hides column on touch | Low | Verify on mobile viewport in tour rerun |
| Dialog Escape change regresses other modals | Med | Cross-feature smoke: open every modal, Escape, re-click |

## Rollback Plan

Revert PR A or PR B independently. No data migration, no RLS, no schema change.

## Dependencies

- `visual-system-polish` primitives + Sawdust tokens.
- Playwright Chromium at `/home/elias/.cache/ms-playwright/chromium-1234/`.
- Verification script: `/tmp/opencode/visual-tour.mjs`.

## PR Slicing Forecast

- PR A (critical 4): router + MaterialForm + ProductionBoard + Dashboard table — Medium 400-line risk.
- PR B (minor 4): placeholder, "Tendencia", "Sin cliente", dialog Escape — Low 400-line risk.
- `Decision needed before apply: No`. `Chained PRs recommended: Yes`. `400-line budget risk: Low` overall; Medium on PR A only.
