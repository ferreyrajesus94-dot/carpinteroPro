# SDD-10 Admin Actions — Tasks

## Review workload forecast

| Field | Value |
|---|---|
| Estimated changed lines | 830–1,400 full scope |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 WU1+WU6 → PR2 WU2+WU3 → PR3 WU4+WU5 → PR4 WU7 |

---

## WU1 — Cancel subscription + Refresh button

**Goal:** Cancel button in BillingPage with confirmation dialog. Refresh button in AdminLayout header.

**Forecast:** 3–4 files, 120–180 lines.

**Dependencies:** SDD9.

### Task 1.1 — Extend cancel-subscription Edge Function

- [x] Add `requirePlatformAdmin(req)` to existing `cancel-subscription/index.ts`.
- [x] Ensure 401/403/200 responses follow admin auth contract.

### Task 1.2 — Add cancel mutation hook

- [x] Add `useCancelSubscription()` to admin hooks.
- [x] Invokes `cancel-subscription` Edge Function.
- [x] Invalidates subscription queries on success.
- [x] Toast on success/error.

### Task 1.3 — Add cancel button to BillingPage

- [x] Add "Cancelar" button per row (only if status !== cancelled).
- [x] Use shared `ConfirmDialog`.
- [x] Show toast on result.

### Task 1.4 — Add refresh button to AdminLayout

- [x] Add "Actualizar" button in header.
- [x] Calls `queryClient.invalidateQueries()` for all admin keys.

### Task 1.5 — Validate WU1

- [x] Tests: cancel button renders, confirmation flow, toast, refresh invalidates.
- [x] npm test, npm run lint, npx tsc -b.

---

## WU6 — Maintenance mode

**Goal:** Platform owner can toggle maintenance mode. Banner shown to normal users.

**Forecast:** 5–6 files, 200–300 lines.

### Task 6.1 — Create migration for platform_settings

- [x] Migration: `platform_settings` table with RLS.
- [x] Seed `maintenance` key with default disabled.

### Task 6.2 — Create admin-toggle-maintenance Edge Function

- [x] `supabase/functions/admin-toggle-maintenance/index.ts`.
- [x] requirePlatformAdmin guard.
- [x] Read/write `platform_settings.maintenance`.

### Task 6.3 — Add useMaintenanceMode hook

- [x] `src/shared/hooks/useMaintenanceMode.ts`.
- [x] Reads maintenance flag from new Edge Function or platform_settings via anon query (RLS-restricted).
- [x] Returns `{ enabled, message }`.

### Task 6.4 — Add maintenance banner to AppLayout

- [x] Show dismissible banner above normal app content when maintenance enabled.
- [x] Only shown to non-admin users.
- [x] Banner colors: amber/50 with warning icon.

### Task 6.5 — Add maintenance toggle to OverviewPage

- [x] Toggle switch + optional message input in OverviewPage admin section.
- [x] Uses mutation hook for admin-toggle-maintenance.

### Task 6.6 — Validate WU6

- [x] Tests: maintenance hook, banner visibility, toggle mutation.
- [x] npm test, npm run lint, npx tsc -b.

---

## WU2 — Toggle subscription status

**Goal:** Pause/resume subscriptions from BillingPage.

**Forecast:** 3–4 files, 130–200 lines.

### Task 2.1 — Create admin-toggle-subscription Edge Function

- [x] New function with requirePlatformAdmin.
- [x] Accept `{ workshopId, action: "pause" | "resume" }`.
- [x] Update `subscriptions.status` via service_role.

### Task 2.2 — Add toggle mutation hook

- [x] `useToggleSubscription()` hook.
- [x] Invalidates subscription queries.

### Task 2.3 — Add toggle button to BillingPage

- [x] "Pausar"/"Reanudar" button per row.
- [x] Only shown when applicable (active → pause, paused → resume).

### Task 2.4 — Validate WU2

- [x] Tests: toggle renders, mutation calls correct action.
- [x] npm test, npm run lint, npx tsc -b.

---

## WU3 — Retry failed webhook

**Goal:** Retry button in SupportPage for failed events.

**Forecast:** 3–4 files, 100–160 lines.

### Task 3.1 — Create admin-retry-webhook Edge Function

- [x] New function with requirePlatformAdmin.
- [x] Send test notification to MercadoPago via existing MP integration.

### Task 3.2 — Add retry mutation hook

- [x] `useRetryWebhook()` hook.

### Task 3.3 — Add retry button to SupportPage

- [x] "Reintentar" button on rows where event_type contains "fail".
- [x] Toast on result.

### Task 3.4 — Validate WU3

- [x] Tests: retry button only on failed events, mutation called with eventId.
- [x] npm test, npm run lint, npx tsc -b.

---

## WU4 — Workshop deactivate/activate

**Goal:** Toggle workshop is_active flag from WorkshopDetailPage.

**Forecast:** 4–5 files, 180–280 lines.

### Task 4.1 — Create migration for workshops.is_active

- [x] Migration: `ALTER TABLE workshops ADD COLUMN is_active boolean NOT NULL DEFAULT true`.

### Task 4.2 — Update admin-workshops Edge Function

- [x] Include `isActive` in workshop DTO.

### Task 4.3 — Create admin-toggle-workshop Edge Function

- [x] New function with requirePlatformAdmin.
- [x] Toggle `workshops.is_active`.

### Task 4.4 — Add workshop toggle to WorkshopDetailPage

- [x] Toggle button/swicth with confirmation.
- [x] Show active/inactive badge.

### Task 4.5 — Validate WU4

- [x] Tests: toggle renders, mutation calls correct action.
- [x] npm test, npm run lint, npx tsc -b.

---

## WU5 — Force profile onboarding

**Goal:** Admin can force-set onboarded_at for a profile from workshop detail.

**Forecast:** 3–4 files, 100–160 lines.

### Task 5.1 — Create admin-force-onboarding Edge Function

- [x] requirePlatformAdmin guard.
- [x] Accept `{ profileId }`.
- [x] Set `onboarded_at = now()` if currently null.
- [x] Return 400 if already onboarded.

### Task 5.2 — Add force onboarding mutation hook

- [x] `useForceOnboarding()` hook.

### Task 5.3 — Add button to WorkshopDetailPage

- [x] Show profiles list in support context section.
- [x] "Forzar onboarding" button next to profiles missing onboarded_at.
- [x] Toast on result.

### Task 5.4 — Validate WU5

- [x] Tests: button only on non-onboarded profiles, mutation called.
- [x] npm test, npm run lint, npx tsc -b.

---

## WU7 — Integration polish + E2E

**Goal:** End-to-end tests and final integration checks.

**Forecast:** 2–3 files, 80–120 lines.

### Task 7.1 — Add admin actions E2E test

- [x] `tests/e2e/admin/admin-actions.spec.ts`.
- [x] Covers: cancel subscription, toggle maintenance, deactivate workshop.

### Task 7.2 — Final validation

- [x] npm test full suite.
- [x] npm run lint.
- [x] npx tsc -b.
- [x] LSP diagnostics on all changed files.
- [x] Manual checklist for Edge Functions.

---

## Final verification

- [x] All WU tasks completed.
- [x] `npm test` passes.
- [x] `npm run lint` passes.
- [x] `npx tsc -b` passes.
- [x] No service-role key in frontend.
- [x] Edge Functions return 401/403/200 correctly.
- [x] Maintenance banner visible to non-admin, hidden from admin.
- [x] Cancel subscription works end-to-end.
- [x] Workshop deactivation doesn't lose data.
