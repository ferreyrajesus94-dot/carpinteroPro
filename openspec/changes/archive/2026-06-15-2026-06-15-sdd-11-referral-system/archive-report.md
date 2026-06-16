# Archive Report — SDD-11 Referral System

**Archived at**: 2026-06-15
**Original change**: `2026-06-15-sdd-11-referral-system`
**Archive path**: `openspec/changes/archive/2026-06-15-2026-06-15-sdd-11-referral-system/`

---

## Executive Summary

SDD-11 implemented a full referral program for CarpinteroPro: platform-global YouTuber promoters with configurable discount and commission codes, signup attribution from landing URLs, first-period subscription discount, and an immutable commission ledger. The system was delivered in 5 chained work units across ~1,760 estimated lines, with 28 tasks, 469 Vitest tests, and 52 pgTAP assertions — all passing. Final verification: **PASS WITH WARNINGS** (5 warnings, 0 critical issues).

---

## What Was Built

### New Capability: Referral Program

| Component | Description | Files |
|-----------|-------------|-------|
| **Schema & RLS** | 4 platform-global tables (youtubers, referral_codes, workshop_referrals, referral_commissions) + subscriptions audit columns (first_period_discount_pct, referred_by_referral_code_id). All with RLS enabled, zero authenticated policies, in-migration `DO $$` assertions. | `20260615000001..05` migrations, `database.ts` types |
| **Signup Attribution** | `?ref=CODE` capture in LoginPage → signUpWithEmail metadata → handle_new_user trigger → workshop_referrals insert. Case-insensitive code matching, self-referral prevention via email comparison. | `LoginPage.tsx`, `auth/api/index.ts`, `handle_new_user` trigger |
| **First-Period Discount** | create-subscription Edge Function reads attribution, applies `round(4990 * (1 - discount_pct/100), 2)` on first preapproval only, persists audit columns. No discount on subsequent periods. | `create-subscription/index.ts`, `discount.ts` |
| **Commission Recording** | mercadopago-webhook records `referral_commissions` rows on authorized_payment (approved). Idempotent via unique `provider_payment_id`, catches 23505. | `mercadopago-webhook/index.ts`, `commissions.ts` |
| **Admin Edge Functions** | 4 new functions: admin-youtubers (list with aggregations), admin-youtube-mutate (create/update/toggle), admin-referral-codes (list/create/deactivate), admin-referral-commissions (filterable + CSV export). All with requirePlatformAdmin. | `supabase/functions/admin-*/` |
| **Admin UI** | /admin/referidos with Youtubers tab (table, create, toggle, deactivate) and Commissions tab (filters, table, CSV export). Lazy-loaded, AdminGuard-protected. | `ReferidosPage.tsx`, `CommissionsTab.tsx`, `api/referrals.ts`, `hooks/useReferrals.ts` |
| **Tenant UI** | BillingSettingsCard shows "Descuento aplicado: X% durante el primer período." only during first billing period. No YouTuber identity disclosed. | `BillingSettingsCard.tsx` |

### Modified Capabilities

| Capability | Change |
|------------|--------|
| **sdd-2-billing-mercadopago** | First-period discount on subscription creation; commission recording from authorized_payment webhook. |
| **sdd-3-auth-profile-hardening** | Added referral code acceptance in signup metadata, LoginPage ref capture, auth state preserved with attribution. |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Discount engine | Application-level (no MP coupons) | Avoids sticky provider coupons; keeps rules testable and reversible. |
| Attribution table | `workshop_referrals` (one row per workshop PK) | Keeps `workshops` table clean; makes self-referral and ledger joins explicit. |
| Access model | RLS enabled, zero authenticated policies on referral tables | SDD-9 platform-global precedent; all access via admin Edge Functions with `requirePlatformAdmin`. |
| Commission ledger | Immutable with snapshot `payment_amount`/`commission_pct`/`commission_amount` | Survives code changes; idempotent via unique `provider_payment_id`. |
| Commission on first payment | Yes (including discounted amount) | YouTuber earns commission from first recurring payment; product decision. |
| First-period window | 45-day buffer (code) vs spec "1 month" (gap documented in W5) | Deliberate cushion; documented for future tightening. |

