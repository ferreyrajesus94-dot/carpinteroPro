# SDD 2 Explore Report — Billing + MercadoPago

## Quick Answer

Billing is **entirely unimplemented**. The app has static pricing copy (ARS 4,990/mes, 14-day trial), legal pages referencing MercadoPago, and a ROI calculator, but there is zero backend schema, zero payment SDK, zero webhook handling, and zero billing gate in the app shell. SDD 1 (tenant security) is complete and provides the trusted `workshop_id` foundation required for subscription scoping.

## 1. SDD 1 Dependency Status — Satisfied

SDD 2 depends on SDD 1 (tenant security / RLS). The baseline was verified:

- `git status`: clean on `main` tracking `origin/main`
- `supabase migration list --linked`: local and remote ledgers match through `20260501113753`
- `npm test`: 21 files passed, 142 tests passed
- `npm run lint`: exit 0 (6 existing React Compiler warnings about RHF `watch()`)
- `npm run build`: exit 0

Key SDD-1 outcomes relevant to billing:

- `get_current_workshop_id()` now derives from `auth.uid() → profiles.workshop_id` (server-trusted).
- `workshops` table has RLS: `workshops_select_own`, `workshops_update_own`.
- `profiles` workshop_id immutability trigger prevents tenant hopping.
- No client-controlled `x-workshop-id` header is sent.

Migration ledger note from SDD-1: historical timestamp migrations (`202604...`) are comment-only placeholders for remote reconciliation. Active DDL lives in numeric migrations (`0001`–`0021`). Any new migration for SDD-2 must use the numeric sequence, starting from `0022`.

## 2. Current Billing / Payment State Audit

### 2.1 Database Schema — Zero Billing Artifacts

No subscription, payment, invoice, or plan tables exist.

| Table | Billing-related columns? |
|-------|--------------------------|
| `workshops` | `id`, `name`, `created_at` only. No `subscription_status`, `trial_ends_at`, `plan`, `mercado_pago_customer_id`, etc. |
| `profiles` | `id`, `workshop_id`, `display_name`, `onboarded_at`, `terms_accepted_at`, `privacy_accepted_at`, `created_at`. No `subscription_id` or `payment_method`. |
| All other tables | `workshop_id` present per project convention, but no billing fields. |

No billing enums or RLS policies exist.

### 2.2 Environment / Configuration — No MercadoPago Credentials

`.env.example` contains only Supabase URL and anon key. Missing:

- `VITE_MERCADOPAGO_PUBLIC_KEY`
- `MERCADOPAGO_ACCESS_TOKEN` for backend/edge function
- webhook secret
- `SUPABASE_SERVICE_ROLE_KEY` for edge/admin operations

### 2.3 Dependencies — No Payment SDK

`package.json` has no `mercadopago` SDK, no `@mercadopago/sdk-react`, no Stripe, and no other payment provider.

### 2.4 Edge Functions / Serverless — None

No `supabase/functions/` directory exists. No webhook receivers. No server-side payment verification.

### 2.5 Frontend — Static Copy Only

- `src/features/landing/data/pricing.ts` hard-codes Pro Mensual at ARS 4,990/month with CTA `/login`.
- `src/features/landing/components/ROICalculatorSection.tsx` hard-codes `SUBSCRIPTION_PRICE = 4_990` for marketing math only.
- `src/app/layouts/AppLayout.tsx` gates only on `session` and `onboardedAt`; no subscription/trial gate.
- `src/shared/providers/AuthProvider.tsx` exposes no billing status.
- `src/features/settings/components/WorkshopSettings.tsx` has no billing/subscription section.

### 2.6 Legal Pages — Copy Ahead of Implementation

- `src/features/legal/pages/TermsPage.tsx` promises a 14-day trial, ARS monthly subscription, MercadoPago automatic debits, and cancellation from Ajustes.
- `src/features/legal/pages/PrivacyPage.tsx` lists MercadoPago as payment processor and subscription contract as legal basis.

This is a compliance risk once billing goes live unless implementation and legal copy stay aligned.

### 2.7 Test Coverage — None for Billing

Existing tests cover static pricing shape and landing render only. There are no tests for billing logic, subscription gates, MercadoPago integration, or webhook handling.

## 3. Areas Inspected

