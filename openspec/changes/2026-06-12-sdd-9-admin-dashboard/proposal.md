# SDD9 Admin Dashboard Proposal

CarpinteroPro needs a super-admin dashboard so the platform owner can operate the SaaS across all workshops without using database consoles or exposing service-role access in the browser. The first version should be same-repo, read-mostly, and protected by a platform-admin flag plus server-side Edge Function authorization.

## Intent

Create an internal `/admin/*` dashboard for the platform owner to:

- monitor global platform health;
- manage and inspect workshops/tenants;
- review subscription and billing status;
- troubleshoot support cases safely;
- keep tenant RLS intact for all normal app traffic.

## Recommendation

Build it in the **same repo** as a lazy-loaded admin feature.

Why same repo:

- It can reuse the existing React/Tailwind/shared UI system.
- It can share typed Supabase DTOs and deployment conventions.
- It avoids bootstrapping a second frontend before the admin surface proves its value.
- A separate app can be extracted later if compliance, operational isolation, or team boundaries require it.

## Scope

### In scope for MVP

1. **Admin authorization**
   - Add a platform-admin marker on the current user's `profiles` row: `is_platform_admin boolean NOT NULL DEFAULT false`.
   - Expose current-user admin status to the frontend.
   - Gate all `/admin/*` screens.
   - Ensure non-admin users see a forbidden state and cannot fetch admin data.

2. **Admin Edge Function API**
   - Add server-side admin authorization helper for Edge Functions.
   - Provide read-only admin endpoints for:
     - platform overview metrics;
     - workshops list/detail;
     - subscriptions/billing overview;
     - support diagnostics such as recent billing webhook events.
   - Use service role only inside Edge Functions after admin verification.

3. **Admin UI**
   - Add a lazy-loaded `/admin/*` route.
   - Add admin dashboard layout and navigation.
   - Add overview, workshops, billing, and support/troubleshooting screens.
   - Use shared UI primitives for cards, tables, badges, filters, loading, empty, forbidden, and error states.

4. **Testing and validation**
   - Strict TDD for admin guard behavior, Edge Function authorization, data mapping helpers, and UI states.
   - Verify tenant users cannot access admin screens/data.
   - Verify service-role secrets stay server-side.

### Explicitly out of scope for MVP

- Impersonation.
- Destructive admin actions.
- Subscription mutation/remediation actions.
- Admin audit log table.
- A separate admin frontend repository.
- Direct browser RLS bypass policies that expose cross-tenant reads.
- Public self-service admin signup.

## Affected areas

| Area | Expected impact |
|---|---|
| `supabase/migrations/` | Add `profiles.is_platform_admin` and any helper SQL needed for own-profile visibility. |
| `supabase/functions/` | Add admin auth helper and read-only admin endpoints. |
| `src/shared/providers/AuthProvider.tsx` | Expose `isPlatformAdmin` or equivalent current-user admin state. |
| `src/app/router.tsx` | Add lazy `/admin/*` route composition. |
| `src/app/layouts/nav-items.ts` / shell | Add conditional admin entry only for platform admins, if using shared shell navigation. |
| `src/features/admin/` | New feature slice for admin API clients, hooks, components, routes, and types. |
| `src/shared/types/database.ts` | Add `profiles.is_platform_admin` type update; preserve `Relationships: []`. |
| Tests | Add migration/edge/unit/component tests for admin authorization and states. |

## Acceptance criteria

- [ ] `/admin/*` is inaccessible to unauthenticated users and authenticated non-admin users.
- [ ] A platform admin can access admin routes after profile/admin status loads.
- [ ] Normal tenant users do not see an admin navigation entry.
- [ ] Admin data requests go through Edge Functions, not direct frontend service-role usage.
- [ ] Edge Functions reject missing, invalid, and non-admin JWTs.
- [ ] Edge Functions only use service role after confirming the authenticated user is a platform admin.
- [ ] Overview screen shows global workshop/subscription metrics with loading, empty, and error states.
- [ ] Workshops screen supports search/list/detail for all workshops.
- [ ] Billing screen shows subscriptions across workshops with status filters.
- [ ] Support screen shows safe diagnostics without impersonation or destructive actions.
- [ ] Database type changes keep `Relationships: []` in manually maintained table entries.
- [ ] Strict TDD evidence is recorded for behavior changes.
- [ ] `npm test` passes before merge.
- [ ] Review workload stays under the 400-line budget per PR or uses chained PRs.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cross-tenant data leak | Keep global reads in admin Edge Functions; never expose service role or broad RLS to the browser. |
| Admin bootstrap mistakes | Document a manual SQL bootstrap for the first admin; no UI to grant admin in MVP. |
| Scope creep into operations tooling | First version is read-only; mutations require a later SDD. |
| 400-line review budget exceeded | Split into schema/auth, Edge API, admin shell, and screen PRs. |
| Admin flag on `profiles` mixes platform and tenant concepts | Accept for MVP because it avoids a new table that would violate the project-wide `workshop_id` rule; revisit with an audited admin membership model only if policy changes. |

## Delivery strategy

Use chained work units if the forecast exceeds 400 changed lines:

1. Schema/admin status foundation.
2. Edge Function admin API foundation.
3. Admin route/shell/guard.
4. Overview and workshops screens.
5. Billing and support diagnostics screens.

Each unit should be independently reviewable and keep tests green.

## Rollback

- Disable `/admin/*` route by removing the lazy route entry.
- Revert admin UI feature files.
- Revert Edge Functions for admin endpoints.
- Revert `profiles.is_platform_admin` migration only if no production data depends on it; otherwise leave the nullable/defaulted column unused.

## Success criteria

SDD9 succeeds when the platform owner can safely inspect global app state from an internal dashboard, normal tenants remain isolated by existing RLS, service-role access is never exposed to the frontend, and the implementation is split into reviewable PRs with passing tests.
