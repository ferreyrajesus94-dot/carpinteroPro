# Sync Report — production-stock-deduction-settings

## Status

**synced.** Delta specs merged into canonical OpenSpec specs. Change remains active; not archived.

## Executive Summary

The verified delta from `openspec/changes/production-stock-deduction-settings/specs/inventory/spec.md` was merged into `openspec/specs/inventory/spec.md`. Three domain sections were updated (Stock Movements table, Apply Stock Movement RPC, Deferred Scope) and one new domain section was added (Production-Start Stock Deduction with 9 requirements). The `verify-report.md` (PASS, blockers: none) served as the authoritative verification basis. Stale task checkboxes in `tasks.md` (174/174 unchecked) were not treated as sync blockers; they are reconciled by the verify report per the contract's documented exception.

## Domains Synced

| Domain | Canonical Spec | Delta Source | Change |
|--------|---------------|--------------|--------|
| Material Management | `openspec/specs/inventory/spec.md` | — | unchanged |
| Stock Movements | `openspec/specs/inventory/spec.md` | `specs/inventory/spec.md` MODIFIED | `production_deduction_id` column added to table spec; `consumo_produccion` enum value added; index `(workshop_id, production_deduction_id)` added |
| Approved BOM Snapshot | `openspec/specs/inventory/spec.md` | `specs/inventory/spec.md` ADDED (new domain) | New "Production-Start Stock Deduction" domain appended |
| Deferred Scope | `openspec/specs/inventory/spec.md` | `specs/inventory/spec.md` MODIFIED | Updated to reflect production-start semantics for `auto_stock_discount`; removed outdated "Settings wiring" out-of-scope statement |
| Quote Auto-Discount (removed) | — | `specs/inventory/spec.md` REMOVED | "Quote auto-discount scenario" in Apply Stock Movement RPC was replaced with "Approval does not invoke stock movement RPC" scenario |

## Canonical Files Updated

- `openspec/specs/inventory/spec.md` — 3 blocks MODIFIED, 1 new domain section ADDED, 1 scenario REPLACED. No REMOVED requirements (the REMOVED `Approval-Time Quote Auto-Discount` requirement was not present in the canonical spec; the canonical spec only had a scenario under the RPC, which was updated to the correct non-deduction behavior).

## Sync Verification

| Check | Result |
|-------|--------|
| Delta has no `## RENAMED Requirements` | ✅ No RENAMED block present |
| `verify-report.md` exists and is clean | ✅ Status: PASS, Blockers: None |
| Canonical spec exists at `openspec/specs/inventory/spec.md` | ✅ Present |
| No legacy flat spec in change folder | ✅ `specs/inventory/spec.md` uses domain structure |
| No destructive REMOVED blocks needing approval | ✅ No REMOVED requirements existed in the canonical spec; the only removed scenario was an outdated scenario under the RPC, replaced rather than deleted |
| No active same-domain collisions | ✅ Only one active change in workspace |
| Artifact store mode | `openspec` — filesystem sync performed, `sync-report.md` written |
| Engram persistence | Not applicable (`artifactStore: openspec`, not `engram`/`both`) |

## Verification Basis

The sync was performed against the authoritative post-verify status:

- `verify-report.md` exists with Status: **PASS**, "Blockers: None", stale-checkbox reconciliation documented.
- `apply-progress.md` (canonical index) + `apply-pr1-progress.md` through `apply-pr5-progress.md` all claim "completed and verified".
- `npm test` → 104 files / 790 tests passed
- `npm run lint` → 0 errors (6 pre-existing React Hook Form warnings)
- `npx tsc -b` → passed
- Supabase local: `supabase db reset --local` + `supabase db test --local` → all 3 migrations applied, 74 pgTAP tests passed
- `lens_diagnostics` not available in this environment (recorded as residual risk in verify report)

## Stale Checkbox Reconciliation (for archive)

`tasks.md` has 174 unchecked boxes. The verify report explicitly reconciles this with per-PR evidence. Sync proceeds without blocking on stale checkboxes per the contract's documented exception.

## Next Recommended

**`sdd-archive`** — sync is clean and complete. Archive readiness conditions are satisfied: verify-report is PASS, sync-report is now written, and the stale-checkbox exception is attested in the verify report. The change can be archived to `openspec/changes/archive/YYYY-MM-DD-production-stock-deduction-settings`.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Git tree is dirty on `main` with no per-PR commits/branches | MEDIUM | Documented in verify and sync reports; merge owner decides git strategy before PR |
| `lens_diagnostics` could not be run | LOW | Lint, tsc, Vitest, and Supabase pgTAP all passed |
| Manual smoke checks not executed | LOW | Covered by 790 automated tests and 74 pgTAP tests |
| No dedicated pgTAP tests for new RPCs | MEDIUM | RPC contracts covered by Vitest API mocks; pgTAP recommended before production data |

## Skill Resolution

- `skill_resolution`: `none` — no `## Skills to load before work` block was injected by the parent for this sync task; no project/user skills were needed for the filesystem sync operation.
