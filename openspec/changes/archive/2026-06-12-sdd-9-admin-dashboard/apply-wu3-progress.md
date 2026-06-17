# SDD9 WU3 — Apply Progress

## Goal

Add lazy `/admin/*` route, dedicated admin layout, admin guard states, and a conditional admin entry point in the normal app shell.

## Strict TDD Evidence

### RED phase

- Added route/guard expectations for the admin shell before implementation:
  1. loading state while admin/auth profile status resolves;
  2. unauthenticated redirect to login;
  3. authenticated non-admin forbidden state;
  4. platform admin sees the dedicated admin layout;
  5. normal app shell hides admin navigation for non-admins and shows it for platform admins.
- Initial targeted validation failed before fixes:
  - `routes.test.tsx` had a type issue for `session: null` in the auth mock.
  - `AppLayout.test.tsx` found two admin links (desktop and mobile), requiring an `AllBy` assertion.

### GREEN phase

1. **Admin feature skeleton**
   - Added `src/features/admin/index.ts`.
   - Added `src/features/admin/routes.tsx`.
   - Added `src/features/admin/lib/adminNavigation.ts`.
   - Added `src/features/admin/components/AdminGuard.tsx`.
   - Added `src/features/admin/components/AdminLayout.tsx`.

2. **Admin route composition**
   - Added lazy `/admin/*` route in `src/app/router.tsx` under `AuthSessionLayout`.
   - Kept normal workspace routes under `AppLayout` unchanged.
   - Admin route uses a dedicated `AdminLayout` inside the admin feature.

3. **Admin guard states**
   - `AdminGuard` renders a loading status while auth/admin profile state resolves.
   - Unauthenticated users redirect to `/login`.
   - Authenticated non-admin users get a forbidden state.
   - Platform admins render the dedicated admin layout and placeholder page.
   - No admin data hooks are invoked in WU3.

4. **Conditional admin navigation**
   - Added desktop and mobile admin entry points in `AppLayout` only when `auth.isPlatformAdmin` is true.
   - Non-admin users do not see an admin link.

5. **Tests**
   - Added `src/features/admin/routes.test.tsx`.
   - Extended `src/app/layouts/AppLayout.test.tsx` for admin navigation visibility.

### REFACTOR phase

- Moved admin navigation constants/helpers to `src/features/admin/lib/adminNavigation.ts` to satisfy React Fast Refresh lint boundaries.
- Kept WU3 placeholders intentionally small. Real overview/workshop/billing/support data wiring remains WU4/WU5.

## Validation

| Command | Result | Detail |
|---------|--------|--------|
| `lsp_diagnostics` on WU3 TS/TSX files | PASS | 0 diagnostics after fixes. |
| `npm test -- src/features/admin/routes.test.tsx src/app/layouts/AppLayout.test.tsx` | PASS | 2 files, 18 tests. |
| `npm test` | PASS | 51 files, 316 tests. |
| `npm run lint` | PASS | 0 errors, 6 pre-existing unrelated React Hook Form warnings. |
| `npx tsc --noEmit` | PASS | TypeScript compilation clean. |
| Fresh review | PASS | No blockers; reviewer recommended adding the admin feature lint zone before WU4. |
| Final parent validation | PASS | `npm test` full suite passed (51 files, 316 tests); `npm run lint` passed with 0 errors; LSP diagnostics found 0 issues. |
| `lens_diagnostics mode=all` | WARNINGS | Existing/high-level complexity warnings remain in `AppLayout`, `router`, and `AppLayout.test`; no blocking errors. |

## Files changed

| File | Change |
|------|--------|
| `src/features/admin/index.ts` | NEW — public admin route export. |
| `src/features/admin/routes.tsx` | NEW — nested admin routes behind guard/layout. |
| `src/features/admin/components/AdminGuard.tsx` | NEW — loading/login/forbidden/allowed guard states. |
| `src/features/admin/components/AdminLayout.tsx` | NEW — dedicated admin layout and placeholder page. |
| `src/features/admin/lib/adminNavigation.ts` | NEW — admin nav constants. |
| `eslint.config.js` | MODIFY — add `featureZone("admin")` boundary enforcement. |
| `src/features/admin/routes.test.tsx` | NEW — admin route/guard tests. |
| `src/app/router.tsx` | MODIFY — lazy `/admin/*` route. |
| `src/app/layouts/AppLayout.tsx` | MODIFY — conditional admin entry point. |
| `src/app/layouts/AppLayout.test.tsx` | MODIFY — admin nav visibility coverage. |

## Review notes

- Fresh review found no blockers.
- Added `featureZone("admin")` to `eslint.config.js` after review so future admin code is covered by feature-boundary lint rules.
- Removed the unused `isActiveAdminRoute` helper from `adminNavigation.ts`.

## Residual risks

- Admin screens still show placeholders; real overview/workshops/billing/support UI is WU4/WU5.
- `AppLayout` remains a large pre-existing shell with complexity warnings; WU3 kept the change minimal rather than refactoring the app shell broadly.
- Admin guard currently shows forbidden for profile error/missing states because admin status cannot be trusted without a loaded profile. This is fail-closed.

## Out of scope (verified)

- No admin data hooks or frontend API clients implemented.
- No overview/workshop/billing/support screens beyond placeholders.
- No impersonation, mutations, or destructive operations.
- No Edge Function changes beyond WU2.