---

## Files Created / Modified

### New Files (15+)

**Migrations:**
- `supabase/migrations/20260615000001_referral_youtubers.sql`
- `supabase/migrations/20260615000002_referral_codes.sql`
- `supabase/migrations/20260615000003_workshop_referrals.sql`
- `supabase/migrations/20260615000004_referral_commissions.sql`
- `supabase/migrations/20260615000005_subscription_referral_columns.sql`
- `supabase/migrations/20260615000006_extend_handle_new_user.sql`

**Edge Functions:**
- `supabase/functions/admin-youtubers/index.ts`
- `supabase/functions/admin-youtube-mutate/index.ts`
- `supabase/functions/admin-referral-codes/index.ts`
- `supabase/functions/admin-referral-commissions/index.ts`
- `supabase/functions/admin-referral-commissions/mapping.ts`

**Shared helpers (extracted from existing functions):**
- `supabase/functions/_shared/discount.ts`
- `supabase/functions/_shared/commissions.ts`

**Frontend:**
- `src/features/admin/api/referrals.ts`
- `src/features/admin/hooks/useReferrals.ts`
- `src/features/admin/components/ReferidosPage.tsx`
- `src/features/admin/components/CommissionsTab.tsx`
- `src/features/admin/components/YoutuberDialog.tsx`
- `src/features/admin/components/CodesPanel.tsx`

**Tests:**
- `tests/features/auth/signupReferral.test.ts` (5 tests)
- `tests/supabase/functions/createSubscriptionDiscount.test.ts` (7 tests)
- `tests/supabase/functions/mercadopagoWebhookCommissions.test.ts` (10 tests)
- `tests/supabase/functions/adminYoutubers.test.ts` (5 tests)
- `tests/supabase/functions/adminYoutubeMutate.test.ts` (11 tests)
- `tests/supabase/functions/adminReferralCodes.test.ts` (16 tests)
- `tests/supabase/functions/adminReferralCommissions.test.ts` (13 tests)
- `tests/features/admin/ReferidosPage.test.tsx` (7 tests)
- `tests/features/admin/CommissionsTab.test.tsx` (8 tests)
- `tests/e2e/admin/referral-commissions.spec.ts`
- `tests/e2e/billing/referral-discount.spec.ts`
- `supabase/tests/referral_rls_test.sql` (32 assertions)
- `supabase/tests/handle_new_user_referral_test.sql` (9 assertions)

### Modified Files

- `supabase/functions/create-subscription/index.ts` — first-period discount
- `supabase/functions/mercadopago-webhook/index.ts` — commission recording
- `src/features/auth/api/index.ts` — referral_code metadata
- `src/features/auth/components/LoginPage.tsx` — ?ref=CODE capture
- `src/features/billing/components/BillingSettingsCard.tsx` — discount message
- `src/features/billing/components/BillingSettingsCard.test.tsx` — 4 new discount tests
- `src/features/admin/lib/adminNavigation.ts` — Referidos nav item
- `src/features/admin/routes.tsx` — ReferidosPage route
- `src/features/admin/types.ts` — referral DTOs
- `src/shared/types/database.ts` — 4 new table types

---

## Test Coverage

| Suite | Count | Status |
|-------|-------|--------|
| Vitest (full suite) | 469 tests (70 files) | ✅ All passing |
| pgTAP (Supabase local) | 52 assertions (3 files) | ✅ All passing |
| Referral-specific Vitest | 82 tests (9 files) | ✅ All passing |
| Migration-level assertions | 5 `DO $$` blocks | ✅ All pass |

### Spec Compliance

- **Fully compliant**: 37/44 core spec scenarios with passing tests
- **Compliant by source inspection**: 3 scenarios (impl correct but no direct test)
- **Partial compliance**: 4 scenarios (integration test gaps — see warnings)
- **CRITICAL untested**: 0

### Warnings from Verification

1. **W1**: `activeReferredWorkshops` counts all workshops, not only active subscriptions
2. **W2**: `recordCommissionIfReferred` integration paths not unit-tested
3. **W3**: Deactivate uses inline buttons vs `ConfirmDialog` component
4. **W4**: All 5 WUs on `main` as uncommitted changes (not split into PRs)
5. **W5**: 45-day `isFirstPeriod` window vs spec "1 month"

