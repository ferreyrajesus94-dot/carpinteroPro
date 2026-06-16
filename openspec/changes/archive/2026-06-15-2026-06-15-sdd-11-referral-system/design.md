# Design: SDD-11 Referral System

## Technical Approach

Use application-level referral logic: signup stores attribution, `create-subscription` applies the first-preapproval discount, and `mercadopago-webhook` appends an idempotent commission row. Admin access follows SDD-9: browser → admin Edge Function → service-role DB; tenants only see discount percentage.

## Architecture Decisions

| Decision | Choice | Tradeoff / Rationale |
|---|---|---|
| Discount engine | Compute in `create-subscription`, no MP coupons | Avoids sticky provider coupons; keeps rules testable. |
| Attribution | `workshop_referrals` one-row-per-workshop | Keeps `workshops` clean and makes self-referral/ledger joins explicit. |
| Access | RLS enabled, no authenticated policies on referral tables | Platform-global exception matches SDD-9; all reads/writes go through `requirePlatformAdmin`. |
| Commission | Immutable ledger with unique `provider_payment_id` | Webhook retries become safe no-ops; historical pct/amount snapshots survive code changes. |

## Data Flow

```text
/login?ref=CODE -> signUp metadata -> handle_new_user -> workshop_referrals
workshop -> create-subscription -> MP preapproval(amount maybe discounted) -> subscriptions audit columns
MP authorized_payment -> mercadopago-webhook -> referral_commissions
admin /referidos -> admin-* Edge Functions -> referral tables/service role
```

## Data Model / Migrations

1. `20260615000001_referral_youtubers.sql`: `youtubers(id, display_name, channel_url, contact_email, payout_method, is_active, created_at, updated_at)`, RLS on, no policies.
2. `20260615000002_referral_codes.sql`: `referral_codes(id, youtuber_id, code, discount_pct, commission_pct, is_active, created_at, updated_at)`, unique lower-code index, pct checks, RLS.
3. `20260615000003_workshop_referrals.sql`: `workshop_referrals(workshop_id PK, referral_code_id, youtuber_id, attributed_at)`, RLS on; update `handle_new_user` for referral capture and email self-referral skip.
4. `20260615000004_referral_commissions.sql`: `referral_commissions(id, workshop_id, youtuber_id, referral_code_id, subscription_id, provider_payment_id unique, payment_amount, commission_pct, commission_amount, currency, occurred_at, created_at)`, indexes on `youtuber_id`, `workshop_id`, RLS on.
5. `20260615000005_subscription_referral_columns.sql`: add nullable `subscriptions.first_period_discount_pct`, `referred_by_referral_code_id`.

Each migration includes `DO $$` assertions for RLS, no authenticated policies, FKs, uniqueness, and nullable backfill.

## Interfaces / Edge Function Contracts

- `create-subscription` existing `POST {}` → `{ initPoint, preapprovalId, status }`; internally returns existing preapproval unchanged or creates one with discounted `transaction_amount` and upserts audit columns.
- `admin-youtubers` `POST { search?: string; youtuberId?: string }` → `{ youtubers: [{ id, displayName, channelUrl, contactEmail, payoutMethod, isActive, codeCount, activeReferredWorkshops, lifetimeCommission }] }`.
- `admin-youtube-mutate` `POST { action: "create"|"update"|"toggle", id?, displayName?, channelUrl?, contactEmail?, payoutMethod?, isActive? }` → `{ id, isActive? }`.
- `admin-referral-codes` `POST { action: "list"|"create"|"deactivate", youtuberId?, code?, discountPct?, commissionPct? }` → `{ codes }` or `{ id }`; conflicts return `409 referral_code_conflict`.
- `admin-referral-commissions` `POST { youtuberId?, fromDate?, toDate?, limit?, format?: "json"|"csv" }` → JSON rows or `text/csv` attachment.
- `mercadopago-webhook` unchanged public MP contract; only `authorized_payment` with approved status attempts commission insert and catches `23505` as success.

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/2026061500000*.sql` | Create/Modify | Five additive migrations + trigger extension/assertions. |
| `supabase/functions/create-subscription/index.ts` | Modify | Load attribution, compute discount, persist audit columns. |
| `supabase/functions/mercadopago-webhook/index.ts` | Modify | Insert commission after subscription update for approved authorized payments. |
| `supabase/functions/admin-*referral*/`, `admin-youtubers/`, `admin-youtube-mutate/` | Create | Platform-admin-only APIs. |
| `src/features/auth/components/LoginPage.tsx`, `src/features/auth/api/index.ts` | Modify | Read `useSearchParams`; pass optional `referral_code` metadata. |
| `src/features/admin/{types.ts,api/referrals.ts,hooks/useReferrals.ts,components/ReferidosPage.tsx,lib/adminNavigation.ts,routes.tsx}` | Create/Modify | Admin UI/route. |
| `src/features/billing/components/BillingSettingsCard.tsx`, `src/shared/types/database.ts` | Modify | Tenant discount copy and DB types. |

## Work Units / Chained PRs

| WU | Boundary | Files | Tests first | Est. lines | Verify | Rollback |
|---|---|---|---|---:|---|---|
| 1 Schema/RLS | Tables, columns, trigger assertions; no UI | migrations, `database.ts` | migration assertions for schema/RLS/unique/FKs | ~330 | apply; authenticated selects return no rows | disable trigger; tables inert |
| 2 Attribution + discount | Signup metadata + subscription discount; no commissions/admin | `LoginPage`, auth api, `create-subscription`, tests | ref/no-ref; discount/full/inactive/existing-preapproval | ~360 | 20% sends 3992; no-ref 4990 | stop ref; ignore discount lookup |
| 3 Webhook commissions | Ledger insert only in authorized_payment | webhook, helper tests | approved/discounted/failed/unreferred/duplicate/preapproval skip | ~300 | duplicate returns 200; one row | remove insert path |
| 4 Admin YouTubers/codes | CRUD/list UI + APIs; no commissions tab | admin-youtubers, mutate, codes, referrals api/hooks, nav/routes | non-admin 403; create/toggle/conflict; table/toggle | ~390 | `/admin/referidos` lists promoters/codes | remove nav/route |
| 5 Commissions + tenant copy | Reporting tab, CSV, billing message | commissions API, `ReferidosPage`, `BillingSettingsCard` | filters/CSV; first-period copy only | ~380 | CSV downloads; no YouTuber identity | hide tab/copy |

## Testing Strategy

Strict TDD per WU: failing migration/component/function contract tests first, minimal green, refactor. Run `npm test`; SQL/RLS uses in-migration assertions. Manual Edge verification uses admin/non-admin JWTs and MP sandbox payloads.

## Security Model

Self-referral is blocked in `handle_new_user` by case-insensitive `auth.users.email` vs `youtubers.contact_email`. Referral tables expose no browser RLS policies; admin functions call `requirePlatformAdmin` before `serviceClient()`. Tenant billing returns subscription columns only.

## UI Structure

`ReferidosPage`: `YoutubersTab` (table, create/edit modal, deactivate confirm, code list/create) and `CommissionsTab` (filters, table, CSV). `BillingSettingsCard` appends “Descuento aplicado: X% durante el primer período.” only in the first period.

## Open Questions

- None blocking. Product decisions are confirmed.
