# SDD 4 Proposal — Cache/PWA Privacy

## Problem

CarpinteroPro currently persists browser-side data in ways that can expose sensitive, tenant-scoped workshop information on shared devices or after a user switch. TanStack Query persistence stores the full query cache in `localStorage` for 24 hours, and the PWA Workbox runtime cache stores Supabase REST responses in Cache Storage. There is no explicit purge of persisted query cache, local storage business data, or service worker API caches on logout or when a different Supabase user session becomes active.

This matters because SDD 1 made server authorization tenant-safe, but client-side caches can still display or retain business data such as quotes, CRM clients, tasks, inventory, stock movements, price history, and subscription state outside the intended session boundary.

## Intent

Prevent sensitive business and tenant-scoped data from persisting unsafely in local browser storage or PWA service worker caches, while preserving harmless UI preferences and normal app usability.

## Goals

- Clear sensitive persisted query data on logout and authenticated user switch.
- Stop persisting sensitive TanStack Query entries by default, or restrict persistence to an explicit allowlist of non-sensitive queries.
- Reassess Workbox Supabase REST caching so authenticated API responses are not reused across users.
- Keep non-sensitive convenience settings separate from business data, including `theme`, `cp.palette`, `cp.density`, `cp.howto.*`, and `carpinteroPro.rememberedEmail`.
- Add tests that document the cache/privacy contract under strict TDD.

## Non-Goals

- Redesigning authentication, profile recovery, billing, or tenant RLS behavior already covered by SDD 1–3.
- Removing all browser storage; safe UI preferences may remain.
- Building a full privacy settings UI or data export/delete workflow.
- Implementing IndexedDB encryption or secure offline-first sync.
- Broad PWA strategy redesign beyond authenticated-response cache safety.
- Changing database schemas, RLS policies, or MercadoPago integration unless a cache/privacy test reveals a direct need.

## Scope

### In scope

1. **TanStack Query persistence hardening**
   - Review `src/shared/lib/queryClient.ts` persistence behavior.
   - Replace broad full-cache persistence with either no persistence for sensitive data or an explicit allowlist for non-sensitive query keys.
   - Ensure persisted query cache is cleared on logout and user switch.

2. **Session-bound cache purge**
   - Add a single shared cache cleanup path callable from auth/session lifecycle code.
   - Clear persisted TanStack Query data, in-memory query cache, and relevant business-data storage without deleting harmless UI preferences.
   - Ensure logout from profile/recovery paths does not leave prior workshop data available after the next login.

3. **PWA/API runtime cache safety**
   - Revisit `vite.config.ts` Workbox `runtimeCaching` for Supabase REST responses.
   - Prefer removing authenticated Supabase REST runtime caching unless spec/design proves a safe alternative.
   - If any API caching remains, scope it so authenticated tenant data cannot be replayed between users.

4. **Storage classification**
   - Document which keys are preserved as non-sensitive convenience data.
   - Treat quotes, CRM, tasks, inventory, stock movements, price history, and billing subscription query data as sensitive/tenant-scoped.

5. **Tests and validation**
   - Add targeted Vitest coverage for logout/user-switch cache clearing.
   - Add tests or configuration assertions for query persistence allowlist/exclusion behavior.
   - Add tests or build-time assertions for Workbox Supabase REST caching removal/safety where practical.

### Out of scope

- Global app E2E coverage for every business module; SDD 7 owns business-critical E2E.
- Production deployment/service-worker rollback runbooks beyond notes required for this change; SDD 5 owns production ops.
- Persistent observability around cache purge failures; SDD 6 owns observability/support.

## Affected Areas

| Area | Expected impact |
|---|---|
| `src/shared/lib/queryClient.ts` | Configure persistence to avoid sensitive data, expose/centralize purge behavior if appropriate, and test query cache contracts. |
| `src/shared/providers/AuthProvider.tsx` | Invoke cache cleanup on logout/session removal and when the authenticated user ID changes. |
| `vite.config.ts` | Remove or harden Workbox Supabase REST runtime caching. |
| `src/features/auth/components/ProfilePage.tsx` | Verify logout path still routes correctly after cache cleanup; likely no major UI change. |
| `src/shared/providers/AuthProvider.test.tsx` | Cover logout/user-switch purge behavior and avoid regressions in auth/profile states. |
| `src/app/layouts/AppLayout.test.tsx` or focused cache tests | Ensure protected data does not survive logout/user switch through query cache. |
| OpenSpec docs/tasks | Record preserved localStorage keys and validation checklist. |

