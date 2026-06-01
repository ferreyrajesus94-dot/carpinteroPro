# SDD 4 Design — Cache/PWA Privacy

## Current architecture findings

- `src/shared/lib/queryClient.ts` creates the singleton TanStack `QueryClient` and immediately enables `persistQueryClient` with a sync `localStorage` persister for 24 hours. There is no `shouldDehydrateQuery` filter, so all successful query data can be durably persisted.
- `vite.config.ts` configures Workbox `runtimeCaching` for `https://*.supabase.co/rest/*` with `NetworkFirst` and cache name `supabase-api`. Authenticated Supabase REST responses can therefore be stored in Cache Storage.
- `src/shared/providers/AuthProvider.tsx` owns the auth lifecycle. It restores the initial session, subscribes to `onAuthStateChange`, loads the profile, and clears auth/profile state on unauthenticated transitions. It does not clear TanStack Query state, persisted query storage, app localStorage business data, or legacy service-worker caches. It also treats any authenticated session as loadable without detecting user-id switches as cache privacy boundaries.
- `src/features/auth/components/ProfilePage.tsx` calls `useAuth().signOut()` then navigates to `/login`; sign-out cleanup should remain centralized in the provider/shared helper so this component likely needs no behavior-specific logic.
- `src/shared/providers/AuthProvider.test.tsx` already covers initial session restore, session removal, stale profile-load protection, profile errors, and `signOut`. It is the best place to add lifecycle purge tests.
- `src/app/layouts/AppLayout.test.tsx` covers protected-shell fail-closed behavior for auth/profile/billing states. It can host a narrow stale protected data regression if needed, but most cache privacy behavior should be tested closer to `AuthProvider` and shared cache helpers.
- Representative sensitive query hooks are tenant/business-scoped and must not be persisted: quotes (`src/features/quotes/hooks/useQuotes.ts`), contract templates (`src/features/quotes/hooks/useContractTemplates.ts`), CRM clients (`src/features/crm/hooks/useClients.ts`), tasks (`src/features/tasks/hooks/useTasks.ts`), inventory materials/stock/price history (`src/features/inventory/hooks/*`), workshop settings (`src/features/settings/hooks/useWorkshopSettings.ts`), recipe templates (`src/features/recipes/hooks/useRecipes.ts`), and subscription state (`src/features/billing/hooks/useSubscription.ts`).

## Proposed architecture/API shape

Add one shared privacy module under `src/shared/lib/`, for example `src/shared/lib/cachePrivacy.ts`, because this is cross-feature infrastructure and should not live in any feature slice.

Proposed exported contract:

```ts
export const PRESERVED_LOCAL_STORAGE_KEYS = [
  'theme',
  'cp.palette',
  'cp.density',
  'carpinteroPro.rememberedEmail',
] as const

export function isPreservedLocalStorageKey(key: string): boolean
export function isPersistableQueryKey(queryKey: readonly unknown[]): boolean
export async function purgeSensitiveBrowserState(reason: CachePrivacyPurgeReason): Promise<void>
export async function purgeLegacyCachePrivacyState(): Promise<void>
```

Design decisions:

- `isPersistableQueryKey` is deny-by-default. Initially it should return `false` for every query key unless a future spec adds a proven non-sensitive allowlist. This avoids fragile per-feature sensitive-key maintenance.
- `purgeSensitiveBrowserState` is best-effort and non-throwing from callers' perspective: it should attempt all cleanup steps, tolerate unavailable `localStorage`/`caches`, and never keep the app authenticated because cleanup failed.
- The purge helper should clear:
  - in-memory TanStack Query cache via the singleton `queryClient.clear()`;
  - legacy TanStack persisted cache keys, especially the default sync persister key (`REACT_QUERY_OFFLINE_CACHE`) and any project-specific query persistence key introduced by the implementation;
  - CarpinteroPro business/cache localStorage keys while preserving exactly `theme`, `cp.palette`, `cp.density`, `cp.howto.*`, and `carpinteroPro.rememberedEmail`;
  - legacy Cache Storage entries such as `supabase-api`.
- Do not add feature-specific purge calls. Feature hooks remain unchanged because privacy is enforced centrally by query persistence policy plus full cache purge.

## TanStack Query persistence strategy

Preferred implementation: remove durable query persistence entirely for SDD 4. Static PWA caching can still support fast app-shell loads, but authenticated business data should not be serialized to `localStorage`.

If keeping the persistence package is necessary for compatibility, configure dehydration with `shouldDehydrateQuery: ({ query }) => isPersistableQueryKey(query.queryKey)`, where the allowlist is empty at first. Either approach satisfies deny-by-default; removing persistence is smaller and safer.

`queryClient.ts` should continue to export the singleton `queryClient`, but persistence side effects should either be deleted or guarded by the deny-by-default helper. The cleanup module may import this singleton to call `queryClient.clear()`.

## Auth lifecycle integration strategy

Integrate cleanup in `AuthProvider.tsx` without changing feature components:

