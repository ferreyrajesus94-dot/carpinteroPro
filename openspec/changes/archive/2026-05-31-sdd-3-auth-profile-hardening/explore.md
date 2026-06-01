# SDD 3 Explore — Auth/Profile Hardening

## Status

`explore_complete`

## Executive Summary

`AuthProvider` loads the user profile with no explicit error handling. If the profile query fails due to network errors, RLS denial, or a missing row, `workshopId` and `onboardedAt` silently become `null`. Downstream queries then receive an empty workshop id, and the user may see a broken partial UI or get stuck in redirect/onboarding loops. There is no retry path, no auth-specific error state, no fail-closed recovery screen, and no tests covering those failure paths.

The app has a generic router `errorElement`, but that does not cover auth/profile consistency failures inside the layout tree.

## Current Auth/Profile Flow

| Step | File | Behavior |
|---|---|---|
| 1. Session init | `src/shared/providers/AuthProvider.tsx` | Calls `supabase.auth.getSession()`, then `loadProfile(session.user.id)` if session exists. |
| 2. Profile load | `AuthProvider.loadProfile()` | Queries `profiles` for `workshop_id, onboarded_at`. Sets state directly from `data?.workshop_id` and `data?.onboarded_at` with no error handling. |
| 3. Auth state change | `AuthProvider` useEffect | Subscribes to `onAuthStateChange`; on `SIGNED_IN`, reloads profile; on `SIGNED_OUT`, clears state. |
| 4. App shell gate | `src/app/layouts/AppLayout.tsx` | If `loading` → spinner. If `!session` → `/login`. If `!onboardedAt` → `/onboarding`. Otherwise renders app. |
| 5. Workshop ID consumption | `src/shared/hooks/useWorkshopId.ts` | Returns `workshopId ?? ''`. Empty string disables downstream TanStack Query hooks that skip when empty. |
| 6. Query cache | `src/shared/lib/queryClient.ts` | Persists to `localStorage` with 24h TTL. No eviction on logout or user switch. |

## Failure States and Gaps

| Failure | Current Behavior | Desired Behavior for SDD 3 |
|---|---|---|
| Profile query network error | `data` is undefined, `workshopId` becomes null silently. App may show partial UI with empty workshopId. | Surface error to user; offer retry/logout. |
| Profile row missing | `workshopId` null, `onboardedAt` null. User redirects to `/onboarding` even if they already completed onboarding. | Detect missing profile explicitly; show support/recovery screen instead of onboarding loop. |
| RLS denial on profile SELECT | Same as missing — nulls silently. | Fail closed: treat as auth/profile error, not as "no profile". |
| Supabase auth session expired/invalid | `getSession()` may return null; user redirects to `/login`. | Mostly acceptable; proposal may consider clearer logged-out messaging. |
| Profile update failure from `markOnboarded` | Toast error only; local state recovery is not explicit. | Consistent error handling with state recovery. |
| OAuth signup without metadata | Trigger uses defaults; profile can exist without complete legal acceptance metadata. | Out of scope unless Google/OAuth is enabled. |

## Test Coverage Gaps

`src/shared/providers/AuthProvider.test.tsx` currently covers only happy paths:

- loading resolves with and without a session;
- workshop id loads from profile;
- no workshop id when profile lacks one;
- auth state change login/logout;
- unsubscribe on unmount;
- `useAuth` throws outside provider.

Missing tests:

- profile query returns `{ error }` for network/RLS/timeout failures;
- profile row missing entirely (`null` data with no query error);
- retry after transient failure;
- `refreshProfile` failure handling;
- race condition: rapid login/logout while profile query is in flight;
- authenticated `workshopId === null` / `''` downstream behavior.

`AppLayout` tests mock `AuthProvider`, so no integration-level auth failure coverage exists.

## Risks

| Risk | Severity | Notes |
|---|---|---|
| Silent profile failures leave users in broken state | Critical | No error state means no recovery path. |
| Missing profile causes onboarding redirect loop | High | If profile was deleted or trigger failed, the user can be routed to onboarding incorrectly. |
| Empty workshop id silently disables data queries | High | Feature hooks skip fetching, leaving empty UI with no explanation. |
| No retry on transient startup failure | Medium | One failed profile load can break the session until manual reload. |
| Query cache persists across logout | Medium | Belongs primarily to SDD 4, but relevant for auth hardening boundaries. |
| Generic route error element is insufficient | Medium | It does not catch auth/profile consistency states inside the layout tree. |

## Recommended Proposal Scope

1. Add explicit auth/profile status to `AuthContextValue`, distinguishing at least loading, unauthenticated, authenticated/profile ready, and profile error.
2. Add retry support for profile load, with at least a manual retry and likely one immediate retry for transient failures.
3. Detect missing profile explicitly when a session exists but no profile row is returned.
4. Add a fail-closed recovery screen for auth/profile errors with retry, logout, and support guidance.
5. Add tests for profile query error, missing profile, RLS denial, retry, and app shell fail-closed behavior.
6. Treat query-cache eviction on logout as either out of scope for SDD 4 or a small preparatory hook only if needed for auth correctness.

## Out of Scope Recommendation

- OAuth-specific edge cases while Google sign-in is not enabled.
- Multi-device/session concurrency.
- Backend auth trigger redesign, unless exploration in later phases proves the trigger is the root cause.
- Full cache/PWA privacy cleanup, which belongs to SDD 4.

## Files Preview

| File | Likely Change |
|---|---|
| `src/shared/providers/AuthProvider.tsx` | Add error state, retry logic, missing-profile detection. |
| `src/shared/providers/AuthProvider.test.tsx` | Add RED tests for failure paths. |
| `src/shared/hooks/useWorkshopId.ts` | Consider whether to propagate auth/profile error instead of returning only `''`. |
| `src/app/layouts/AppLayout.tsx` | Handle auth/profile error state with a recovery screen. |
| `src/app/layouts/AppLayout.test.tsx` | Add auth error → blocked/recovery screen tests. |
| `src/shared/lib/queryClient.ts` | Optional logout cache cleanup helper; likely SDD 4 unless needed now. |

## Checklist for Proposal Phase

- [ ] Confirm exact auth/profile states to expose.
- [ ] Decide retry strategy: immediate retry, exponential backoff, manual retry button, or combination.
- [ ] Decide missing-profile UX: explicit recovery screen versus onboarding redirect.
- [ ] Confirm whether `workshopId` should ever be null for an authenticated, profile-ready user.
- [ ] Check if downstream code relies on `useWorkshopId()` returning `''`.

## Result Contract

| Field | Value |
|---|---|
| status | `explore_complete` |
| artifacts | `openspec/changes/sdd-3-auth-profile-hardening/explore.md` |
| next_recommended | Run SDD 3 proposal to define scope, acceptance criteria, error-state contract, retry strategy, and missing-profile UX. |
| risks | Critical silent profile failure; high missing-profile loop; high empty-workshop query suppression; medium no retry/cache/logout privacy boundary. |
| skill_resolution | `paths-injected` via `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md`. |
