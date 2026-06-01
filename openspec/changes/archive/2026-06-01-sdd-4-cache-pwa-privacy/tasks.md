# SDD 4 Tasks — Cache/PWA Privacy

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 260–380 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR with 3 work-unit commits |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Implementation plan

### Work Unit 1 — Centralize cache privacy rules and remove durable sensitive query persistence
- **Objective:** Add one shared privacy module in `src/shared/lib/` and make TanStack Query persistence fail closed for tenant/business data.
- **Files likely touched:**
  - `src/shared/lib/cachePrivacy.ts` (new)
  - `src/shared/lib/cachePrivacy.test.ts` (new)
  - `src/shared/lib/queryClient.ts`
- **Tests first (RED):**
  1. Add `cachePrivacy.test.ts` cases proving:
     - `['quotes', workshopId]`, `['clients', workshopId]`, `['tasks', workshopId]`, `['materials', workshopId]`, `['stock_movements', materialId]`, `['price_history', materialId]`, `['price_history_all', workshopId, days]`, `['subscription', workshopId]`, settings/template keys are not persistable.
     - unknown query keys fail closed.
     - purge preserves only `theme`, `cp.palette`, `cp.density`, `cp.howto.*`, and `carpinteroPro.rememberedEmail`.
  2. Add/adjust a focused `queryClient` assertion showing current broad persistence behavior fails the spec.
- **Implementation (GREEN):**
  1. Add shared constants/helpers for preserved localStorage keys and deny-by-default query persistence classification.
  2. Update `queryClient.ts` to remove durable query persistence entirely, or keep the persister with an empty allowlist via `shouldDehydrateQuery` if removal is smaller/safer in-context.
  3. Export a shared purge entry point that clears in-memory query state plus legacy persisted query keys.
- **TRIANGULATE:** Add explicit cases for recipes, contract templates, workshop settings, and subscription-related keys found under `src/features/**/hooks/`.
- **REFACTOR:** Keep all privacy logic in `src/shared/lib/`; do not introduce feature-specific cleanup code.
- **Verification:** `npm test -- src/shared/lib/cachePrivacy.test.ts` (or project-equivalent focused run), then `npm test`.
- **Rollback notes:** Revert `cachePrivacy.ts`/`queryClient.ts` together; partial rollback can silently re-enable broad persistence.
- **Estimated changed-line risk:** 90–140 lines.

### Work Unit 2 — Purge sensitive browser state on logout, session removal, and authenticated user switch
- **Objective:** Wire the shared purge path into auth lifecycle boundaries without breaking fail-closed auth/profile behavior.
- **Files likely touched:**
  - `src/shared/providers/AuthProvider.tsx`
  - `src/shared/providers/AuthProvider.test.tsx`
  - `src/shared/lib/cachePrivacy.ts`
- **Tests first (RED):**
  1. Extend `AuthProvider.test.tsx` to fail on current behavior for:
     - startup legacy cleanup before restored protected state becomes `ready`;
     - `session = null` / `SIGNED_OUT` triggering purge and unauthenticated state;
     - `signOut()` invoking purge and `supabase.auth.signOut()`;
     - user A → user B session change purging before user B reaches ready state;
     - same-user token refresh not causing a false user-switch purge.
  2. Add assertions that stale profile loads still cannot overwrite unauthenticated or switched-user state.
- **Implementation (GREEN):**
  1. Import the shared purge helpers into `AuthProvider.tsx`.
  2. Run startup legacy cleanup during auth initialization.
  3. Trigger purge on sign-out and on unauthenticated auth-state transitions.
  4. Detect authenticated user-id changes and purge before loading/rendering the next user’s protected state.
  5. Keep cleanup best-effort/non-blocking so auth still fails closed if storage APIs throw.
- **TRIANGULATE:** Add cases for duplicate/idempotent purge calls from both `signOut()` and later auth callbacks if needed.
- **REFACTOR:** Preserve existing provider API shape; avoid moving auth logic into feature slices.
- **Verification:** `npm test -- src/shared/providers/AuthProvider.test.tsx`, then `npm test`.
- **Rollback notes:** Revert provider wiring and matching tests together; startup cleanup and logout cleanup should not be left half-integrated.
- **Estimated changed-line risk:** 120–170 lines.

### Work Unit 3 — Remove unsafe Supabase REST service-worker caching and verify legacy cache cleanup
- **Objective:** Ensure the PWA build no longer caches authenticated Supabase REST responses and legacy `supabase-api` cache entries are removed by the shared purge path.
- **Files likely touched:**
  - `vite.config.ts`
  - `vite.config.test.ts` or `src/shared/lib/cachePrivacy.test.ts`
  - `src/shared/lib/cachePrivacy.ts`
- **Tests first (RED):**
  1. Add a focused config/privacy assertion proving current `vite.config.ts` still defines `supabase-api` runtime caching.
  2. Add/extend purge tests proving `caches.delete('supabase-api')` is attempted and failures are tolerated.
- **Implementation (GREEN):**
  1. Remove the Workbox `runtimeCaching` rule for `https://*.supabase.co/rest/*` from `vite.config.ts`.
  2. Keep static asset precache behavior unchanged.
  3. Ensure the shared purge/legacy-cleanup path deletes `supabase-api` when Cache Storage is available.
- **TRIANGULATE:** Add one explicit regression assertion that no replacement Supabase REST runtime cache name exists.
- **REFACTOR:** Keep PWA privacy assertions narrow so future static caching changes stay easy to review.
- **Verification:** focused config/privacy test, app build smoke check if available, then `npm test`.
- **Rollback notes:** Re-adding API runtime caching reintroduces the privacy risk; only roll back with explicit size/incident approval.
- **Estimated changed-line risk:** 40–80 lines.

## Stop / ask rules before apply
- If actual diff forecast grows past **400 changed lines**, stop after the current RED/GREEN boundary and ask whether to split into chained PRs.
- If implementation reveals feature-by-feature query-key allowlisting is required instead of centralized deny-by-default persistence, pause and re-plan because the review budget likely becomes high risk.
- If removing query persistence or Supabase REST runtime caching causes product-required offline behavior to regress beyond the accepted design, stop and request a delivery decision before continuing.

## Suggested work-unit commit story
1. `test(cache): define privacy rules for query persistence and browser purge`
2. `feat(cache): centralize privacy purge and disable durable sensitive query cache`
3. `test(auth): cover logout and user-switch cache purge`
4. `feat(auth): purge sensitive browser state across session boundaries`
5. `chore(pwa): remove unsafe supabase runtime cache and verify cleanup`

## Final verification checklist
- `npm test`
- Manual browser check on one device: login as user A, load protected data, logout, login as user B, confirm no A data survives in UI/localStorage/Cache Storage.
- Confirm preserved keys still exist after logout: `theme`, `cp.palette`, `cp.density`, `cp.howto.*`, `carpinteroPro.rememberedEmail`.
