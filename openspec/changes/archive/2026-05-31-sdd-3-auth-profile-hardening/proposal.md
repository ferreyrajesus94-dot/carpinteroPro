# SDD 3 Proposal — Auth/Profile Hardening

Make authenticated profile failures explicit, recoverable, and fail-closed. Today, `AuthProvider` silently converts profile query errors, missing profile rows, and RLS denials into `null` `workshopId` / `onboardedAt`, which can produce empty app data, partial UI, or onboarding loops. SDD 3 should introduce a clear auth/profile state contract, retry/recovery UX, and tests for the failure paths before changing behavior.

## Intent

Protect authenticated users from broken or ambiguous app states when their profile/workshop context cannot be loaded.

The app should never render protected workshop data when the authenticated profile state is inconsistent. Instead, it should explain that the workspace profile could not be loaded and offer safe recovery actions.

## Proposed Direction

| Area | Proposal |
|---|---|
| Auth state contract | Extend `AuthContextValue` with an explicit `status` and `profileError`/`profileIssue` value. |
| Profile load failures | Treat Supabase profile query errors as auth/profile errors, not as empty profile data. |
| Missing profile row | Treat authenticated user + missing `profiles` row as a distinct recovery state, not as onboarding-needed. |
| Retry | Run one safe automatic retry for transient profile load failure, then expose a manual retry action. |
| App shell behavior | Fail closed: block protected app content while profile state is inconsistent. |
| Recovery UX | Show an auth/profile recovery screen with retry, logout, and support guidance. |
| Cache/privacy | Keep broad query cache and PWA privacy cleanup for SDD 4 unless a minimal logout hook is necessary for correctness. |

## Scope

### In scope

1. **Auth/profile state contract**
   - Add explicit state to the auth context, for example:
     - `initializing`
     - `unauthenticated`
     - `profile_loading`
     - `ready`
     - `profile_error`
     - `profile_missing`
   - Preserve `session`, `workshopId`, `onboardedAt`, `signOut`, and `refreshProfile` compatibility where practical.

2. **Profile error detection**
   - Detect Supabase query errors from `profiles` lookup.
   - Detect missing profile row separately from profile rows with incomplete onboarding.
   - Avoid silently clearing `workshopId` in ways that make the app look empty but healthy.

3. **Retry and recovery**
   - Attempt one automatic retry for transient profile load failures.
   - Expose manual retry through `refreshProfile` or a dedicated retry action.
   - Keep retry bounded to avoid infinite loops.

4. **Fail-closed app shell**
   - Update `AppLayout` so protected app routes do not render when auth/profile state is `profile_error` or `profile_missing`.
   - Show an explicit recovery/support screen with Spanish user-facing copy.
   - Keep normal redirects for unauthenticated users and incomplete onboarding when profile is valid.

5. **Tests**
   - Add strict TDD coverage for:
     - profile query error;
     - missing profile row;
     - one automatic retry then recovery state;
     - manual retry success;
     - app shell recovery screen;
     - authenticated profile inconsistency blocking protected content.

### Out of scope

- Full query cache/PWA privacy hardening; that belongs to SDD 4.
- OAuth-specific signup/legal-metadata edge cases while OAuth is not active.
- Backend profile trigger redesign unless later phases prove it is the root cause.
- Multi-device/session concurrency semantics.
- Database schema or RLS policy changes unless a test reveals a required small fix.
- Large visual redesign of the app shell.

## Proposed Auth/Profile State Contract

The exact type should be finalized in spec/design, but the implementation should make these states distinguishable:

| State | Meaning | App behavior |
|---|---|---|
| `initializing` | Initial session restoration is running. | Show loading status. |
| `unauthenticated` | No session exists. | Redirect to `/login`. |
| `profile_loading` | Session exists and profile is being loaded/retried. | Show loading status; do not render protected data. |
| `ready` | Session and profile are valid. | Continue normal onboarding/billing/app gates. |
| `profile_missing` | Session exists but no profile row was found. | Show recovery screen; do not redirect to onboarding. |
| `profile_error` | Profile lookup failed due to network/RLS/Supabase error after bounded retry. | Show recovery screen. |

Compatibility note: `loading` can remain temporarily as a derived boolean for existing callers, but `status` should become the authoritative contract.

## Retry Approach

1. On initial session restore or auth sign-in, load the profile.
2. If the profile query returns an error, retry once automatically.
3. If the retry fails, set `profile_error` with a user-safe message and keep protected content blocked.
4. Manual retry should re-run profile loading and transition to `ready` if successful.
5. Missing profile row should not be retried indefinitely; it should become `profile_missing` and rely on retry/logout/support actions.