| File / Area | Finding |
|-------------|---------|
| `openspec/config.yaml` | SDD-2 listed as P0 launch-blocker, blocked on SDD-1. |
| `docs/production-sdd-roadmap.md` | Confirms subscription/trial schema, MercadoPago checkout + webhook, billing gate, cancellation/settings, legal alignment. |
| `package.json` | No payment SDKs. |
| `.env.example` | No MercadoPago env vars. |
| `src/shared/types/database.ts` | No billing tables/enums. |
| `supabase/migrations/` | No billing schema; 21 numeric migrations + timestamp placeholders. |
| `src/shared/lib/supabase.ts` | Standard Supabase client only. |
| `src/shared/providers/AuthProvider.tsx` | No subscription context. |
| `src/app/layouts/AppLayout.tsx` | No billing gate. |
| `src/features/settings/components/WorkshopSettings.tsx` | No subscription management UI. |
| `src/features/landing/data/pricing.ts` | Static pricing only. |
| `src/features/legal/pages/TermsPage.tsx` | Billing terms not enforced. |
| `src/features/legal/pages/PrivacyPage.tsx` | Mentions MercadoPago as processor. |
| `src/features/landing/components/ROICalculatorSection.tsx` | Hard-coded `4_990`. |
| `supabase/` | No edge functions. |

## 4. MercadoPago Integration Gaps

| Gap | Impact |
|-----|--------|
| No MercadoPago SDK | Cannot render checkout or create preferences/subscriptions. |
| No backend payment initializer | Client-side creation would expose access token; must be server-side. |
| No webhook endpoint | Cannot verify payments or update subscription status. |
| No subscription schema | Cannot persist subscription/trial state. |
| No trial tracking | Cannot enforce 14-day limit. |
| No billing gate | Authenticated onboarded users have indefinite access. |
| No cancellation flow | Terms promise cancellation from settings but UI/backend do not exist. |
| No invoice/payment history | May be deferred if MercadoPago dashboard suffices for MVP. |

## 5. Schema Design Options — Preliminary

### Option A: Extend `workshops`

Simple and fast but makes `workshops` wider and loses billing history.

### Option B: Separate `subscriptions` table

Normalized, history-friendly, and aligned with project convention requiring `workshop_id` on every table. Requires one active subscription invariant.

### Option C: Hybrid

Fast workshop lookup plus subscription history, but introduces dual-source-of-truth risk.

Preliminary recommendation: Option B, with indexes and RLS. If gate lookup becomes a concern, add a view or denormalized status later.

## 6. Open Questions for Proposal Phase

1. Which MercadoPago API: Subscriptions/preapproval, Checkout Pro, or payment links?
2. Webhook transport: Supabase Edge Function or external server route?
3. Trial start trigger: signup/profile creation, onboarding completion, or first data entry?
4. Grace period after trial expiration/cancellation: immediate hard gate or short grace/read-only?
5. Downgrade behavior: block all app access, read-only, or retention policy?
6. Multi-user future: subscription should remain workshop-level if planned.
7. Price changes: fixed ARS 4,990 or future tiers/promotions?

## 7. Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Legal copy promises unimplemented billing | High | Must align implementation or update copy. |
| No server-side payment verification | Critical | Webhook + server-side creation mandatory. |
| Schema missing entirely | High | Greenfield work. |
| No test infrastructure for webhooks | High | Need integration strategy or manual checklist. |
| Currency volatility | Medium | App can store status; MercadoPago handles charges. |
| MercadoPago API complexity | Medium | Idempotency, retries, and webhook semantics need care. |
| Review budget | Medium | Full billing slice likely exceeds 400 changed lines; stacked PRs likely. |

## 8. Dependency on SDD-1 — Verified

SDD 1 provides server-derived workshop identity and tenant-safe RLS. All billing schema should include `workshop_id uuid NOT NULL`, RLS enabled, and policies based on `get_current_workshop_id()`.

## 9. Checklist for Next Phases

- [ ] Decide MercadoPago product.
- [ ] Decide webhook transport.
- [ ] Decide trial start and grace behavior.
- [ ] Design schema (`subscriptions`, possibly `payments` / `invoices`).
- [ ] Add migration with `workshop_id`, RLS, indexes, and tests.
- [ ] Add server-side subscription/checkout creation.
- [ ] Add webhook receiver with verification and idempotency.
- [ ] Add billing gate.
- [ ] Add Settings billing section.
- [ ] Update `.env.example`.
- [ ] Add frontend tests.
- [ ] Add SQL/RLS tests.
- [ ] Add webhook verification strategy.
- [ ] Align legal copy.

## Phase Result Envelope

| Field | Value |
|-------|-------|
| **status** | `explore_complete` |
| **executive_summary** | Billing is entirely absent despite legal copy promising a 14-day trial, ARS 4,990/month subscription, and MercadoPago integration. No schema, SDK, webhook, billing gate, or settings UI exists. SDD-1 tenant security is complete and provides the trusted `workshop_id` foundation. |
| **artifacts** | `openspec/changes/sdd-2-billing-mercadopago/explore.md` |
| **next_recommended** | `proposal` — define scope, acceptance criteria, and decisions for MercadoPago product, webhook transport, trial trigger, and grace behavior. |
| **risks** | Critical: no server-side payment verification. High: legal copy ahead of implementation; schema missing; no webhook infrastructure; no test coverage for billing. Medium: review budget may be exceeded. |
| **skill_resolution** | `none` |
