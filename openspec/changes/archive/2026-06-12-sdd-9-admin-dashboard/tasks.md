# SDD9 Admin Dashboard — Tasks

Build a secure, same-repo super-admin dashboard for the platform owner. The MVP is read-only and uses server-side Edge Functions for cross-tenant data.

## Out of scope

- Impersonation.
- Destructive admin actions.
- Subscription mutation/remediation actions.
- Admin audit-log persistence.
- Separate admin frontend repo.
- Public admin signup or self-promotion.
- New platform-global tables unless the `workshop_id` project rule is explicitly redesigned.

## Review workload forecast

| Field | Value |
|---|---|
| Estimated changed lines | 990–1,720 full MVP |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1 WU1 → PR2 WU2 → PR3 WU3 → PR4 WU4 → PR5 WU5 |
| Delivery strategy | auto-chain |
| Decision needed before apply | No for planning; yes if a unit exceeds 400 changed lines |

Chained PRs are recommended before implementation.

## PR sequence

```text
PR1 WU1 — Admin identity foundation
PR2 WU2 — Edge Function admin API foundation
PR3 WU3 — Admin route shell and guard
PR4 WU4 — Overview and workshops screens
PR5 WU5 — Billing and support diagnostics screens
```

Each PR must include its own tests, validation evidence, rollback note, and changed-line count.

---

## Work Unit 1 — Admin identity foundation

**Goal:** Add platform-admin identity to existing profiles and expose current-user admin state safely.

**Forecast:** 4–7 files, 120–220 changed lines.

**Dependencies:** None.

**Strict TDD:** Required for auth/admin status behavior. For SQL migration, add migration-level assertions if project tooling supports them; otherwise document the manual verification gap.

### Task 1.1 — Add `is_platform_admin` to profiles

- [x] Create a Supabase migration adding `profiles.is_platform_admin boolean NOT NULL DEFAULT false`.
- [x] Ensure existing rows become non-admin by default.
- [x] Do not create a new admin table.
- [x] Document bootstrap SQL for the first platform admin in the migration comments or a short ops note.
- [x] Prevent authenticated users from changing `is_platform_admin` through the existing own-profile update policy.

**Verification:**
- Migration includes no new table that violates `workshop_id uuid NOT NULL`.
- Local schema applies cleanly where Supabase local tooling is available.

### Task 1.2 — Update database types

- [x] Update `src/shared/types/database.ts` for `profiles.Row`, `Insert`, and `Update`.
- [x] Preserve `Relationships: []` conventions.

**Verification:**
- TypeScript accepts reads of `profile.is_platform_admin`.

### Task 1.3 — Expose admin status in auth/profile state

- [x] Extend auth/profile loading code to include current user's `is_platform_admin`.
- [x] Add `isPlatformAdmin` (or equivalent) to `AuthContextValue`.
- [x] Keep normal onboarding/profile behavior unchanged.
- [x] Add tests for admin and non-admin status if the auth provider already has test seams; otherwise add a focused hook/helper test.

**Verification:**
- Non-admin profile resolves to `false`.
- Admin profile resolves to `true`.
- Existing auth/profile tests still pass.

### Task 1.4 — Validate WU1

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Record RED/GREEN/REFACTOR evidence.
- [x] Confirm changed-line count is within forecast or split before PR.

**Rollback:** Remove the auth context field and consumers. If migration has shipped, leave the default-false column unused rather than dropping it without a data plan.

---

## Work Unit 2 — Edge Function admin API foundation

**Goal:** Add server-side admin authorization and read-only cross-tenant admin endpoints.

**Forecast:** 6–10 files, 220–380 changed lines.

**Dependencies:** WU1.

**Strict TDD:** Required for admin authorization helper and endpoint behavior.

### Task 2.1 — Add shared admin authorization helper

- [x] Create `supabase/functions/_shared/admin-auth.ts`.
- [x] Validate Supabase JWT from request headers.
- [x] Load caller profile server-side.
- [x] Return 401 for missing/invalid JWT.
- [x] Return 403 for authenticated non-admin users.
- [x] Allow service-role access only after admin verification.

