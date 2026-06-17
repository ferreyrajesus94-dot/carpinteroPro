# SDD9 Admin Dashboard Design

## Decision summary

| Area | Decision | Rationale |
|---|---|---|
| App placement | Build `/admin/*` in the same repo as a lazy-loaded admin feature. | Reuses routing, auth, shared UI, deployment, and typed Supabase conventions; extraction can wait. |
| Admin identity | Add `profiles.is_platform_admin boolean NOT NULL DEFAULT false`. | Avoids a new platform-global table that would violate the project rule requiring `workshop_id` on new tables. |
| Data access | Use admin-only Supabase Edge Functions for cross-tenant reads. | Keeps service role server-side and avoids broad browser RLS bypass policies. |
| MVP operations | Read-only global overview, workshops, billing, and support diagnostics. | Gives operational value while avoiding audit/destructive-action risk. |
| UI direction | Dense operational dashboard using existing shared UI primitives. | Admin work needs scannability, filters, status clarity, and trustworthy states over decoration. |
| Layout | Use a dedicated `AdminLayout` inside `src/features/admin/`, with only a small conditional entry point from the normal app shell. | Keeps platform operations visually and structurally separate while preserving same-repo routing. |
| Delivery | Chained work units if the diff exceeds 400 changed lines. | Schema + edge functions + UI is likely too large for one easy review. |

## Target architecture

```text
src/app/router.tsx
  composes /admin/* lazy route

src/features/admin/
  api/
    adminStatus.ts
    overview.ts
    workshops.ts
    subscriptions.ts
    support.ts
  hooks/
    useAdminStatus.ts
    useAdminOverview.ts
    useAdminWorkshops.ts
    useAdminSubscriptions.ts
    useAdminSupportDiagnostics.ts
  components/
    AdminLayout.tsx
    AdminGuard.tsx
    AdminOverviewPage.tsx
    AdminWorkshopsPage.tsx
    AdminWorkshopDetailPage.tsx
    AdminBillingPage.tsx
    AdminSupportPage.tsx
    AdminForbiddenState.tsx
  lib/
    mapAdminOverview.ts
    mapAdminWorkshop.ts
    adminQueryKeys.ts
  types.ts
  routes.tsx
  index.ts

supabase/functions/
  _shared/admin-auth.ts
  admin-overview/index.ts
  admin-workshops/index.ts
  admin-subscriptions/index.ts
  admin-support-diagnostics/index.ts
```

`src/app/**` may import the admin public route export. `src/features/admin/**` must not import other feature folders; it should use shared UI, shared Supabase function invocation, and admin-local DTOs.

## Admin authorization flow

1. User signs in through existing Supabase Auth.
2. Existing profile load gets `workshop_id`, onboarding state, and `is_platform_admin`.
3. `/admin/*` route waits for auth/admin status.
4. If unauthenticated, follow existing login redirect behavior.
5. If authenticated but not platform admin, render forbidden state and do not run admin queries.
6. If platform admin, admin hooks invoke Edge Functions with the user's JWT.
7. Each Edge Function:
   - validates the JWT;
   - queries the caller's profile using a safe server-side client;
   - returns 403 unless `is_platform_admin = true`;
   - only then uses service-role queries for cross-tenant reads.

## Why not an `admin_users` table in MVP?

A separate `admin_users` table is semantically clean, but the repository rule says every new table must include `workshop_id uuid NOT NULL` for tenant isolation. A platform-wide admin membership table would either violate that rule or require an artificial tenant relationship. For the MVP, `profiles.is_platform_admin` is the smallest safe choice because `profiles` already has `workshop_id`, RLS, and current-user visibility.

If the project later allows explicit platform-global tables, a follow-up SDD can migrate to an audited `platform_admin_memberships` model.

## Data contracts

### Admin status

```ts
interface AdminStatus {
  isPlatformAdmin: boolean
}
```

### Overview DTO

```ts
interface AdminOverviewDto {
  workshops: {
    total: number
    createdLast30Days: number
  }
  subscriptions: {
    total: number
    byStatus: Record<string, number>
    estimatedMonthlyRevenueCents?: number
  }
  support: {
    recentWebhookFailures: number
  }
}
```

