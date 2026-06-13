# SDD9 WU1 — Apply Progress

## Goal

Add platform-admin identity to existing profiles and expose current-user admin state safely.

## Strict TDD Evidence

### RED phase
- Added 4 new tests to `src/shared/providers/AuthProvider.test.tsx`:
  1. `isPlatformAdmin defaults to false when profile has no admin flag`
  2. `isPlatformAdmin is true when profile has is_platform_admin = true`
  3. `isPlatformAdmin is false when user is not authenticated`
  4. `isPlatformAdmin remains accessible after profile retry recovers`
- Updated `ProfileRow` mock type to include `is_platform_admin: boolean | null`
- **Result**: 4 tests failed — LSP errors confirmed `AuthContextValue` had no `isPlatformAdmin`; test runner confirmed 4 `undefined` values.

### GREEN phase
1. **Migration**: `supabase/migrations/20260612000000_admin_platform_flag.sql`
   - `ALTER TABLE profiles ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false;`
   - Documented bootstrap SQL for first platform admin.
   - Added `prevent_platform_admin_self_promotion()` and a `BEFORE UPDATE OF is_platform_admin` trigger so authenticated users cannot change the admin flag through the existing own-profile update policy.

2. **Database types**: `src/shared/types/database.ts`
   - Added `is_platform_admin: boolean` to `profiles.Row`.
   - Added `is_platform_admin?: boolean` to `profiles.Insert` and `profiles.Update`.
   - Preserved `Relationships: []` conventions.

3. **AuthProvider changes**: `src/shared/providers/AuthProvider.tsx`
   - Added `is_platform_admin` to internal `ProfileRow` interface.
   - Added `isPlatformAdmin` state (`useState(false)`).
   - Added `isPlatformAdmin` to `AuthContextValue`.
   - Updated `fetchProfile()` to select `"workshop_id, onboarded_at, is_platform_admin"`.
   - Updated success handler: `setIsPlatformAdmin(data.is_platform_admin ?? false)`.
   - Updated `clearProfileState()` to reset `setIsPlatformAdmin(false)`.
   - Updated missing-profile path to reset `setIsPlatformAdmin(false)`.

4. **AppLayout mock update**: `src/app/layouts/AppLayout.test.tsx`
   - Added `isPlatformAdmin: false` to `authMock.state`.

### REFACTOR phase
- No refactoring needed — changes are minimal and follow existing patterns precisely.

## Validation

| Command | Result | Detail |
|---------|--------|--------|
| `npm test` | PASS (50 files, 311 tests) | All 4 new admin tests pass alongside existing 307 tests |
| `npm run lint` | PASS (0 errors, 6 pre-existing warnings) | No new lint issues |
| `npx tsc --noEmit` | PASS (0 errors) | TypeScript compilation clean |
| Fresh review | PASS with hardening note | Reviewer found no blockers and noted the pre-existing broad own-profile update policy; parent addressed it by adding the self-promotion prevention trigger to the migration. |
| Hardening review | PASS | Fresh reviewer confirmed the trigger blocks authenticated self-promotion while preserving trusted SQL/service-role maintenance paths. |
| Final parent validation | PASS | `npm test` full suite passed (50 files, 311 tests); `npm run lint` passed with 0 errors and 6 pre-existing unrelated warnings; LSP diagnostics found 0 issues. |

## Files changed

| File | Change | Lines |
|------|--------|:-----:|
| `supabase/migrations/20260612000000_admin_platform_flag.sql` | NEW — migration + bootstrap docs + self-promotion prevention trigger | +56 |
| `src/shared/types/database.ts` | MODIFY — add `is_platform_admin` to profiles types | +3 |
| `src/shared/providers/AuthProvider.tsx` | MODIFY — extend ProfileRow, AuthContextValue, fetch, state | +13/-7 |
| `src/shared/providers/AuthProvider.test.tsx` | MODIFY — add 4 admin status tests + update ProfileRow | +54/-1 |
| `src/app/layouts/AppLayout.test.tsx` | MODIFY — add `isPlatformAdmin: false` to mock | +1 |

## Changed lines estimate

~145 changed lines (within 120-220 forecast).

## Residual risks

- `is_platform_admin` is a single boolean on profiles — if admin membership needs to become auditable later, migrate to a dedicated `platform_admin_memberships` table with `workshop_id` or redesign the project rule for platform tables.
- The self-promotion trigger has not been exercised by pgTAP/local SQL tests in this WU; verify during database migration review or Supabase local reset if available.
- No Edge Functions yet — admin data access requires WU2.
- No admin route guard yet — UI protection requires WU3.

## Out of scope (verified)

- No Edge Functions implemented.
- No admin routes or screens.
- No admin UI shell.
- No new tables created.
- Service-role key is not exposed in frontend.
