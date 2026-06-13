# SDD-10 Admin Actions — Design

## Work units

| WU | Name | Files | Est. lines | Depends |
|----|------|-------|:----------:|---------|
| WU1 | Cancel subscription + refresh button | 3–4 | 120–180 | SDD9 |
| WU2 | Toggle subscription status | 3–4 | 130–200 | WU1 |
| WU3 | Retry webhook from support | 3–4 | 100–160 | SDD9 |
| WU4 | Workshop deactivate/activate | 4–5 | 180–280 | SDD9 |
| WU5 | Force profile onboarding | 3–4 | 100–160 | WU4 |
| WU6 | Maintenance mode | 5–6 | 200–300 | SDD9 |
| WU7 | Integration polish + E2E | 2–3 | 80–120 | All |

## PR sequence

```text
PR1 WU1+WU6 (quick wins: cancel + refresh + maintenance)
PR2 WU2+WU3 (billing: toggle status + retry webhook)
PR3 WU4+WU5 (workshops: deactivate + force onboarding)
PR4 WU7 (E2E + polish)
```

## Commit plan

Each WU = one commit with TDD evidence (RED test first, GREEN implementation, REFACTOR if needed).

## Review workload

| PR | WUs | Est. lines | Budget risk |
|----|-----|:----------:|-------------|
| PR1 | WU1 + WU6 | 320–480 | Medium |
| PR2 | WU2 + WU3 | 230–360 | Low |
| PR3 | WU4 + WU5 | 280–440 | Medium |
| PR4 | WU7 | 80–120 | Low |

## Rollback plan

Per WU:
- WU1: Remove cancel button, refresh button from UI. Edge function stays.
- WU2: Remove toggle button. Remove Edge Function.
- WU3: Remove retry button. Remove Edge Function.
- WU4: Remove toggle. `is_active` column stays (default true, no impact).
- WU5: Remove button. Remove Edge Function.
- WU6: Remove banner, hook. Drop `platform_settings` table.
- WU7: Remove E2E test file.

## Migration safety

- `workshops.is_active` — nullable=false, default=true. Existing rows stay active.
- `platform_settings` — new table with RLS, only accessed via admin Edge Functions with service_role.
- No destructive schema changes.
