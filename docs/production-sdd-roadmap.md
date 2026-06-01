# Production SDD Roadmap

CarpinteroPro is not ready for public paid production yet. Use this roadmap to resume the launch work package by package through SDD/OpenSpec.

## Quick path

1. Start with **SDD 1 — Tenant security / RLS**.
2. Continue with **SDD 2 — Billing + MercadoPago** only after tenant isolation is server-derived and tested.
3. Treat architecture cleanup as later work unless a launch blocker requires touching it.

## Package sequence

| Order | SDD package | Priority | Goal | Depends on |
|---:|---|---|---|---|
| 1 | Tenant security / RLS | P0 | Prevent cross-workshop data access. | None |
| 2 | Billing + MercadoPago | P0 | Charge users and enforce trial/paid access. | SDD 1 |
| 3 | Auth/profile hardening | P1 | Fail closed and clearly when profile/workshop context is broken. | SDD 1 |
| 4 | Cache/PWA privacy | P1 | Avoid leaking sensitive business data through local browser storage or service worker cache. | SDD 1 |
| 5 | Production ops | P1 | Make deploy, CI, env configuration, and rollback repeatable. | None |
| 6 | Observability/support | P1/P2 | Detect production failures and support users safely. | Production ops preferred |
| 7 | Business-critical E2E | P2 | Cover signup, onboarding, CRUD, logout, tenant isolation, and billing gates. | SDD 1 and SDD 2 for full coverage |
| 8 | Architecture cleanup | P2 | Reduce feature coupling and enforce project architecture rules. | After P0s |

## Current status

- SDD 1 — archived / PASS (2026-05-24).
- SDD 2 — archived / PASS (2026-05-31).
- SDD 3, SDD 4, SDD 5, SDD 7, and SDD 8 are now ready to start.
- SDD 6 remains blocked on SDD 5.

## SDD 1 — Tenant security / RLS

**Status:** archived / PASS (2026-05-24).

**Launch blocker:** current tenant isolation relies on a client-controlled `x-workshop-id` header. Before selling, RLS must derive the workshop from trusted server-side identity.

Likely scope:

- Replace `get_current_workshop_id()` with logic derived from `auth.uid()` and `profiles.workshop_id`, or another trusted server-managed claim.
- Remove the public `x-workshop-id` header path from the Supabase client.
- Review RLS policies for select/insert/update/delete tenant isolation.
- Add SQL tests proving user A cannot access user B workshop rows.
- Keep the frontend tenant context for UI state only, not authorization.

Key files:

- `supabase/migrations/0004_rls_policies.sql`
- `src/shared/lib/supabase.ts`
- `src/shared/providers/AuthProvider.tsx`
- Related Supabase migrations for child-table `workshop_id` and RLS.

Acceptance direction:

- [ ] No authorization decision trusts client-supplied workshop headers.
- [ ] Cross-tenant select/insert/update/delete attempts are denied by tests.
- [ ] App still loads the authenticated user's workshop context for UI/query needs.
- [ ] Missing/broken profile state fails safely.

## SDD 2 — Billing + MercadoPago

**Status:** archived / PASS (2026-05-31).

Goal: implement real monetization instead of pricing/legal copy only.

Likely scope:

- Subscription/trial schema scoped by `workshop_id`.
- MercadoPago checkout and verified server-side webhook.
- Billing gate in the app shell.
- Cancellation/settings flow.
- Legal and pricing copy aligned with actual behavior.

Key files:

- `src/features/landing/data/pricing.ts`
- `src/features/legal/pages/TermsPage.tsx`
- `src/features/legal/pages/PrivacyPage.tsx`
- `src/app/layouts/AppLayout.tsx`
- New migrations and server/edge-function files.

## SDD 3 — Auth/profile hardening

Goal: make auth/profile failures explicit, supportable, and fail-closed.

Key file:

- `src/shared/providers/AuthProvider.tsx`

Likely scope:

- Handle profile-load errors.
- Add retry/logout/support paths.
- Test missing profile, RLS denial, and invalid workshop context.

## SDD 4 — Cache/PWA privacy

Goal: prevent sensitive business data from persisting unsafely on shared devices or across users.

Key files:

- `src/shared/lib/queryClient.ts`
- `vite.config.ts`

Likely scope:

- Clear persisted query cache on logout/user switch.
- Avoid persisting sensitive queries.
- Reassess Supabase REST service worker caching.

## SDD 5 — Production ops

Goal: make production deployment repeatable.

Likely scope:

- Real deployment README.
- Complete `.env.example`.
- CI for lint/test/build.
- Supabase setup checklist, auth redirects, migrations, and rollback notes.

## SDD 6 — Observability/support

Goal: detect and diagnose production errors without leaking PII.

Likely scope:

- Error reporter.
- Error boundaries with support IDs.
- Supabase/auth/network failure handling.

## SDD 7 — Business-critical E2E

Goal: protect revenue and trust-critical flows.

Likely scope:

- Signup/login/onboarding.
- Main CRUD flows.
- Logout and user switching.
- Tenant isolation.
- Billing gate/trial/expired/active subscription.

## SDD 8 — Architecture cleanup

Goal: reduce future regression risk while respecting feature-sliced rules.

Likely scope:

- Remove cross-feature imports.
- Move shared contracts to `src/shared` when truly shared.
- Keep DB queries in feature `api/` and TanStack Query wrappers in feature `hooks/`.

## Resume note

When resuming, choose the next package and run the normal SDD flow: explore → proposal → spec → design → tasks → apply → verify → archive.