### Workshop summary DTO

```ts
interface AdminWorkshopSummaryDto {
  id: string
  name: string
  createdAt: string
  ownerEmail?: string | null
  profileCount: number
  subscriptionStatus?: string | null
  onboardedProfileCount: number
}
```

### Subscription summary DTO

```ts
interface AdminSubscriptionSummaryDto {
  id: string
  workshopId: string
  workshopName: string
  status: string
  provider: string
  externalReference?: string | null
  currentPeriodEnd?: string | null
  updatedAt: string
}
```

Exact field names should match existing database types during apply. Unknown provider-specific fields must be optional and displayed as unavailable, not fabricated.

## UI structure

| Route | Screen | Purpose |
|---|---|---|
| `/admin` | Overview | KPI cards plus recent operational alerts. |
| `/admin/workshops` | Workshops table | Searchable workshop/tenant list. |
| `/admin/workshops/:workshopId` | Workshop detail | Support context for one workshop. |
| `/admin/billing` | Billing overview | Global subscription table and filters. |
| `/admin/support` | Support diagnostics | Recent webhook/payment diagnostic views. |

Design principles:

- Prefer tables over decorative cards where operators need precision.
- Use clear status badges for subscription and onboarding states.
- Show skeletons while loading and explicit empty/error states.
- Use accessible labels for filters/search.
- Do not show mutation buttons in MVP.

## Work units and review forecast

| Unit | Scope | Expected files | Forecast changed lines | TDD/validation | Delivery |
|---|---:|---:|---:|---|---|
| WU1 Admin identity foundation | Migration, database types, auth context/admin status. | 4-7 | 120-220 | RED guard/status tests; `npm test`; `npm run lint`. | PR1 |
| WU2 Edge Function API foundation | Admin auth helper + overview/workshops/subscriptions/support endpoints. | 6-10 | 220-380 | Auth helper tests; endpoint 401/403/success checklist. | PR2 |
| WU3 Admin route shell and guard | `/admin/*` lazy route, admin layout, forbidden/loading states, conditional nav. | 6-9 | 180-320 | RED route/guard UI tests. | PR3 |
| WU4 Overview + workshops | Overview cards, workshops table/detail, query hooks, mapping tests. | 8-12 | 250-420 | Mapping tests + UI state tests. | PR4 |
| WU5 Billing + support diagnostics | Billing filters/table, support diagnostics panel, read-only constraints. | 7-11 | 220-380 | UI state tests + no-mutation assertions. | PR5 |

Total forecast is above 400 changed lines. Chained PRs are recommended.

## Rollback plan

- WU1: Revert migration/types/auth context changes if no production admin data depends on them. If deployed, leave `is_platform_admin` default false and remove consumers.
- WU2: Remove admin Edge Functions and shared helper; no tenant data migration needed.
- WU3: Remove `/admin/*` route and admin navigation entry.
- WU4/WU5: Remove admin screens/hooks while keeping earlier guarded shell if needed.

## Strict TDD plan

Strict TDD is active. Apply must record RED/GREEN/REFACTOR evidence.

- WU1 starts with tests that prove non-admin and admin status differ.
- WU2 starts with tests or a harness around admin authorization helper for missing JWT, non-admin, and admin cases.
- WU3 starts with component/router tests for loading, forbidden, and allowed admin guard states. The selected layout is a dedicated `AdminLayout`; the normal app shell should only expose a conditional admin entry point for platform admins.
- WU4/WU5 start with mapping/UI-state tests before rendering full screens.

If local Supabase Edge Function tests are unavailable, document the tooling gap and provide a manual command checklist for 401/403/admin success during verify.

## Open gates before apply

- Confirm the first platform admin bootstrap process before production deploy.
- If any PR forecast exceeds 400 changed lines, split the unit or ask for a review-budget exception.
- Do not add impersonation, destructive billing actions, or admin role management UI without a separate SDD.
- Do not introduce a new table without resolving the `workshop_id` project rule.
