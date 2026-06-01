# SDD 3 Design — Auth/Profile Hardening

Make auth/profile failures explicit, recoverable, and fail-closed while preserving current auth consumers. The implementation should add a small state contract to `AuthProvider`, route inconsistent profile states to a recovery screen in `AppLayout`, and keep broad cache/PWA privacy cleanup for SDD 4.

## Status

`design_complete`

## Design Decisions

| Area | Decision |
|---|---|
| Auth contract | Add `status` plus `profileIssue` to `AuthContextValue`; keep existing fields compatible. |
| Profile lookup | Treat query errors as `profile_error`; treat no profile row as `profile_missing`. |
| Retry | One automatic retry per load cycle for query errors only; manual retry uses `refreshProfile()`. |
| Fail closed | `AppLayout` blocks protected content for `profile_error` and `profile_missing`. |
| UI boundary | Split layout gating from the authenticated shell to avoid calling billing hooks while profile state is inconsistent. |
| `useWorkshopId` | Leave as `workshopId ?? ''` for this SDD; `AppLayout` will fail closed before protected children rely on it. |
| Cache cleanup | Defer to SDD 4; do not touch `queryClient.ts` unless implementation discovers a correctness blocker. |

## Target TypeScript Contract

Add these exported types near `AuthContextValue` in `src/shared/providers/AuthProvider.tsx`:

```ts
export type AuthStatus =
  | "initializing"
  | "unauthenticated"
  | "profile_loading"
  | "ready"
  | "profile_missing"
  | "profile_error";

export type ProfileIssueKind = "missing_profile" | "query_error";

export interface ProfileIssue {
  kind: ProfileIssueKind;
  title: string;
  message: string;
  retryable: boolean;
}
```

Extend `AuthContextValue` compatibly:

```ts
interface AuthContextValue {
  session: Session | null;
  workshopId: string | null;
  onboardedAt: string | null;
  loading: boolean; // derived compatibility flag
  status: AuthStatus;
  profileIssue: ProfileIssue | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
```

Compatibility rules:

- `loading` remains available and should be derived from `status === "initializing" || status === "profile_loading"`.
- Existing consumers can continue reading `session`, `workshopId`, `onboardedAt`, `signOut`, and `refreshProfile`.
- `status` becomes the authoritative source for app-shell decisions.
- `profileIssue` stores user-safe copy only. Do not expose raw Supabase error messages to the UI.

## Profile Loading Model

Implement a single internal loader that owns profile state transitions:

```ts
async function loadProfileForSession(
  nextSession: Session,
  options?: { allowAutoRetry?: boolean },
): Promise<void>
```

Recommended query shape:

```ts
const { data, error } = await supabase
  .from("profiles")
  .select("workshop_id, onboarded_at")
  .eq("id", userId)
  .maybeSingle();
```

Why `maybeSingle()`:

- It lets the app distinguish a missing row (`data === null`, `error === null`) from provider/query failures.
- If a Supabase/RLS condition manifests as hidden rows rather than an explicit error, it still becomes `profile_missing`, which is fail-closed.

Profile result rules:

| Query result | Status | State |
|---|---|---|
| `{ error }` then auto retry succeeds | `ready` | Set `workshopId`/`onboardedAt`, clear `profileIssue`. |
| `{ error }` then auto retry fails | `profile_error` | Clear `workshopId`/`onboardedAt`, set query issue. |
| `{ data: null, error: null }` | `profile_missing` | Clear `workshopId`/`onboardedAt`, set missing issue. |
| Valid row with `onboarded_at: null` | `ready` | Set `workshopId`, keep `onboardedAt = null`; `AppLayout` routes to onboarding. |
| Valid row with `onboarded_at` | `ready` | Normal app/billing flow. |

User-safe issue copy:

