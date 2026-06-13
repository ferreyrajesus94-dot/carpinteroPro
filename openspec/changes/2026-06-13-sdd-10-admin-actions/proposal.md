# SDD-10 Admin Actions — Proposal

## Problem

The admin dashboard (SDD9) is read-only. The platform owner can see metrics, workshops, subscriptions, and diagnostics — but cannot act on them. Every operational task requires direct Supabase SQL Editor access.

## Scope

Add 7 admin actions that enable the platform owner to manage the platform from the dashboard:

### Billing actions
1. **Cancel subscription** — button in BillingPage, invokes existing `cancel-subscription` Edge Function
2. **Toggle subscription status** — pause/resume, invokes new Edge Function
3. **Retry failed webhook** — button in SupportPage for failed events, invokes new Edge Function

### Workshop actions
4. **Deactivate/activate workshop** — flag `workshops.is_active`, toggle in WorkshopDetailPage
5. **Force profile onboarding** — mark `onboarded_at` for a profile from workshop detail

### Platform actions
6. **Refresh data** — button in AdminLayout header that invalidates all admin TanStack Query caches
7. **Maintenance mode** — flag in a platform settings table, banner visible to normal users

## Out of scope

- Impersonation (explicitly excluded since SDD9)
- Deleting workshops or data
- Changing subscription plans
- User management beyond onboarding fix
- Audit log persistence (separate SDD)

## Acceptance Criteria

- [ ] Cancel subscription works from BillingPage with confirmation dialog
- [ ] Pause/resume subscription works with status toggle
- [ ] Failed webhook retry sends a test event to MercadoPago
- [ ] Workshop deactivation hides it from normal users without data loss
- [ ] Force onboarding updates profile onboarded_at via admin-only Edge Function
- [ ] Refresh button invalidates all query caches on click
- [ ] Maintenance mode shows a dismissible banner to non-admin users
- [ ] All mutations require platform admin auth (Edge Function guard)
- [ ] No service-role key exposed in frontend
- [ ] npm test, npm run lint, npx tsc -b all pass

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Cancel subscription irreversibility | Confirmation dialog + "cancelar" copy |
| Workshop deactivation blocking real users | Reversible toggle, no data loss |
| Webhook retry spamming MercadoPago | Rate limit in Edge Function, one-at-a-time |
| Maintenance mode blocking login | Only shown post-auth, dismissible |

## Dependencies

- SDD9 (admin dashboard) — ✅ complete
- SDD2 (billing + MercadoPago) — ✅ complete
- `cancel-subscription` Edge Function — ✅ exists in production
