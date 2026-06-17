# SDD9 Admin Dashboard — Explore

## Outcome

Build a same-repo, super-admin-only dashboard for the platform owner to manage CarpinteroPro across tenants. The safest first slice is an internal `/admin/*` area guarded by a platform-admin flag and backed by admin-only Supabase Edge Functions that use the service role server-side.

## Current codebase map

| Area | Finding | Path evidence |
|---|---|---|
| Routing | Authenticated app routes are lazy-loaded and composed in the app router. | `src/app/router.tsx` |
| Auth shell | `AppLayout` gates normal app access by session, profile, and onboarding state. | `src/app/layouts/AppLayout.tsx` |
| Auth context | Auth context exposes session/workshop/onboarding state, but no admin role. | `src/shared/providers/AuthProvider.tsx` |
| Navigation | Main navigation is hardcoded and has no admin entry. | `src/app/layouts/nav-items.ts` |
| Tenant identity | `profiles` links `auth.users` to `workshop_id`; there is no role/admin column. | `supabase/migrations/0005_auth_profiles.sql`, `src/shared/types/database.ts` |
| Tenant RLS | RLS policies are workshop-scoped through `get_current_workshop_id()`. | `supabase/migrations/0020_tenant_rls_security.sql` |
| Billing | Subscription data is tenant-scoped; billing actions already go through edge functions. | `src/features/billing/`, `supabase/functions/create-subscription/`, `supabase/functions/cancel-subscription/` |
| Service role pattern | Edge functions can safely run cross-tenant queries using `serviceClient()`. | `supabase/functions/_shared/auth.ts` |
| UI system | Tables, cards, badges, inputs, dialogs, skeletons, and buttons exist in shared UI. | `src/shared/ui/` |

## Recommended product scope

### First version

1. **Platform overview**
   - Total workshops.
   - Active/trialing/past-due/cancelled subscriptions, matching the database status spelling.
   - Recent signups.
   - Billing health and estimated monthly recurring revenue.

2. **Workshops management**
   - Search/list all workshops.
   - View owner/profile count, onboarding status, subscription status, and created date.
   - Open a workshop detail view for support context.

3. **Billing/subscriptions overview**
   - Global subscription table.
   - Filter by status.
   - Drill into a workshop's subscription and MercadoPago identifiers.
   - Start with read-only billing data; mutation actions require separate approval.

4. **Support/troubleshooting**
   - Show workshop metadata and recent webhook/payment events.
   - Provide safe diagnostic views, not impersonation in the first slice.
   - Avoid destructive admin actions until auditing exists.

5. **Admin access state**
   - `/admin/*` shows loading, forbidden, error, and empty states.
   - Normal tenant users never see admin data or an admin nav entry.

### Later versions

- Subscription remediation actions.
- Admin audit log.
- Impersonation/support session with explicit audit trail.
- User/workshop suspension workflows.
- Operational charts from a dedicated analytics source.

## Security recommendation

Do **not** expose cross-tenant RLS policies directly to the browser for the first version. Use this model instead:

1. Add `profiles.is_platform_admin boolean NOT NULL DEFAULT false`.
2. Client checks admin status only for the current user.
3. Admin data loads through Supabase Edge Functions.
4. Edge Functions validate the JWT, then use the service role server-side only after confirming `profiles.is_platform_admin = true`.
5. Normal tenant RLS remains unchanged.

This avoids a new platform-global table. That matters because this project requires every new table to include `workshop_id uuid NOT NULL`; an `admin_users` table without `workshop_id` would violate the repository rule.

## Route and layout recommendation

Start with `/admin/*` in the same repo, lazy-loaded from a new `src/features/admin/routes.tsx` public entry. Use a dedicated admin route guard and admin layout inside the feature, while `src/app/router.tsx` owns route composition.

Recommended shape:

```text
src/features/admin/
  api/          edge function clients
  components/   admin dashboard UI
  hooks/        TanStack Query wrappers
  lib/          pure mapping/formatting helpers
  types.ts      admin DTOs and view models
  routes.tsx    nested /admin routes
  index.ts      public exports for app router
```

## Design direction

Use a dense operational dashboard aesthetic: calm, readable, table-first, low ornamentation, strong status badges, predictable filters, and explicit empty/error states. Avoid marketing-style dashboard cards that hide operational detail.

## Key risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Admin data leaks cross-tenant information | Highest security risk. | Edge Functions with server-side admin checks; no service role in frontend. |
| Admin role bootstrap is unclear | The first admin must be created safely. | Manual SQL/env-seeded bootstrap documented in tasks; no public self-service admin signup. |
| Scope becomes too large | Admin dashboards naturally expand into billing ops/support tooling. | First slice is read-only except future explicitly approved actions. |
| New table violates tenant convention | Project rule requires `workshop_id` on every new table. | Prefer adding `profiles.is_platform_admin`; no new admin table in MVP. |
| Review size exceeds 400 changed lines | Dashboard + edge functions + tests are multi-area. | Split into chained PRs/work units. |

## Next phase input

Proposal/spec/design should define an MVP with:

- same-repo `/admin/*` route;
- `profiles.is_platform_admin` admin marker;
- admin-only Edge Functions for cross-tenant reads;
- read-only overview/workshops/billing/support screens;
- strict TDD for guard behavior, edge authorization, and UI states;
- chained delivery if implementation exceeds 400 changed lines.
