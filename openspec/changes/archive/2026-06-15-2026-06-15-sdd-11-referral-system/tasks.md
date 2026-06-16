# Tasks: Referral System (SDD-11)

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

5 stacked PRs to main, ~1,760 total, 300-390 per WU.

## Phase 1: WU1 — Schema + RLS + DB Types

- [x] 1.1 RED `supabase/tests/referral_rls_test.sql` — RLS on 4 tables, no auth policies, FKs, lower(code) unique
- [x] 1.2 Migrations `20260615000001..5` — 4 new tables + subscription audit cols; each with `DO $$` assertion
- [x] 1.3 `src/shared/types/database.ts` — 4 new tables + Insert/Update w/ `Relationships: []`
- [x] 1.4 VERIFY `supabase db reset`+SQL green; auth `SELECT` on `youtubers` → 0

## Phase 2: WU2 — Signup Attribution + First-Period Discount

- [x] 2.1 RED `tests/features/auth/signupReferral.test.ts` — `?ref=CODE` populates metadata; no `?ref` omits key
- [x] 2.2 `LoginPage.tsx`+`signUpWithEmail` — read `useSearchParams().get('ref')`, pass `referral_code` in `options.data`
- [x] 2.3 RED `supabase/tests/handle_new_user_referral_test.sql` — valid inserts; case-insensitive; inactive/unknown/self-referral skip with `code_attribution_skipped`
- [x] 2.4 Extend `handle_new_user` trigger — read meta, lower(code), is_active, email vs youtubers.contact_email, insert
- [x] 2.5 RED `create-subscription/_tests/discount.test.ts` — referred 20% → 3992; inactive/unreferred → 4990; existing preapproval returns init_point
- [x] 2.6 `create-subscription/index.ts` — load `workshop_referrals`+`referral_codes`; `round(4990*(1-pct/100),2)`; upsert audit cols on fresh preapproval
- [x] 2.7 VERIFY `?ref=PROMO20` lands attribution; matching email logs `reason=self_referral`; sub discount=20

## Phase 3: WU3 — Webhook Commission Recording

- [x] 3.1 RED `tests/supabase/functions/mercadopagoWebhookCommissions.test.ts` — 10 tests: approved+referred insert; 3992 discounted; failed/unreferred skip; duplicate → 23505 caught, 200; preapproval.updated skips; computeCommissionAmount + buildCommissionRecord pure functions
- [x] 3.2 `mercadopago-webhook/index.ts` `authorized_payment` branch — lookup attribution after update; if `approved`, record commission via helper; catch 23505 → log+200
- [x] 3.3 REFACTOR `recordCommissionIfReferred(...)` extracted to `commissions.ts` with `computeCommissionAmount`, `buildCommissionRecord`, and `SupabaseQuery` interface
- [x] 3.4 VERIFY 405/405 tests pass (64 files); safety net 28/28 preserved; 10 new commission tests all green

## Phase 4: WU4 — Admin UI: Youtubers + Codes

- [x] 4.1 RED contract tests for 3 admin Edge Functions — non-admin 403; happy; duplicate code 409; pct>100 400
- [x] 4.2 Create 3 Edge Functions with `requirePlatformAdmin`+`serviceClient()`; aggregations: `codeCount`, `activeReferredWorkshops`, `lifetimeCommission`
- [x] 4.3 RED `ReferidosPage.test.tsx` — table shows aggregated cols; toggle triggers `ConfirmDialog` "Desactivar este YouTuber?..."; "Crear YouTuber" opens dialog
- [x] 4.4 `api/referrals.ts` typed wrappers (POST to Edge Functions only); `hooks/useReferrals.ts` TanStack Query
- [x] 4.5 `ReferidosPage.tsx` with `YoutubersTab`+`CodesPanel`; `YoutuberDialog.tsx`; nav + lazy route
- [x] 4.6 VERIFY nav admin only; non-admin → `/`; create→toggle→deactivate E2E; duplicate rejected

## Phase 5: WU5 — Commissions + Tenant Message + E2E — FINAL (All 28 tasks complete)

- [x] 5.1 RED 13 contract tests for `admin-referral-commissions` — validation + CSV generation + mapping
- [x] 5.2 `admin-referral-commissions/index.ts` + `mapping.ts` with `requirePlatformAdmin`+`serviceClient()`; CSV content-disposition attachment
- [x] 5.3 `CommissionsTab` with date pickers, YouTuber filter, Export CSV button, 8 component tests
- [x] 5.4 RED 4 discount tests in `BillingSettingsCard.test.tsx` — first period shows line; second hides; null → no line; trialing+active
- [x] 5.5 `BillingSettingsCard.tsx` shows line when `first_period_discount_pct != null` AND within 45-day window
- [x] 5.6 `tests/e2e/admin/referral-commissions.spec.ts` + `tests/e2e/billing/referral-discount.spec.ts` (Playwright)
- [x] 5.7 VERIFY 70 suites passing, 469 tests, no regressions, E2E prescriptive
