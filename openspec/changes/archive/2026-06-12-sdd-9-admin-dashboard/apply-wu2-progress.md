# SDD9 WU2 — Apply Progress

## Goal

Add server-side admin authorization and read-only cross-tenant admin Edge Function endpoints.

## Strict TDD Evidence

### RED phase

- The repository does not currently have a Supabase Edge Function test harness or Deno test setup.
- WU2 therefore used the approved fallback from `tasks.md`: implement with focused static validation plus a manual 401/403/admin-success checklist.
- Initial validation caught TypeScript/LSP issues while authoring new Edge Function files:
  - missing Deno declarations in the new shared helper;
  - implicit `any` callback parameters in `admin-overview` DTO mapping.
- Those failures served as the RED signal for the Edge Function typing contract before final validation.

### GREEN phase

1. **Shared admin authorization helper**: `supabase/functions/_shared/admin-auth.ts`
   - Added `requirePlatformAdmin(req)`.
   - Validates Bearer JWT through a user-scoped Supabase client using the anon key and request `Authorization` header.
   - Loads the caller's own `profiles.is_platform_admin` through normal RLS.
   - Returns 401 for missing/invalid JWT via `AdminAuthError`.
   - Returns 403 for authenticated non-admin callers.
   - Does not create/use the service-role client for cross-tenant reads before admin verification.

2. **Admin overview endpoint**: `supabase/functions/admin-overview/index.ts`
   - Adds read-only platform overview DTO.
   - Returns total workshops, workshops created in the last 30 days, subscription counts by status, and recent webhook failure count.
   - Does not expose raw tables wholesale.

3. **Admin workshops endpoint**: `supabase/functions/admin-workshops/index.ts`
   - Supports list/search and optional detail by `workshopId`.
   - Returns safe workshop summaries with profile count, onboarded profile count, and subscription status.
   - Returns 404 for unknown detail workshop.

4. **Admin subscriptions endpoint**: `supabase/functions/admin-subscriptions/index.ts`
   - Returns read-only subscription summaries across workshops.
   - Supports optional status filtering.
   - Does not expose cancel/retry/refund/plan-change actions.

5. **Admin support diagnostics endpoint**: `supabase/functions/admin-support-diagnostics/index.ts`
   - Returns recent billing webhook diagnostics.
   - Does not implement impersonation or destructive operations.

### REFACTOR phase

- Kept each endpoint explicit and DTO-shaped rather than sharing premature abstractions.
- Reused existing `_shared/auth.ts` `serviceClient()` only after `requirePlatformAdmin(req)` succeeds.
- Reused existing `_shared/response.ts` CORS/JSON/structured-error helpers.

## Manual authorization checklist

Run against locally served or deployed functions after setting Supabase Edge Function secrets:

```bash
# Missing JWT -> 401
curl -i -X POST "$SUPABASE_FUNCTIONS_URL/admin-overview"

# Non-admin JWT -> 403
curl -i -X POST "$SUPABASE_FUNCTIONS_URL/admin-overview" \
  -H "Authorization: Bearer $NON_ADMIN_JWT"

# Platform-admin JWT -> 200 overview DTO
curl -i -X POST "$SUPABASE_FUNCTIONS_URL/admin-overview" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_JWT"

# Workshops search
curl -i -X POST "$SUPABASE_FUNCTIONS_URL/admin-workshops" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"search":"Demo"}'

# Subscription status filter uses database spelling, e.g. cancelled
curl -i -X POST "$SUPABASE_FUNCTIONS_URL/admin-subscriptions" \
  -H "Authorization: Bearer $PLATFORM_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}'
```

## Validation

| Command | Result | Detail |
|---------|--------|--------|
| `lsp_diagnostics` on new Edge Function files | PASS | 0 diagnostics after fixes. |
| `lens_diagnostics mode=all` | PASS | Initial complexity/async-noise warnings were refactored; final run reported no issues across diagnosed files. |
| `npm test -- --runInBand` | FAIL | Invalid Vitest option; command mistake, not code failure. Corrected with `npm test`. |
| `npm test` | PASS | 50 files, 311 tests. |
| `npm run lint` | PASS | 0 errors, 6 pre-existing unrelated React Hook Form warnings. |
| `npx tsc --noEmit` | PASS | TypeScript compilation clean. |

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/_shared/admin-auth.ts` | NEW — platform admin authorization helper. |
| `supabase/functions/admin-overview/index.ts` | NEW — read-only platform overview endpoint. |
| `supabase/functions/admin-workshops/index.ts` | NEW — workshops list/search/detail endpoint. |
| `supabase/functions/admin-subscriptions/index.ts` | NEW — read-only subscription summary endpoint. |
| `supabase/functions/admin-support-diagnostics/index.ts` | NEW — read-only support diagnostics endpoint. |

## Review notes

- Fresh review found no blockers.
- The reviewer noted WU2 is larger than the original 220–380 line forecast and above the 400-line review-budget threshold when counted as raw new endpoint lines. This is accepted for the local WU2 implementation because the files are isolated Edge Function endpoints, but PR2 should explicitly call out the overrun or be split if reviewer load becomes a concern.
- Added a WU4 TODO above `ownerEmail: null` in `admin-workshops` because workshop-owner resolution is not defined in the current schema/UI contract.

## Residual risks

- Edge Function behavior is not covered by an automated Deno/Supabase function test harness yet; use the manual checklist above before deployment.
- `SUPABASE_ANON_KEY` must be available to the Edge Function runtime for JWT/profile verification before service-role access.
- WU2 adds endpoints only; no frontend admin route or UI invokes them until WU3/WU4/WU5.

## Out of scope (verified)

- No admin routes or screens implemented.
- No subscription mutations implemented.
- No impersonation implemented.
- No destructive admin actions implemented.
- Service-role key remains server-side only.
