# Proposal: Referral System

## Intent

YouTubers need a simple, trackable incentive to promote CarpinteroPro (ARS 4,990/month). The platform needs first-subscription discounts for referred workshops and lifetime commission tracking for promoters without coupling business rules to MercadoPago coupons.

## Scope

### In Scope
- One active referral code per YouTuber, with configurable first-period discount % and recurring commission %.
- Signup attribution from `?ref=CODE`, deterministic self-referral prevention, first-payment commission, and lifetime commission ledger while the referred subscription remains active.
- Platform-admin management UI/API for YouTubers, codes, and commission reporting; tenant billing card shows only applied discount.
- Five chained PRs within the 400-line review budget.

### Out of Scope
- Automated payouts, tax/legal accounting, refund/chargeback reversals, YouTuber self-service dashboard, multi-currency, tiers, A/B testing, public landing copy.

## Capabilities

### New Capabilities
- `referral-program`: Platform-global YouTuber, referral code, attribution, and commission ledger behavior.

### Modified Capabilities
- `sdd-2-billing-mercadopago`: First-period discount in subscription creation and commission recording from payment webhooks.
- `sdd-3-auth-profile-hardening`: Signup metadata accepts referral code without weakening profile/workshop creation safety.

## Approach

Use exploration Approach A: application-level discount + internal ledger. Add platform-global tables with RLS enabled and no tenant policies, following SDD-9 admin-only Edge Function precedent. `handle_new_user` validates active codes and records attribution. `create-subscription` applies the discount only during first preapproval creation. `mercadopago-webhook` records commissions idempotently on successful payments using a unique `provider_payment_id`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `supabase/migrations/` | New/Modified | Referral tables, subscription fields, RLS tests |
| `supabase/functions/create-subscription` | Modified | First-period discount |
| `supabase/functions/mercadopago-webhook` | Modified | Commission ledger insert |
| `supabase/functions/admin-*` | New | Admin referral APIs |
| `src/features/auth`, `src/features/billing`, `src/features/admin` | Modified/New | Ref capture, discount copy, admin UI |

## Risks

| Risk | Likelihood | Mitigation |
|---|---:|---|
| Duplicate webhook commission | Med | Unique `provider_payment_id`, catch `23505` |
| Discount repeats after first period | Med | Apply only on first preapproval; test no-repeat path |
| Self-referral abuse | Med | Backend validation blocks same-workshop attribution |
| Platform-global table exception | Low | Document SDD-9 precedent; RLS on, admin Edge Functions only |

## Rollback Plan

Disable referral code capture and admin route, revert Edge Function changes, and keep ledger tables inert. If needed, run a follow-up migration to ignore attribution fields; existing subscriptions continue at normal MercadoPago billing.

## Delivery Plan

1. Schema + RLS tests.
2. Signup attribution + first-period discount.
3. Webhook commission recording.
4. Admin YouTubers/codes UI + APIs.
5. Admin commissions report + tenant discount message + final tests.

## Dependencies

- Existing MercadoPago billing flow, SDD-9 platform-admin patterns, Supabase service-role Edge Functions.

## Success Criteria

- [ ] Valid referral signup receives first-period discount only once.
- [ ] YouTuber earns commission from first and recurring successful payments.
- [ ] Duplicate webhooks do not duplicate commission rows.
- [ ] Same-workshop self-referrals are rejected server-side.
- [ ] Platform admin can manage codes and export/review commissions.
