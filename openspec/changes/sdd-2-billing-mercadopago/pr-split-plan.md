# SDD 2 PR4 — Review Slice Plan

## Status

`split_recommended` — functional verification is green, but a single PR exceeds the 400 changed-line review budget. Use review slices unless a maintainer explicitly approves `size:exception`.

## Dependency Strategy

Use stacked PRs to `main` because the slices can be reviewed independently but are easiest to land in order.

```text
main
└── PR4a CI + audit baseline 📍
    └── PR4b Billing settings card + pricing
        └── PR4c Settings / blocked access integration
            └── PR4d Legal/privacy copy alignment
                └── PR4e MercadoPago webhook fix + sandbox evidence
```

## Proposed PRs

### PR4a — CI + dependency audit baseline

Files:
- `.github/workflows/ci.yml`
- `package-lock.json`

Purpose:
- Add GitHub Actions CI for `npm ci`, `npm audit --audit-level=moderate`, `npm test`, `npm run lint`, and `npm run build`.
- Resolve current npm audit advisories without `--force`.

Verification:
- `npm ci`
- `npm audit --audit-level=moderate`
- `npm test`
- `npm run lint`
- `npm run build`

### PR4b — Billing settings card + pricing constant

Files:
- `src/features/billing/components/BillingSettingsCard.tsx`
- `src/features/billing/components/BillingSettingsCard.test.tsx`
- `src/shared/constants/billingPricing.ts`
- `src/features/landing/data/pricing.ts`
- `src/features/landing/components/ROICalculatorSection.tsx`

Purpose:
- Add billing management UI for settings and reuse a single pricing constant.

Verification:
- `npm test -- src/features/billing/components/BillingSettingsCard.test.tsx`
- `npm test`

### PR4c — Settings / blocked access integration

Files:
- `src/features/settings/components/WorkshopSettings.tsx`
- `src/features/billing/components/BillingBlockedScreen.tsx`
- `src/features/billing/components/BillingBlockedScreen.test.tsx`
- `src/features/billing/components/BillingGate.tsx`
- `src/features/billing/components/BillingGate.test.tsx`
- `src/app/layouts/AppLayout.test.tsx`

Purpose:
- Render billing settings in workshop settings.
- Reuse billing management from the blocked access screen.
- Improve loading state accessibility assertions.

Verification:
- `npm test -- src/features/billing/components/BillingBlockedScreen.test.tsx src/features/billing/components/BillingGate.test.tsx src/app/layouts/AppLayout.test.tsx`
- `npm test`

### PR4d — Legal/privacy copy alignment

Files:
- `src/features/legal/pages/PrivacyPage.tsx`
- `src/features/legal/pages/TermsPage.tsx`

Purpose:
- Align legal and privacy copy with billing/subscription behavior.

Verification:
- `npm test`
- `npm run lint`
- Manual review of legal copy.

### PR4e — MercadoPago webhook fix + sandbox evidence

Files:
- `supabase/functions/_shared/billing.ts`
- `supabase/functions/_shared/mercadopago.ts`
- `supabase/functions/create-subscription/index.ts`
- `supabase/functions/mercadopago-webhook/index.ts`
- `tests/supabase/functions/billingHelpers.test.ts`
- `docs/mercadopago-webhook-checklist.md`
- `openspec/changes/sdd-2-billing-mercadopago/apply-pr4-progress.md`
- `openspec/changes/sdd-2-billing-mercadopago/verify-report.md`
- `openspec/changes/sdd-2-billing-mercadopago/pr-split-plan.md`

Purpose:
- Support actual MercadoPago subscription webhook topic names.
- Validate MercadoPago signatures using URL query `data.id`, omitting `id:` when absent.
- Record signed dashboard simulation evidence: `subscription_preapproval` returned HTTP 200 and mutated staging DB.

Verification:
- `npm test -- tests/supabase/functions/billingHelpers.test.ts`
- Supabase deploy evidence already recorded for `mercadopago-webhook` version 21 with `--no-verify-jwt`.
- MercadoPago dashboard simulation evidence already recorded.

## Current Blocker

No code/test blocker remains. The only blocker is review workload if this is shipped as one PR. Do not create/open a single normal PR for all slices unless the maintainer explicitly approves `size:exception`.
