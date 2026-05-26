status: changes_requested

executive_summary: >
  The parent fixes close two of the three prior findings: the blocked primary action now calls
  `useCreateSubscription().mutateAsync()` and redirects to the returned MercadoPago `initPoint`,
  and support text is now rendered as real WhatsApp/mailto links. The gate also now re-evaluates
  short-lived trial/current-period boundaries with a timer, and the new targeted tests pass.
  However, the timeout-cap implementation has a remaining edge case for boundaries farther than
  `MAX_TIMEOUT_MS` (~24.8 days): it fires once early and does not reschedule, so a monthly
  cancel-at-period-end subscription can still remain allowed past its real boundary while the app
  stays open.

findings:
  - severity: major
    file: src/features/billing/components/BillingGate.tsx:50
    evidence: |
      `BillingGate` schedules `setTimeout(() => setNow(new Date()), Math.min(delay, MAX_TIMEOUT_MS))`
      at lines 50-58, with the effect depending only on `nextBoundary` at line 59. `nextBoundary`
      is memoized from `subscription` at lines 45-48, so if the boundary is more than
      `MAX_TIMEOUT_MS` in the future, the capped timer fires after ~24.8 days, updates `now`, and
      re-renders while `nextBoundary` is still the same memoized Date object. Because the effect
      dependency does not change, no second timer is scheduled for the remaining time. This means
      active subscriptions cancelled at period end with a typical ~30-day boundary can remain
      allowed after `current_period_ends_at` until another unrelated render/refetch occurs.
      The new timer test in `src/features/billing/components/BillingGate.test.tsx` covers a
      1-second trial boundary, but not the capped long-delay rescheduling path.
    smallest_safe_fix: >
      Reschedule when the capped timer fires before the boundary. For example, include `now` (or a
      monotonic tick state) in the effect dependency and compute the next remaining delay from that
      state, or only use the cap in a helper that recursively schedules chunks until the actual
      boundary is reached. Add a fake-timer test for an active `cancel_at_period_end` subscription
      whose `current_period_ends_at` is greater than `MAX_TIMEOUT_MS` away, advancing first to the
      cap and then to the real boundary.

validation_checked:
  - `git status --short` shows modified `src/app/layouts/AppLayout.tsx` and untracked PR3 billing source/tests plus apply/review artifacts.
  - Inspected current diff for `src/app/layouts/AppLayout.tsx` and untracked files under `src/features/billing/**`.
  - Verified payment action wiring at `src/app/layouts/AppLayout.tsx:52-55` and `src/app/layouts/AppLayout.tsx:249-257`.
  - Verified support links at `src/features/billing/components/BillingBlockedScreen.tsx:60-77`.
  - Verified timer implementation at `src/features/billing/components/BillingGate.tsx:43-59` and tests in `src/features/billing/components/BillingGate.test.tsx`.
  - Ran targeted fixed-area tests: `npm test -- --run src/features/billing/components/BillingGate.test.tsx src/features/billing/components/BillingBlockedScreen.test.tsx src/app/layouts/AppLayout.test.tsx` → 3 files / 20 tests passed.
  - Did not re-run full `npm test`, `npm run lint`, or `npm run build`; parent-reported validation says full tests 202 passed, lint 0 errors/6 pre-existing warnings, build success.

review_workload_decision: >
  Keep PR3 as a size exception rather than splitting. The current touched/untracked PR3 files are
  about 1,108 lines including tests and the apply artifact, but production code remains a focused
  frontend billing-gate slice and most of the excess is strict-TDD coverage. Splitting tests from
  code would reduce review size at the cost of weakening the work-unit/TDD evidence. The remaining
  fix should be small and localized to `BillingGate` plus one test.

recommendation: >
  Request one more change before merge: make the boundary timer robust for delays beyond the browser
  timeout cap, then re-run the targeted PR3 tests. After that, this PR3 can proceed as a documented
  size exception.

skill_resolution: none
