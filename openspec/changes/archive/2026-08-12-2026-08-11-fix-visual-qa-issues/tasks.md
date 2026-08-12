# Tasks: Fix Visual QA Issues (2026-08-11)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Changed lines | ~220 (PR A) + ~120 + tests (PR B) |
| 400-line risk | Medium (PR A) / Low (PR B) |
| Chained PRs | Yes — PR A → PR B |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Work Units

| # | Goal | PR | Test | Rollback |
|---|------|----|------|----------|
| 1 | 404 branded | A | `npm test src/app` | revert router + drop page |
| 2 | MaterialForm scroll | A | `npm test MaterialForm` | revert wrapper |
| 3 | ProductionBoard overflow | A | `npm test ProductionBoard` | revert board wrap |
| 4 | Dashboard table fit | A | `npm test Dashboard` | revert Dashboard wrap |
| 5 | Placeholder fix | B | `npm test MaterialForm` | revert placeholder |
| 6 | Drop Tendencia | B | `npm test MaterialList` | revert thead/tbody |
| 7 | Sin cliente label | B | `npm test QuoteList` | revert label branch |
| 8 | Dialog Esc overlay | B | `npm test dialog` | revert Escape handler |

## Phase 1: PR A — Critical Fixes

- [x] 1.1 **Branded 404** — `router.tsx`, `pages/NotFoundPage.tsx` + test; spec R1–3; RED: Spanish heading + "Volver al inicio"→`/dashboard` + title "404" + no dev copy; verify `visual-tour.mjs /no-such-page`; depends: —

- [x] 1.2 **MaterialForm scroll** — `MaterialForm.tsx`, `MaterialForm.test.tsx`; spec R1; RED body `overflow-y-auto` + footer reachable @ 900px + page `scrollTop` unchanged; wrap `max-h-[calc(90vh-X)] overflow-y-auto`; verify tour @ 900px /inventory; depends: —

- [x] 1.3 **ProductionBoard overflow** — `ProductionBoard.tsx`, `ProductionBoard.test.tsx`; spec R1+R2; RED wrapper `overflow-x-auto` + ancestor `min-w-0` + `documentElement.scrollWidth === clientWidth` w/ 1628px cols @ 1440px; verify tour @ 1440px + 1920px /production; depends: —

- [x] 1.4 **Dashboard table fit** — `Dashboard.tsx`, `Dashboard.test.tsx`; spec R1+R2; RED wrapper `overflow-x-auto` w/ `min-w-0` parent OR cells `truncate` w/ bounded widths, no `whitespace-nowrap` overflow; reuse `src/shared/ui/table.tsx`; verify tour @ 1440px /dashboard; depends: —

## Phase 2: PR B — Minor Fixes

- [x] 2.1 **Placeholder fix** — `MaterialForm.tsx` + test; spec R2; RED `placeholder === "Precio por pack"` no `…`; shorten or widen; verify tour @ 900px; depends: 1.2

- [x] 2.2 **Drop Tendencia** — `MaterialList.tsx`, `MaterialList.test.tsx`; spec R3; RED no `<TableHead>Tendencia</TableHead>` + no "—" trend cell; delete thead+tbody; verify tour /inventory; depends: —

- [x] 2.3 **Sin cliente label** — `QuoteList.tsx`, `QuoteList.test.tsx`; spec R1; RED null-client row → "Sin cliente" (muted); with-client → name; branch on `client`; verify tour /quotes; depends: —

- [x] 2.4 **Dialog Escape overlay** — `shared/ui/dialog.tsx`, `dialog.test.tsx`; smoke: MaterialForm, StockAdjustDialog, StockHistoryDialog, ClientDialog, QuoteForm, StartProductionDialog; spec R4; RED fire Escape → overlay removed + `pointer-events` restored; verify tour open/esc every modal; depends: —

## Phase 3: Verification

- [x] 3.1 **Visual-tour gate** — `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build` all green; `node /tmp/opencode/visual-tour.mjs` → `issues: []`; archive PNGs `/tmp/opencode/visual-tour/2026-08-11-after/`; depends: 1.1–2.4