1. On startup/auth initialization, call `purgeLegacyCachePrivacyState()` before a restored authenticated session can reach `ready`. This removes pre-SDD-4 persisted query/cache data before protected UI can render stale content.
2. On `session = null`, call `purgeSensitiveBrowserState('session-removed')`, then clear auth/profile state as today. The UI must still transition unauthenticated if purge is partially unsuccessful.
3. In `signOut`, call the purge path as part of the requested logout and still call `supabase.auth.signOut()`. The later auth-state event can call the same purge idempotently.
4. Track the last authenticated user id. When a new authenticated session has a different user id than the active one, call `purgeSensitiveBrowserState('user-switch')` before setting the new session/profile state to ready or rendering protected UI. Same-user token refresh should not force an in-memory purge.
5. Preserve existing stale profile-load protection by incrementing `loadRequestIdRef` when unauthenticated or when a user switch invalidates the previous load.

## Service worker / Workbox strategy

- Remove the Supabase REST `runtimeCaching` rule from `vite.config.ts`; do not replace it with another authenticated API runtime cache.
- Keep Workbox static asset precache/glob behavior intact.
- Delete or neutralize the legacy `supabase-api` cache from the shared purge helper on startup, logout/session removal, and user switch. Use `globalThis.caches?.delete('supabase-api')` when available.
- If later offline business data support is required, it must be designed as a separate explicit encrypted/session-scoped offline feature, not as generic Workbox runtime caching.

## Tests-first plan

Use strict TDD with `npm test` as final evidence.

### RED

Add failing tests before implementation:

- `src/shared/lib/cachePrivacy.test.ts` (new):
  - sensitive keys (`['quotes', workshopId]`, `['clients', workshopId]`, `['tasks', workshopId]`, `['materials', workshopId]`, `['stock_movements', materialId]`, `['price_history', materialId]`, `['price_history_all', workshopId, days]`, `['subscription', workshopId]`, settings/templates) are not persistable;
  - unrecognized query keys are not persistable;
  - purge removes legacy query persistence keys and unknown CarpinteroPro business/cache keys while preserving exactly the approved preference keys and `cp.howto.*`;
  - purge deletes the legacy `supabase-api` Cache Storage entry and tolerates storage errors.
- `src/shared/providers/AuthProvider.test.tsx`:
  - initial startup calls legacy cleanup before restored session reaches `ready`;
  - `SIGNED_OUT`/`session = null` invokes purge and then unauthenticated state;
  - `signOut` requests purge and calls `supabase.auth.signOut`;
  - authenticated user A to user B invokes purge before B is ready;
  - same-user token refresh does not purge in-memory query state unnecessarily.
- `vite.config.test.ts` or a focused config assertion test:
  - no Workbox runtime caching rule targets Supabase REST and no `supabase-api` cache is configured.

At least one of these should fail against the current code because broad persistence and Workbox Supabase REST caching exist and auth cleanup is absent.

### GREEN

Implement the smallest centralized changes:

- Add `cachePrivacy.ts` helper and tests.
- Remove or deny-by-default TanStack Query persistence in `queryClient.ts`.
- Wire purge/legacy cleanup into `AuthProvider.tsx` lifecycle.
- Remove Supabase REST runtime caching from `vite.config.ts`.

### TRIANGULATE

Add explicit cases for additional observed query families (recipes/templates/settings) and for preserved-key exactness if the first implementation is too broad.

### REFACTOR

Keep helper names clear, keep storage access defensive, and avoid feature-specific imports from shared code. Do not migrate individual query hooks unless tests prove the centralized strategy is insufficient.

## Review workload forecast and split strategy

Estimated changed lines: 250–380 if implemented centrally.

Likely one PR/change set under the 400-line review budget:

1. cache privacy helper + unit tests;
2. queryClient persistence hardening;
3. AuthProvider lifecycle tests/integration;
4. Workbox config assertion/removal.

Split only if tests plus auth changes exceed the budget:

- PR A: query persistence policy, cachePrivacy helper, Workbox config cleanup.
- PR B: AuthProvider lifecycle integration and protected UI regression tests.

## Rollback and compatibility notes

- Rollback is frontend-only but would reintroduce the privacy risk if broad query persistence or Supabase REST runtime caching is restored.
- Existing users may already have `REACT_QUERY_OFFLINE_CACHE` and `supabase-api`; startup cleanup is required for compatibility with pre-SDD-4 installations.
- Removing authenticated REST caching may reduce offline behavior for business data. This is acceptable for privacy; static app-shell caching remains.
- The preserved localStorage keys are intentionally narrow. Future keys must be classified explicitly before being preserved through purge.
- No database migrations or RLS changes are expected.

## Open questions / decisions

- Decision: use deny-by-default with no persisted query data for SDD 4. Add a non-sensitive query persistence allowlist only in a future accepted spec.
- Decision: remove Workbox Supabase REST runtime caching rather than attempting session-scoped API caching.
- Open implementation detail: exact legacy localStorage key list should include the current TanStack default (`REACT_QUERY_OFFLINE_CACHE`) and any observed project-specific cache keys during implementation/testing.