**Verification:**
- Tests or manual checklist cover 401, 403, and admin success.
- Service-role client is not constructed/used before authorization succeeds, where practical.

### Task 2.2 — Add admin overview endpoint

- [x] Create `supabase/functions/admin-overview/index.ts`.
- [x] Return total workshops, recent workshops/signups, subscription counts by status, and recent webhook failure count if available.
- [x] Use explicit DTO mapping; do not leak raw tables wholesale.

**Verification:**
- Non-admin request returns 403.
- Admin request returns documented overview DTO.

### Task 2.3 — Add admin workshops endpoint

- [x] Create `supabase/functions/admin-workshops/index.ts`.
- [x] Support list/search and optional detail by `workshopId`.
- [x] Return workshop summary/detail DTOs with safe support fields.

**Verification:**
- Search does not require client-side cross-tenant queries.
- Detail request for unknown workshop returns a safe not-found response.

### Task 2.4 — Add admin subscriptions endpoint

- [x] Create `supabase/functions/admin-subscriptions/index.ts`.
- [x] Return read-only subscription summaries across workshops.
- [x] Support status filtering.
- [x] Do not include mutation actions in this endpoint.

**Verification:**
- Admin can filter by status.
- Non-admin cannot fetch any rows.

### Task 2.5 — Add admin support diagnostics endpoint

- [x] Create `supabase/functions/admin-support-diagnostics/index.ts`.
- [x] Return recent billing webhook/payment diagnostics and timestamps where available.
- [x] Do not implement impersonation.
- [x] Do not implement destructive operations.

**Verification:**
- Endpoint returns safe diagnostic DTOs only.

### Task 2.6 — Validate WU2

- [x] Run available Edge Function/unit tests.
- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Record manual curl/checklist if function tests are not available.

**Rollback:** Remove admin Edge Functions and helper. No tenant data rollback required.

---

## Work Unit 3 — Admin route shell and guard

**Goal:** Add lazy `/admin/*` route, admin guard, layout, and conditional navigation.

**Forecast:** 6–9 files, 180–320 changed lines.

**Dependencies:** WU1; WU2 optional for real data, but shell can use placeholders/mocked hooks behind tests.

**Strict TDD:** Required for route/guard UI states.

### Task 3.1 — Create admin feature skeleton

- [x] Create `src/features/admin/index.ts`.
- [x] Create `src/features/admin/routes.tsx`.
- [x] Create admin types/query key placeholders as needed.
- [x] Ensure admin feature imports only local admin modules and `src/shared/**`.

**Verification:**
- No cross-feature imports from admin feature.

### Task 3.2 — Add admin route composition

- [x] Add lazy `/admin/*` route in `src/app/router.tsx`.
- [x] Keep normal app routes unchanged.
- [x] Use a dedicated `AdminLayout` inside the admin feature.
- [x] Keep the normal app shell limited to a conditional admin entry point for platform admins.

**Verification:**
- `/admin` route lazy-loads admin routes.
- Existing routes still render.

### Task 3.3 — Implement admin guard states

- [x] Add `AdminGuard` or equivalent.
- [x] Render loading while auth/admin status resolves.
- [x] Render forbidden for authenticated non-admin users.
- [x] Render admin layout for platform admins.
- [x] Avoid running admin data queries before the guard allows them.

**Verification:**
- Tests cover loading, forbidden, and allowed states.

### Task 3.4 — Add conditional admin nav entry

- [x] Add an admin nav affordance only when `isPlatformAdmin` is true.
- [x] Keep normal users' mobile/desktop navigation unchanged.

**Verification:**
- Non-admin tests or assertions prove no admin nav entry.

### Task 3.5 — Validate WU3

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Record RED/GREEN/REFACTOR evidence.

**Rollback:** Remove `/admin/*` route and admin nav entry.

---

## Work Unit 4 — Overview and workshops screens