## Acceptance Criteria

- [ ] Sensitive TanStack Query data is not persisted broadly to `localStorage` for 24 hours.
- [ ] Logout clears in-memory query cache and persisted query cache containing tenant/business data.
- [ ] Switching from user A to user B clears user A's query data before user B's protected UI can render.
- [ ] Workbox no longer caches authenticated Supabase REST responses in a reusable `supabase-api` cache, or an explicitly safe alternative is documented and tested.
- [ ] Harmless UI/convenience keys (`theme`, `cp.palette`, `cp.density`, `cp.howto.*`, `carpinteroPro.rememberedEmail`) are preserved unless a later spec decision changes that.
- [ ] Sensitive modules named in exploration (quotes, CRM clients, tasks, inventory, stock movements, price history, billing subscription) are covered by the persistence exclusion/clear strategy.
- [ ] Tests are written before behavior changes and fail for the current broad persistence/no-purge behavior.
- [ ] `npm test` passes before verify/archive.

## Risks

| Risk | Severity | Mitigation |
|---|---:|---|
| Accidentally deleting user preferences on logout | Medium | Maintain an explicit preserved-key list and tests for non-sensitive keys. |
| Leaving sensitive query keys out of purge/exclusion coverage | High | Prefer deny-by-default persistence or whole query-cache purge over fragile per-feature cleanup. |
| Service worker caches already installed in user browsers | Medium | Include compatibility notes for cache-name cleanup/versioning and manual validation after update. |
| Offline/PWA behavior regresses | Medium | Accept reduced authenticated offline caching for privacy; keep static asset caching intact. |
| Auth state race during logout/user switch | High | Trigger cleanup on session user ID transition and sign-out paths; test user-switch ordering. |
| Review workload exceeds 400 changed lines | Medium | Keep the implementation centralized; split during tasks if tests plus auth/query/PWA changes exceed budget. |

## Rollback and Compatibility Notes

- Frontend rollback can restore the previous query persistence and Workbox runtime cache if a severe regression appears, but this reintroduces the privacy risk and should be treated as temporary.
- Static PWA asset caching should remain compatible; the primary compatibility concern is removing or renaming the `supabase-api` runtime cache and cleaning previously stored entries.
- Existing users may already have persisted query data or Cache Storage entries. The implementation should include a one-time cleanup path during app startup/session transition if practical.
- No database migration rollback is expected because this proposal does not change schema or RLS.

## Expected Validation

- Run targeted RED/GREEN tests for query persistence filtering and auth logout/user-switch cleanup.
- Run or add tests around `AuthProvider` sign-out/session change behavior.
- Validate Workbox config no longer caches Supabase REST authenticated responses, or that any retained caching is demonstrably session-safe.
- Run full test suite: `npm test`.
- Manual browser check: log in as user A, load sensitive business data, log out, log in as user B on the same browser, and confirm user A's data is not visible from TanStack Query cache, `localStorage`, or Cache Storage.

## Review Workload Forecast

| Field | Estimate |
|---|---|
| Estimated changed lines | 200–400 lines if centralized; 400+ if broad feature-specific query-key changes are needed. |
| Main drivers | Query persistence refactor, auth lifecycle cleanup, Workbox config change, tests. |
| 400-line budget risk | Medium. |
| Chained PR forecast | Likely one PR if persistence is deny-by-default and cleanup is centralized; chained PRs may be needed if tasks require feature-by-feature query-key allowlisting. |

## Success Criteria

SDD 4 succeeds when a shared or public device cannot retain or replay sensitive CarpinteroPro workshop data through TanStack Query persistence, `localStorage`, or service worker API caches after logout or user switch, while harmless UI preferences continue to work and the app's static PWA behavior remains intact.

## Phase Result Envelope

| Field | Value |
|---|---|
| **status** | `proposal_complete` |
| **executive_summary** | Harden browser-side cache/privacy by replacing broad query persistence with a safe strategy, clearing tenant/business data on logout and user switch, and removing or securing Supabase REST Workbox runtime caching. |
| **artifacts** | `openspec/changes/sdd-4-cache-pwa-privacy/proposal.md` |
| **next_recommended** | Continue to SDD 4 spec to define exact query persistence rules, cache purge API, auth lifecycle hooks, Workbox changes, and TDD test cases. |
| **risks** | Sensitive key omissions, service worker cache compatibility, auth user-switch races, preference deletion regressions, and possible 400-line review-budget pressure. |
| **skill_resolution** | `none` |