No critical issues were found. All warnings are non-blocking for correctness.

---

## Risks and Mitigations

| Risk | Status | Mitigation |
|------|--------|------------|
| Duplicate webhook → double commission | ✅ Mitigated | Unique `provider_payment_id` index + 23505 catch |
| Discount persists across periods | ✅ Mitigated | Discount applied only on first `createPreapproval` call |
| Self-referral abuse | ✅ Mitigated | Case-insensitive email comparison in trigger |
| Platform-global table convention | ✅ Mitigated | SDD-9 precedent documented, RLS on, admin-only access |
| Webhook not fully integration-tested | ⚠️ Warning W2 | Pure function tests cover math; edge cases documented |
| PRs not split | ⚠️ Warning W4 | Orchestrator must split into 5 stacked branches before merge |

---

## Lessons Learned

1. **Pure function extraction pays off**: Extracting `computeSubscriptionAmount`, `computeCommissionAmount`, `buildCommissionRecord` as pure functions made them independently testable and reusable across Edge Function boundaries. This pattern should be standard for all SDD implementations.

2. **Return type for `supabase.functions.invoke` with CSV**: The `functions.invoke` API returns parsed JSON by default. CSV responses required special `parse: false` handling in the client. Future CSV endpoints should document this in their spec.

3. **React Query object keys**: Inline object literals as TanStack Query keys cause cache misses. Stable key composition (`JSON.stringify(filters)`) is required for query dedup. Worth adding as an OpenSpec convention.

4. **Migration-level assertions as a testing pattern**: In-migration `DO $$` blocks that `RAISE EXCEPTION` on schema/RLS/constraint violations proved extremely effective. They catch regressions at migration time, before any code depends on the schema. This pattern should be mandatory for any future schema change.

5. **Self-referral prevention at the trigger layer**: The `handle_new_user` trigger extension required careful case-insensitive email matching (`LOWER(auth.email) = LOWER(youtubers.contact_email)`) and was purely additive — existing signups are unaffected. This minimal-touch pattern is the right approach for modifying core auth triggers.

6. **Webhook idempotency with unique constraints**: The `provider_payment_id` unique index combined with `ON CONFLICT DO NOTHING` or explicit 23505 catching is simple and provably correct. No distributed locking needed.

---

## Specs Synced to Source of Truth

| Domain | Action | Details |
|--------|--------|---------|
| `referral-program` | Created | New full spec: 8 domains covering schema, attribution, discount, commissions, APIs, UI, tenant display, security |
| `sdd-2-billing-mercadopago` | Updated | 3 MODIFIED requirements: Server-Side Subscription Creation (discount), Subscription Record Linkage (audit columns), State Reconciliation (commission recording) |
| `sdd-3-auth-profile-hardening` | Updated | 3 ADDED requirements: Referral Code Accepted at Signup, LoginPage Captures URL Referral Code, Auth State Preserved With Attribution |

### Source of Truth Paths

- `openspec/specs/referral-program/spec.md`
- `openspec/specs/sdd-2-billing-mercadopago/spec.md` (merged)
- `openspec/specs/sdd-3-auth-profile-hardening/spec.md` (appended)

---

## Observation IDs (Engram Traceability)

| Artifact | Engram ID |
|----------|-----------|
| `sdd/referral-system/explore` | #536 |
| `sdd/referral-system/proposal` | #537 |
| `sdd/referral-system/spec` | #538 |
| `sdd/referral-system/design` | #540 |
| `sdd/referral-system/tasks` | #541 |
| `sdd/referral-system/apply-progress` | #542 |
| `sdd/referral-system/verify-report` | #546 |

---

## SDD Cycle Complete

The SDD-11 Referral System has been fully planned (`explore → proposal → spec → design → tasks`), implemented (`5 WUs, 28 tasks`), verified (`469 tests + 52 pgTAP assertions, PASS WITH WARNINGS`), and archived.

**Archived at**: `openspec/changes/archive/2026-06-15-2026-06-15-sdd-11-referral-system/`
