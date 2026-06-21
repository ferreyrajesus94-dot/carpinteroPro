# Proposal: Visual System Polish

## Intent

Raise CarpinteroPro's production visual quality by making generic states, color roles, hierarchy, and primitives coherent across landing, app, and admin surfaces without changing workflows.

## Goals
- Token-aligned error, loading, no-results, empty, and unavailable states.
- Consistent hierarchy, tables, focus states, and status chips.
- Clear icon boundary: Flaticon for navigation/brand identity; Lucide for interactive controls and generic UI actions.

## Scope

### First Slice — PR A
- Normalize tokens, chips, chart colors, focus utilities, reduced-motion guard.
- Add feedback-state wrappers; migrate high-impact error/empty/loading states.
- Replace raw colors in ErrorBoundary, quote chips, PriceSparkline. NOTE: ActiveQuotesPanel chip colors are PR C (dashboard tables) scope; stock badges are deferred from PR A.
- Switch low-risk landing brand marks from generic Zap to workshop-aligned hammer.

### Later Slice — PR B
- Add PageHeader primitive; refactor main page headers.
- Standardize table primitive usage in quote/dashboard/admin tables.
- Clarify Card/Surface usage and disabled search affordance.

### Out of Scope
- Product flows, database/API changes, full landing redesign, single icon-system migration.

## Capabilities

### New Capabilities
- `visual-system-polish`: Token, feedback-state, hierarchy, icon-boundary, and accessibility contracts for production UI polish.

### Modified Capabilities
- `observability-support`: ErrorBoundary/route fallback visuals align with shared feedback states while preserving reporting/recovery.

## Approach

Use existing Sawdust tokens and shared UI primitives. Prefer extraction over per-feature restyling. Keep chained PRs under 400 changed lines.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/index.css` | Modified | Token, chip, focus, motion consistency |
| `src/shared/ui/*`, `src/shared/components/*` | New/Modified | Feedback, header/table/Card contracts |
| `src/features/*` | Modified | State, table, header, brand polish |

## Acceptance Criteria
- [ ] Feedback states use shared accessible patterns and tokenized colors.
- [ ] No new raw Tailwind palette/hex/inline OKLCH values for status UI.
- [ ] Landing/app brand marks use workshop identity; Lucide remains for controls/actions.
- [ ] PR A and PR B each forecast ≤400 changed lines or split further.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dark-mode chip regression | Med | Test light/dark states |
| Chart/status contrast drift | Med | Manual WCAG/screenshot check |
| Scope creep across UI | High | Enforce PR A/B boundary |

## Rollback Plan

Revert each PR independently. PR A is token/state swaps; PR B is primitive adoption. No data migration.

## Dependencies
- Exploration artifact `sdd/visual-system-polish/explore`.
- Existing Sawdust token system and shared UI primitives.

## PR Slicing Forecast
- PR A: design tokens + feedback states — Medium 400-line risk.
- PR B: page headers + table primitive + accessibility polish — Medium/High 400-line risk; split if forecast grows.