**Goal:** Implement the first useful admin screens: platform overview and workshop list/detail.

**Forecast:** 8–12 files, 250–420 changed lines.

**Dependencies:** WU2, WU3.

**Strict TDD:** Required for mapping helpers and UI states. Split this WU if it exceeds 400 changed lines.

### Task 4.1 — Add admin API clients and hooks

- [x] Add `src/features/admin/api/overview.ts` and `workshops.ts` using Supabase function invocation.
- [x] Add `src/features/admin/hooks/useAdminOverview.ts` and `useAdminWorkshops.ts`.
- [x] Keep TanStack Query keys admin-local.

**Verification:**
- Hooks are disabled until guard/admin status allows them.

### Task 4.2 — Add overview screen

- [x] Add overview KPI cards and operational alerts.
- [x] Show total workshops, recent workshops, subscription status counts, and webhook failure count.
- [x] Add loading, empty, and error states.

**Verification:**
- UI tests cover loading/empty/error/success states.

### Task 4.3 — Add workshops table

- [x] Add searchable workshops table.
- [x] Show workshop id/name, created date, profile count, onboarded count, and subscription status.
- [x] Use shared table/input/badge primitives.

**Verification:**
- Search/filter behavior is tested at helper or component level.

### Task 4.4 — Add workshop detail screen

- [x] Add route for `/admin/workshops/:workshopId`.
- [x] Show safe support context for the selected workshop.
- [x] Include not-found and error states.

**Verification:**
- Unknown workshop state is handled.

### Task 4.5 — Validate WU4

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Confirm changed-line count; split if above 400.

**Rollback:** Remove overview/workshop screen routes and hooks while preserving admin shell.

---

## Work Unit 5 — Billing and support diagnostics screens

**Goal:** Add read-only billing visibility and safe support diagnostics.

**Forecast:** 7–11 files, 220–380 changed lines.

**Dependencies:** WU2, WU3.

**Strict TDD:** Required for mapping helpers and UI states.

### Task 5.1 — Add admin subscriptions API client and hook

- [x] Add `src/features/admin/api/subscriptions.ts`.
- [x] Add `src/features/admin/hooks/useAdminSubscriptions.ts`.
- [x] Support status filtering.

**Verification:**
- Filter params are included in function invocation and tested.

### Task 5.2 — Add billing overview screen

- [x] Add read-only subscription table.
- [x] Show status badges and workshop links.
- [x] Do not expose cancel/retry/refund/plan-change actions.
- [x] Add loading, empty, and error states.

**Verification:**
- Test asserts mutation buttons are absent.

### Task 5.3 — Add support diagnostics client/hook

- [x] Add `src/features/admin/api/support.ts`.
- [x] Add `src/features/admin/hooks/useAdminSupportDiagnostics.ts`.
- [x] Map recent webhook/payment diagnostic data to safe view models.

**Verification:**
- Mapping tests cover missing/unavailable fields.

### Task 5.4 — Add support diagnostics screen

- [x] Add support diagnostics list/detail UI.
- [x] Show timestamps, event ids, statuses, and safe error summaries.
- [x] Do not implement impersonation.
- [x] Do not implement destructive actions.

**Verification:**
- UI tests cover unavailable/empty/error diagnostics.

### Task 5.5 — Validate WU5

- [x] Run `npm test`.
- [x] Run `npm run lint`.
- [x] Confirm changed-line count is within budget.

**Rollback:** Remove billing/support screens and hooks while preserving admin overview if already merged.

---

## Final verification

- [x] All tasks completed or explicitly deferred.
- [x] `npm test` passes.
- [x] `npm run lint` passes.
- [x] `/admin/*` is inaccessible to unauthenticated/non-admin users.
- [x] Admin Edge Functions return 401 for missing JWT, 403 for non-admin JWT, and success for admin JWT.
- [x] Service-role key appears only in server/Edge Function code.
- [x] No admin feature cross-feature imports exist.
- [x] Review workload and PR split are documented.
- [x] Manual verification checklist includes normal user and platform admin flows.
