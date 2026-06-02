# SDD-6 Explore — Observability & Support

**Date:** 2026-06-02
**Status:** explore_complete
**Depends on:** SDD-5 (archived / PASS — blocker resolved)

---

## 1. Blocker Resolution

SDD-6 was marked `blocked` in `openspec/config.yaml` with `depends_on: [sdd-5]`.
SDD-5 Production Ops is **archived / PASS** as of 2026-06-02. `docs/production-sdd-roadmap.md`
states: *"SDD 6 is unblocked by SDD 5 completion and may begin."*

**Action required:** update `openspec/config.yaml` SDD-6 status from `blocked` to `ready_to_start` during planning.

---

## 2. Current State

### What exists

| Area | Implementation | Location |
|------|---------------|----------|
| User-facing errors | `sonner` toast notifications in feature hooks | `src/features/**/hooks/*.ts` |
| Offline detection | `useOnlineStatus` hook + `OfflineBanner` component | `src/shared/hooks/useOnlineStatus.ts`, `src/shared/components/OfflineBanner.tsx` |
| Auth error recovery | `profile_error` state with retry/logout/support text | `src/shared/providers/AuthProvider.tsx`, `src/app/layouts/AppLayout.tsx` |
| Route-level error | Static `errorElement` with reload action | `src/app/router.tsx` |
| Query retry | TanStack Query default `retry: 1` | `src/shared/lib/queryClient.ts` |
| Billing errors | Edge functions return/throw billing failures | `supabase/functions/**` |

### Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| Error reporting service | Critical | No Sentry/LogRocket/Bugsnag/equivalent. Errors disappear after toast. |
| React ErrorBoundary | High | A render crash can take down the app shell. |
| Global error handlers | High | No `window` `error` / `unhandledrejection` capture. |
| TanStack Query global error reporting | Medium | Per-hook toasts exist, but no central unexpected-error reporting. |
| Actionable support channel | High | UI tells users to contact support but no clear link/channel is wired. |
| Safe error context | Medium | No app version, route, user/workshop context, or privacy filtering contract. |
| Edge function observability | Medium | Billing failures need structured, supportable errors; external Deno reporting may be deferred. |

---

## 3. Candidate Scope

### Recommended in scope

1. **Frontend error reporter wrapper**
   - Add a shared wrapper such as `src/shared/lib/errorReporter.ts`.
   - Environment-gate external reporting behind `VITE_SENTRY_DSN` or equivalent.
   - Capture safe context only: route, app version, `workshop_id`, scoped user id if available.
   - Exclude PII and business payloads by default.

2. **React ErrorBoundary**
   - Add reusable `src/shared/components/ErrorBoundary.tsx`.
   - Render user-friendly recovery UI with retry/reload and support contact.
   - Capture render errors through the reporter.
   - Wrap the app/router boundary at a coarse level, not every component.

3. **Global unexpected-error capture**
   - Add `window.error` and `window.unhandledrejection` registration.
   - Add TanStack `QueryCache` / `MutationCache` global `onError` callbacks for reporting.
   - Preserve existing feature-specific toast behavior.

4. **Support contact mechanism**
   - Minimum viable option: a `mailto:` support link or configured support URL.
   - Replace support text dead ends with actionable links.
   - Keep this lightweight; do not build a ticketing system in SDD-6.

5. **Structured edge function errors**
   - Standardize supportable error codes/messages for billing edge functions.
   - Defer Deno Sentry SDK unless implementation stays small and well-tested.

### Non-goals

- Product analytics or telemetry.
- Core Web Vitals/performance monitoring.
- Full logging framework.
- Uptime monitoring/status page.
- Database-level monitoring beyond Supabase-native tools.
- In-app support ticketing system.

---

## 4. Acceptance Criteria Candidates

- [ ] Unhandled exceptions are captured and routed through a shared reporter.
- [ ] Unhandled promise rejections are captured and routed through a shared reporter.
- [ ] React render crashes are caught by an ErrorBoundary with recovery UI.
- [ ] ErrorBoundary recovery UI offers retry/reload and an actionable support path.
- [ ] Error reports include safe context and exclude PII/business payloads.
- [ ] TanStack Query global errors are reported centrally without removing per-hook toasts.
- [ ] "Contact support" UI references become actionable.
- [ ] External reporting is disabled unless configured by environment.
- [ ] Billing edge function errors use structured, supportable error responses.
- [ ] `npm test` passes with reporter and ErrorBoundary coverage.

---

## 5. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SDK bundle/network overhead | Low | Medium | Use a thin wrapper and env-gated initialization; avoid telemetry extras. |
| Over-reporting known user errors | Medium | Medium | Report unexpected/global errors; keep expected validation errors as toasts only. |
| Privacy leak in error payloads | Medium | High | Central wrapper strips payloads and only allows safe context. |
| Support channel creates operational burden | Medium | Medium | Start with a simple support link/email; defer ticketing. |
| Edge observability scope creep | Medium | Medium | Require structured errors first; external Deno reporting optional/follow-up. |

---

## 6. Likely Affected Areas

### New files

- `src/shared/lib/errorReporter.ts`
- `src/shared/components/ErrorBoundary.tsx`
- Optional shared support-link component or constant

### Modified files

- `src/main.tsx` or app entry point — initialize reporter/global handlers
- `src/app/router.tsx` — replace static error element with boundary-aware UI
- `src/shared/lib/queryClient.ts` — add global query/mutation error reporting
- `src/shared/providers/AuthProvider.tsx` and/or layout UI — make support paths actionable
- `supabase/functions/billing-create/index.ts`
- `supabase/functions/billing-webhook/index.ts`
- `.env.example` / docs — add reporting/support env placeholders
- `openspec/config.yaml` — mark SDD-6 unblocked/ready

---

## 7. Integration Notes

- SDD-3 auth hardening already created explicit profile failure states; SDD-6 should report those safely.
- SDD-2 billing errors are the highest-value backend/edge reporting surface.
- SDD-4 cache/privacy requires strict no-PII error reporting.
- SDD-5 production ops supplies the env/docs baseline for new production configuration.

---

## 8. Recommended Next Phase

Proceed to **proposal** with these defaults unless overridden:

- Error service: Sentry-compatible wrapper, env-gated by DSN.
- Support channel: minimum viable actionable support link/email.
- Edge scope: structured billing errors required; external Deno reporting optional or follow-up.