| Issue | Title | Message |
|---|---|---|
| `missing_profile` | `No pudimos encontrar tu perfil de taller` | `Tu sesión está activa, pero no encontramos el perfil asociado a tu cuenta. Reintentá o cerrá sesión. Si continúa, contactá a soporte con el email de tu cuenta.` |
| `query_error` | `No pudimos cargar tu perfil de taller` | `Hubo un problema al cargar la información de tu taller. Reintentá en unos segundos o cerrá sesión para volver a ingresar.` |

## State Transition Model

| Event | Current | Next | Notes |
|---|---|---|---|
| Provider mounts | initial React state | `initializing` | `session = null`, profile fields null. |
| `getSession()` returns no session | `initializing` | `unauthenticated` | Clear profile fields and issue. |
| `getSession()` returns session | `initializing` | `profile_loading` | Set session, start profile load. |
| Profile load succeeds with row | `profile_loading` | `ready` | Set profile fields. Valid not-onboarded users remain `ready`. |
| Profile load returns no row | `profile_loading` | `profile_missing` | Clear profile fields, set missing issue; no auto retry loop. |
| First profile load query error | `profile_loading` | `profile_loading` | Retry once in same load cycle. |
| Retry succeeds | `profile_loading` | `ready` | Clear issue. |
| Retry fails | `profile_loading` | `profile_error` | Set query issue. |
| `SIGNED_IN` event | any | `profile_loading` | Replace session and load new profile. |
| `SIGNED_OUT` event | any | `unauthenticated` | Clear session, profile fields, issue. |
| `refreshProfile()` in error/missing | `profile_error`/`profile_missing` | `profile_loading` | Manual retry; if success, `ready`; if no row, `profile_missing`; if error after one retry, `profile_error`. |
| `refreshProfile()` in ready | `ready` | `profile_loading` then `ready`/error | Existing behavior preserved but now explicit. |
| `signOut()` called | any | eventual `unauthenticated` | `supabase.auth.signOut()` remains source of auth event. |

## Race and Stale-Session Guards

Profile requests can resolve after sign-out, sign-in as another user, or a manual retry. Guard state updates with a monotonically increasing request id and the session user id.

Recommended refs:

```ts
const loadRequestIdRef = useRef(0);
const activeUserIdRef = useRef<string | null>(null);
```

Algorithm:

1. On any session change, increment `loadRequestIdRef.current`.
2. For session start/sign-in/manual retry, capture:
   - `const requestId = ++loadRequestIdRef.current`;
   - `const userId = nextSession.user.id`;
   - set `activeUserIdRef.current = userId`.
3. Before applying any async profile result, check:
   - `requestId === loadRequestIdRef.current`;
   - `activeUserIdRef.current === userId`.
4. On sign-out, increment `loadRequestIdRef.current`, set `activeUserIdRef.current = null`, and clear profile state.
5. If a stale profile load resolves, return without setting state.

This avoids a slow old profile load overwriting a newer login/logout state.

## AppLayout Boundary

Current `AppLayout` calls billing hooks at the top of the component before auth gate decisions. For fail-closed behavior and cleaner hook ordering, split it into two components:

```tsx
export function AppLayout() {
  const auth = useAuth();

  if (auth.status === "initializing" || auth.status === "profile_loading") {
    return <AppLoadingStatus label="Cargando sesión" />;
  }

  if (auth.status === "unauthenticated" || !auth.session) {
    return <Navigate to="/login" replace />;
  }

  if (auth.status === "profile_error" || auth.status === "profile_missing") {
    return <AuthProfileRecoveryScreen issue={auth.profileIssue} onRetry={auth.refreshProfile} onSignOut={auth.signOut} />;
  }

  if (!auth.onboardedAt) {
    return <Navigate to="/onboarding" replace />;
  }

  return <AuthenticatedAppShell auth={auth} />;
}
```

`AuthenticatedAppShell` contains the existing theme, location, navigation, billing, shell, and FAB logic. It should only be reached when `status === "ready"`, `session` is non-null, and onboarding is complete.

