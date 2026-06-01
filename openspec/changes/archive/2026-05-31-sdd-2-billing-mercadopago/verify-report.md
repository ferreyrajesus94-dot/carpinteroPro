# SDD 2 PR4 — Verify Report

## Status

**FAIL for normal single-PR readiness** due to review-workload budget, despite functional validation commands passing.

- Functional test/build status: **PASS**.
- Signed MercadoPago dashboard simulation evidence: **PASS for `subscription_preapproval` happy path**.
- Strict TDD artifact compliance: **PASS after parent follow-up** — `apply-pr4-progress.md` now contains the required `TDD Cycle Evidence` table.
- Review workload / PR boundary: **FAIL / CRITICAL** — actual diff greatly exceeds the 400 changed-line review budget and the PR4 forecast.

## Spec Coverage

### Covered / verified

- Settings billing card behavior is covered by `src/features/billing/components/BillingSettingsCard.test.tsx` for trial, active, blocked, scheduled cancellation, checkout redirect, cancellation confirmation, pending state, and mutation error display.
- Billing blocked screen and gate behavior are covered by tests in:
  - `src/features/billing/components/BillingBlockedScreen.test.tsx`
  - `src/features/billing/components/BillingGate.test.tsx`
  - `src/app/layouts/AppLayout.test.tsx`
- MercadoPago helper behavior is covered by `tests/supabase/functions/billingHelpers.test.ts`, including:
  - provider-status mapping;
  - signed-manifest validation with URL `data.id`;
  - signed-manifest validation when the simulator omits URL `data.id`;
  - invalid/missing signature rejection;
  - subscription webhook topic classification.
- `docs/mercadopago-webhook-checklist.md` accurately states that a signed MercadoPago dashboard simulation for `subscription_preapproval` returned HTTP 200 and inserted/updated DB state.
- `docs/mercadopago-webhook-checklist.md` accurately keeps the broader manual checklist incomplete: invalid-signature no-mutation, missing secret fail-closed, duplicate idempotency, rejected payment/authorized-payment, unknown/provider 400/404, and cross-tenant safety remain unchecked.

### Partially covered / not fully verified in this PR4 verify pass

- Full manual webhook checklist is **not complete**.
- Manual rejected-payment and duplicate-idempotency paths were not exercised during this verify pass.
- Cross-tenant webhook safety was not manually exercised during this verify pass.

## Task Completion Status

- PR4 settings/legal/pricing implementation: **implemented and automated tests pass**.
- MercadoPago `subscription_preapproval` signed dashboard simulation: **validated** with HTTP 200 and DB mutation evidence recorded in docs/progress.
- Final required commands: **all passed**.
- Strict TDD evidence table: **recorded after follow-up**.
- PR-ready under 400-line budget: **not satisfied**.

## Test / Validation Commands

```bash
cd /home/elias/Proyectos/carpinteroPro && npm ci
# PASS: installed from lockfile

cd /home/elias/Proyectos/carpinteroPro && npm audit --audit-level=moderate
# PASS: found 0 vulnerabilities

cd /home/elias/Proyectos/carpinteroPro && npm test
# PASS: Test Files 28 passed (28); Tests 210 passed (210)

cd /home/elias/Proyectos/carpinteroPro && npm run lint
# PASS with warnings: 0 errors, 6 React Compiler warnings in pre-existing form components / WorkshopSettings watch() usage

cd /home/elias/Proyectos/carpinteroPro && npm run build
# PASS: tsc -b && vite build completed successfully; PWA generated

cd /home/elias/Proyectos/carpinteroPro && grep -R "MERCADOPAGO_ACCESS_TOKEN\|MERCADOPAGO_WEBHOOK_SECRET\|SUPABASE_SERVICE_ROLE_KEY" dist/ 2>/dev/null || echo "No secret variable names in bundle"
# PASS: No secret variable names in bundle

cd /home/elias/Proyectos/carpinteroPro && npm test -- src/features/billing/components/BillingGate.test.tsx src/app/layouts/AppLayout.test.tsx
# PASS after accessible loading-status refactor: Test Files 2 passed (2); Tests 11 passed (11)
```

## Strict TDD Compliance

Strict TDD is active in `openspec/config.yaml`.

- Required `TDD Cycle Evidence` table in `apply-pr4-progress.md`: **PRESENT after parent follow-up**.
- Reported test files exist in the codebase and were cross-referenced:
  - `src/features/billing/components/BillingSettingsCard.test.tsx`
  - `src/features/billing/components/BillingBlockedScreen.test.tsx`
  - `src/features/billing/components/BillingGate.test.tsx`
  - `src/app/layouts/AppLayout.test.tsx`
  - `tests/supabase/functions/billingHelpers.test.ts`
- Relevant tests are included in full `npm test`: **GREEN**.
- Assertion quality:
  - No tautological or type-only assertions found in changed/created tests reviewed.
  - Tests assert meaningful UI text, actions, redirects, signature outcomes, and status mapping.
  - `BillingGate.test.tsx` and `AppLayout.test.tsx` loading-state assertions were refactored from `.animate-spin` CSS implementation details to accessible `role="status"` assertions.
  - Some tests combine multiple states into one test case; still meaningful, but splitting could improve failure localization.

## Review Workload / PR Boundary Findings

User/session choice: single PR only if within 400 changed-line budget.

Actual working tree diff size measured during verify:

```text
Tracked diff totals before CI/audit follow-up: additions=985 deletions=559 changed=1544
Untracked line counts:
57 openspec/changes/sdd-2-billing-mercadopago/apply-pr4-progress.md
159 src/features/billing/components/BillingSettingsCard.test.tsx
186 src/features/billing/components/BillingSettingsCard.tsx
7 src/shared/constants/billingPricing.ts
```

After CI/audit follow-up, `package-lock.json` also changed substantially because `npm audit fix` resolved all 9 reported vulnerabilities without `--force`, increasing the raw diff further. Even excluding OpenSpec artifacts, the PR-sized work remains far above the 400-line budget and above the PR4 forecast of 200–350 changed lines.

**CRITICAL**: A single PR does not respect the review workload budget unless a `size:exception` is explicitly recorded and approved. Current artifacts do not record a size exception.

Recommended split if no size exception is approved:

1. PR4a — CI + dependency audit baseline (`.github/workflows/ci.yml`, `package-lock.json`).
2. PR4b — billing settings card + tests + pricing constant.
3. PR4c — settings/blocked-screen integration and app-layout test adjustments.
4. PR4d — legal/privacy copy alignment.
5. PR4e — MercadoPago webhook signature/topic fix + checklist/progress evidence.

## Exact Blockers

1. **CRITICAL — Review budget exceeded**: actual changed lines far exceed 400; no `size:exception` was found.

Resolved during parent follow-up:
- Strict-TDD evidence table added to `openspec/changes/sdd-2-billing-mercadopago/apply-pr4-progress.md`.
- Loading-spinner assertions no longer rely on `.animate-spin` CSS implementation details.

## Verification Conclusion

The implementation is functionally green and the MercadoPago signed dashboard `subscription_preapproval` happy path is validated. After parent follow-up, strict-TDD artifact evidence is recorded, the CSS-loading assertion warning is resolved, CI is added, and npm audit reports 0 vulnerabilities. PR4 still cannot be marked ready for a normal single PR under the stated SDD rules until the review-workload budget is respected via splitting or an explicit user-approved `size:exception`.
