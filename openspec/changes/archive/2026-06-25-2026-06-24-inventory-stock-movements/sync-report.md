# Sync Report — 2026-06-24-inventory-stock-movements

## Status

synced

## Domains Synced

- `inventory` (new canonical spec created)

## Canonical Files Updated

- `openspec/specs/inventory/spec.md` — **created** (new domain spec; no prior canonical spec existed)

## Requirements Merged

### ADDED Requirements (new canonical spec established)

**Stock Movements domain:**

- `Materials Table` — material management with workshop-scoped RLS and stock/price support.
- `Per-material Price History` — workshop-scoped price history via RLS.
- `Stock Movements Table` — immutable audit rows with `delta`, `reason`, `note`, `quote_id`, `created_at`, `created_by`, tenant-scoped RLS, and indexes.
- `Apply Stock Movement RPC` — atomic mutation with `created_by = auth.uid()`, cross-workshop denial, and negative-stock blocking.
- `Per-material Stock History Dialog` — existing per-material workflow preserved.
- `Workshop-wide Stock Movement Ledger` — `/inventory/movements` page with material/delta/reason/note/quote/creator columns and Spanish UI.
- `Server-side Filtering and Bounded Retrieval` — `get_stock_movement_ledger` RPC with clamped limit/offset and workshop derivation from `auth.uid() → profiles.workshop_id`.
- `CSV Export for Filtered Ledger Results` — browser-generated CSV from RPC results, tenant-scoped, capped at 500 rows.
- `Query-Key Cache Privacy` — ledger and per-material movement query keys are non-persistable.
- `Inventory Public API Exports` — `useStockMovements`, `useApplyStockMovement`, `useStockMovementLedger`, `applyStockMovement`, `fetchStockMovements`, `fetchStockMovementLedger` exposed through `src/features/inventory/index.ts`.
- `Deferred Scope` — reversals, dashboard widgets, and settings-toggle wiring explicitly excluded.

**No MODIFIED or REMOVED requirements** — this was a net-new feature domain.

## Active Same-Domain Collisions

None. No other active change touches the `inventory` or `stock_movements` domain.

## Destructive Sync Approvals / Blockers

None. No destructive operations were performed. The change adds new RPCs, a new UI page, new types, new tests, and new canonical specs without removing existing behavior.

## Validation Commands Performed

- `npm test` → 703 tests pass (96 files)
- `npx tsc --noEmit` → clean
- `npm run lint` → 0 errors (6 pre-existing warnings in unrelated files)
- `npx supabase test db` → 5 files, 68 tests PASS
- Manual Playwright browser verification: `/inventory/movements` renders, filters work, movement rows appear with creator attribution, CSV export wired
- All `tasks.md` tasks checked off
- `verify-report.md` status: PASS

## Structured Status and `actionContext` Findings

| Field | Value |
| --- | --- |
| artifactStore | openspec |
| mode | repo-local |
| workspaceRoot | /home/elias/Proyectos/carpinteroPro |
| allowedEditRoots | [/home/elias/Proyectos/carpinteroPro] |
| collisions | none |
| legacyFlatSpec | `openspec/changes/2026-06-24-inventory-stock-movements/spec.md` — replaced by canonical spec at `openspec/specs/inventory/spec.md` |
| blockedReasons | none |

## Discovery: Canonical Spec Location Decision

No prior `openspec/specs/inventory/spec.md` existed. The existing canonical specs use the `sdd-N-` prefix convention (e.g., `sdd-2-billing-mercadopago`, `sdd-3-auth-profile-hardening`) for change-specific specs. For the inventory domain, a plain `inventory/` directory was chosen because:

1. It mirrors the `src/features/inventory/` feature slice name.
2. Domain specs (as opposed to SDD-change-specific specs) are conventionally named by domain, not by SDD number.
3. The flat change spec at `openspec/changes/{change}/spec.md` remains archived with the change artifact.
4. Future inventory requirements (e.g., reversal workflows, stock alerts) will be added as MODIFIED/ADDED deltas to `openspec/specs/inventory/spec.md`.

## Next Recommended Phase

**sdd-archive** — all phases complete: clean verify, completed sync (canonical spec established), zero unchecked implementation tasks. Archive target:

```
openspec/changes/archive/2026-06-25-2026-06-24-inventory-stock-movements
```