Benefits:

- Billing hooks do not run for missing/error profile states.
- Protected workshop UI cannot render while profile state is inconsistent.
- Hook order remains valid because each component has stable unconditional hooks internally.

## Recovery UI Direction

Create a small internal component in `AppLayout.tsx` unless design/tasks decide it deserves `src/shared/components/` reuse:

```tsx
function AuthProfileRecoveryScreen({ issue, onRetry, onSignOut }: Props) { ... }
```

UX requirements:

- Full-screen centered card using existing design tokens/classes.
- Spanish copy.
- Accessible heading and buttons.
- Primary action: `Reintentar`.
- Secondary action: `Cerrar sesión`.
- Support guidance: mention contacting support with account email if the problem continues.
- Do not render app nav, billing gate, or feature content behind it.

Suggested visible copy:

- Heading from `issue.title`, default `No pudimos cargar tu perfil de taller`.
- Body from `issue.message`.
- Support line: `Si el problema continúa, contactá a soporte e indicá el email de tu cuenta.`
- Buttons: `Reintentar`, `Cerrar sesión`.

## `useWorkshopId` Decision

Leave `src/shared/hooks/useWorkshopId.ts` unchanged for SDD 3:

```ts
return workshopId ?? "";
```

Rationale:

- `AppLayout` will fail closed before protected routes render in `profile_error`/`profile_missing`.
- Existing hooks likely depend on an empty string to disable queries during unauthenticated/loading states.
- Changing this hook to throw or return a richer object would broaden the diff and create extra consumer churn.

Guardrail for implementation: auth/profile status must not be `ready` for missing/error profile states. That is the protection that makes the existing fallback safe.

## Test Strategy and RED/GREEN Mapping

Strict TDD applies. Add failure tests before implementation changes.

### AuthProvider tests

| Test | RED condition today | GREEN expectation |
|---|---|---|
| exposes explicit status while preserving fields | `status` missing | Context includes `status`, `profileIssue`, and existing fields. |
| restored session with valid profile becomes ready | `status` missing | `status === "ready"`, `workshopId` set, `loading === false`. |
| valid not-onboarded profile stays ready | currently only null inference | `status === "ready"`, `onboardedAt === null`. |
| missing profile row becomes profile_missing | today null workshop looks healthy | `status === "profile_missing"`, `profileIssue.kind === "missing_profile"`. |
| query error retries once then profile_error | today error ignored or crashes depending mock | profile query called twice, status `profile_error`, issue set. |
| query error then retry success becomes ready | no retry exists | profile query called twice, final `ready`. |
| manual retry recovers from missing/error | no issue state/manual transition | `refreshProfile()` transitions from error/missing to `ready` when data appears. |
| sign-out clears stale issue/profile | issue state absent | `SIGNED_OUT` sets `unauthenticated`, null profile fields, null issue. |
| stale load cannot overwrite newer logout/sign-in | no guard exists | old promise resolution does not change latest auth state. |

Mock helper changes:

- Replace `mockProfileQuery(workshopId)` with helpers that return full Supabase-shaped results:
  - `{ data: { workshop_id, onboarded_at }, error: null }`;
  - `{ data: null, error: null }` for missing;
  - `{ data: null, error: { message: "..." } }` for query error.
- Mock chain should include `.maybeSingle()` instead of `.single()` if implementation switches.

### AppLayout tests

The current `useAuth` mock returns a fixed object. Refactor the mock to read a mutable `mockAuthState` so each test can set a status.