## Missing-Profile UX Direction

When an authenticated session exists but the profile row is missing, show a dedicated recovery screen instead of routing to onboarding.

Recommended copy direction:

- Title: `No pudimos cargar tu perfil de taller`
- Body: explain that the session is active but the workshop profile could not be found or loaded.
- Actions:
  - `Reintentar`
  - `Cerrar sesión`
  - support guidance such as contacting support with the account email.

This prevents a misleading onboarding loop and gives support a clear failure mode.

## Affected Areas

| File | Expected impact |
|---|---|
| `src/shared/providers/AuthProvider.tsx` | Add profile state contract, bounded retry, profile error/missing handling, manual retry behavior. |
| `src/shared/providers/AuthProvider.test.tsx` | Add RED/GREEN tests for profile error, missing profile, retry, and recovery transitions. |
| `src/app/layouts/AppLayout.tsx` | Block protected app content and render recovery UI for profile error/missing states. |
| `src/app/layouts/AppLayout.test.tsx` | Cover fail-closed app shell behavior. |
| `src/shared/hooks/useWorkshopId.ts` | Review whether returning `''` remains safe once auth/profile error state exists. |
| `src/shared/lib/queryClient.ts` | Only if a minimal logout correctness hook is needed; otherwise defer to SDD 4. |

## Acceptance Criteria

- [ ] Auth context exposes an explicit profile/auth status contract.
- [ ] Profile query errors do not silently become `workshopId = null` with healthy UI.
- [ ] Authenticated users with missing profile rows see a recovery/support state, not onboarding redirect.
- [ ] Protected app data is not rendered while auth/profile state is inconsistent.
- [ ] One bounded automatic retry occurs for transient profile load errors.
- [ ] Manual retry can recover from a transient failure without full page reload.
- [ ] Logout remains available from the recovery state.
- [ ] Existing happy paths still pass: login, session restore, onboarding redirect for valid not-onboarded profile, and normal app shell rendering.
- [ ] Tests document RED → GREEN → TRIANGULATE evidence in apply progress.
- [ ] `npm test`, targeted auth/layout tests, lint, and build pass before verify.

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---:|---|
| Breaking existing auth consumers by changing context shape | High | Keep compatible fields and add `status` rather than replacing everything at once. |
| Incorrectly classifying not-onboarded users as profile errors | High | Define missing row vs. valid row with `onboarded_at = null` clearly in tests. |
| Retry race between sign-in/sign-out/profile load | Medium | Guard state updates against stale user/session IDs in design/apply. |
| Recovery screen blocks valid users because of transient network blips | Medium | One auto retry plus manual retry; copy explains temporary failure. |
| Scope creep into SDD 4 cache privacy | Medium | Defer broad cache clearing/persistence changes unless strictly required for logout correctness. |
| Review workload exceeds 400 changed lines | Medium | Split implementation if AuthProvider + AppLayout + tests exceed forecast. |

## Rollback Plan

- Revert SDD 3 auth/profile changes to restore the previous `AuthProvider` and `AppLayout` behavior.
- Because the proposal avoids schema/RLS changes, rollback should be frontend-only unless later phases explicitly add backend work.
- Keep tests in the same work unit as behavior changes so rollback is clear and reviewable.

## Review Workload Forecast

| Field | Estimate |
|---|---|
| Estimated changed lines | 250–450 lines |
| Main drivers | AuthProvider state/retry logic, AuthProvider tests, AppLayout recovery UI/tests |
| 400-line budget risk | Medium |
| Chained PR recommendation | Auto-forecast during tasks/design; likely one PR if recovery UI stays small, split if cache/logout or broad hook changes are added. |
| Suggested split if needed | PR A: AuthProvider state contract + tests. PR B: AppLayout recovery UI + integration tests. |

## Success Criteria

SDD 3 succeeds when profile load failures are visible, recoverable, and fail-closed: authenticated users with broken profile state cannot accidentally access protected workshop UI, are not misrouted into onboarding loops, and have clear retry/logout/support actions. Existing happy-path auth, onboarding, and billing gates must continue to work.

## Result Contract

| Field | Value |
|---|---|
| status | `proposal_complete` |
| artifacts | `openspec/changes/sdd-3-auth-profile-hardening/proposal.md` |
| next_recommended | Run SDD 3 spec to turn the state contract, retry behavior, recovery UX, and tests into exact requirements. |
| skill_resolution | `paths-injected` via `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md`. |