| Test | RED condition today | GREEN expectation |
|---|---|---|
| profile_error shows recovery screen | no status handling | Heading/body visible, protected shell text absent, retry/logout buttons visible. |
| profile_missing shows recovery and not onboarding redirect | current null onboarded would redirect | Recovery screen visible instead of onboarding redirect. |
| retry button calls `refreshProfile` | no recovery button | Callback called once. |
| logout button calls `signOut` | no recovery button | Callback called once. |
| ready + not onboarded still redirects onboarding | could regress with new status | Valid row with `status: "ready"`, `onboardedAt: null` still navigates to onboarding. |
| billing hook not called for profile_error/missing | current top-level hook calls with null | `useSubscription` not called when recovery screen renders. |

Existing billing integration tests should continue to pass with `status: "ready"` in the default auth mock.

### Verification commands

- Targeted first: `npm test -- src/shared/providers/AuthProvider.test.tsx src/app/layouts/AppLayout.test.tsx`
- Full: `npm test`
- Static: `npm run lint`
- Build: `npm run build`

## Rollback Plan

No schema or backend changes are planned.

Rollback steps:

1. Revert AuthProvider state-contract/retry changes and associated tests.
2. Revert AppLayout boundary/recovery UI changes and associated tests.
3. Leave SDD artifacts as historical record if rollback happens after merge; otherwise update apply progress with rollback reason.

Because tests are kept with each behavior unit, rollback can target a single work unit if needed.

## Work Units and Commit Boundaries

| Unit | Commit candidate | Files | Done when | Rollback |
|---|---|---|---|---|
| 1 | `test(auth): cover profile failure states` | `AuthProvider.test.tsx` | RED tests demonstrate missing/error/retry gaps. | Remove new tests. |
| 2 | `feat(auth): add profile status and retry contract` | `AuthProvider.tsx`, `AuthProvider.test.tsx` | AuthProvider tests pass; existing fields preserved. | Revert provider + tests. |
| 3 | `test(layout): cover auth profile recovery gate` | `AppLayout.test.tsx` | RED tests show recovery screen/gating missing. | Remove new tests. |
| 4 | `feat(layout): fail closed on auth profile issues` | `AppLayout.tsx`, `AppLayout.test.tsx` | Layout tests pass; billing hooks not called in recovery states. | Revert layout + tests. |
| 5 | `docs(sdd): record SDD 3 apply evidence` | `openspec/.../apply-progress.md` | RED/GREEN/TRIANGULATE evidence recorded. | Remove/update artifact. |

Apply may combine Units 1+2 and Units 3+4 if the diff stays under budget, but tests should remain adjacent to the behavior they verify.

## Review Workload Forecast

| Field | Forecast |
|---|---|
| Estimated changed lines | 300–480 |
| Review budget | 400 changed lines |
| Budget risk | Medium |
| Main drivers | AuthProvider state machine/tests; AppLayout split/recovery UI/tests. |
| Auto-forecast split trigger | If implementation forecast or actual diff exceeds 400 changed lines, split into chained PRs. |
| Preferred split if needed | PR A: AuthProvider contract/retry/tests. PR B: AppLayout recovery gate/tests. |
| Scope guard | Do not include query cache/PWA cleanup, OAuth behavior, schema/RLS changes, or broad hook API migrations. |

## Open Questions for Tasks/Apply

- Exact support destination is not defined in current scope. Use copy-only support guidance unless a support route/email already exists and is trivial to link.
- If `getSession()` itself returns an error with no usable session, treat the user as unauthenticated for this SDD unless implementation discovers a reproducible profile-specific failure.
- If Supabase RLS hides a row as `data: null` with no explicit error, classifying it as `profile_missing` is acceptable because both states fail closed.

## Result Contract

| Field | Value |
|---|---|
| status | `design_complete` |
| artifacts | `openspec/changes/sdd-3-auth-profile-hardening/design.md` |
| next_recommended | Run SDD 3 tasks to break the design into implementation steps and final review workload forecast. |
| skill_resolution | `paths-injected` via `/home/elias/.config/opencode/skills/cognitive-doc-design/SKILL.md` and `/home/elias/.config/opencode/skills/work-unit-commits/SKILL.md`. |
