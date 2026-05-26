status: changes_requested

executive_summary: >
  PR3 is mostly well-structured and matches the frontend-gate slice: billing code is feature-scoped, the query is enabled only after workshop/onboarding context exists, backend code was not touched, and the test/lint/build evidence is green. However, I found two major product-contract gaps in the blocked UX/gate behavior: the gate does not re-evaluate automatically when a trial expires while the app is open, and the blocked screen's primary payment action only navigates to /settings, which is itself gated, so blocked users have no working way to start/fix payment. There is also a minor UX/spec gap: support is mentioned but not linked.

findings:
  - severity: major
    file: src/features/billing/components/BillingGate.tsx:17
    evidence: |
      BillingGate computes access from `getBillingAccess(subscription ?? null, new Date())` during render only. There is no timer, interval, refetch scheduling, or `now` state update tied to `trial_ends_at` / `current_period_ends_at`. `src/features/billing/lib/access.ts:21-23` correctly blocks expired trials when evaluated, but nothing forces re-evaluation when the clock passes the end timestamp while the user keeps the app open.
      This misses `openspec/changes/sdd-2-billing-mercadopago/spec.md` "Immediate Gate at Trial End" and the PR3 task requirement to gate immediately with no grace period.
    smallest_safe_fix: >
      Add a small clock invalidation in BillingGate or a dedicated hook: when the current subscription is time-bound, schedule a `setTimeout` for the next boundary (`trial_ends_at` or active `current_period_ends_at` when `cancel_at_period_end`) and update local `now` state / invalidate the subscription query at that time. Add a component test with fake timers proving an initially-allowed trial renders the blocked screen after the timeout fires.

  - severity: major
    file: src/app/layouts/AppLayout.tsx:242
    evidence: |
      The blocked screen receives `onStartPayment={() => navigate('/settings')}` at `src/app/layouts/AppLayout.tsx:243-247`. But AppLayout wraps the entire app shell, including `/settings`, in BillingGate, so a blocked user clicking the primary payment button stays inside the blocked gate rather than reaching a billing/payment flow. The Edge Function mutation exists in `src/features/billing/hooks/useBillingActions.ts:5-24`, but the blocked screen does not use it and does not redirect to the returned `initPoint`.
      This does not satisfy the spec's Blocked-State UX boundary requiring a primary action to start/fix payment.
    smallest_safe_fix: >
      Wire the blocked-screen primary action to `useCreateSubscription().mutateAsync()`, then redirect to `data.initPoint` when present; otherwise show a safe error/support fallback. Alternatively, explicitly allow a billing-only settings route that renders only billing UI, but do not point the button at a route still hidden behind the same gate.

  - severity: minor
    file: src/features/billing/components/BillingBlockedScreen.tsx:54
    evidence: |
      The screen says "Contactanos por WhatsApp o email" at `src/features/billing/components/BillingBlockedScreen.tsx:54-56`, but it is plain text. The spec says the billing-only screen must provide logout/support links.
    smallest_safe_fix: >
      Replace the support text with an actual `mailto:` and/or WhatsApp anchor/button, and add a test asserting the support link exists. Ensure no workshop/business data is included in the link text or URL.

validation_checked:
  - Read `openspec/config.yaml`, SDD 2 spec/design/tasks, and `apply-pr3-progress.md`.
  - Inspected current git status/diff and all untracked PR3 source/test files under `src/features/billing/` plus `src/app/layouts/AppLayout.tsx` and `src/app/layouts/AppLayout.test.tsx`.
  - Ran targeted PR3 tests: `npm test -- --run src/features/billing/lib/access.test.ts src/features/billing/hooks/useSubscription.test.ts src/features/billing/components/BillingBlockedScreen.test.tsx src/features/billing/components/BillingGate.test.tsx src/app/layouts/AppLayout.test.tsx` → 5 files / 40 tests passed.
  - Ran full tests: `npm test` → 27 files / 198 tests passed.
  - Ran `npm run lint` → 0 errors, 6 pre-existing React Hook Form compiler warnings in unrelated files.
  - Ran `npm run build` → success.

review_workload_decision: >
  Size exception is reasonable after the major fixes are made. The current PR3 diff is about 828 source/test lines plus a 93-line apply artifact; production code is roughly 275 lines and the excess is mostly tests required by strict TDD. Splitting tests away from code would reduce review size but weaken the tests-with-code rule. Do not split solely for size; keep as one PR3 with a size-exception note, unless additional production changes grow materially beyond the small fixes above.

risks:
  - Without a time-bound re-evaluation, users can retain app access after trial expiration until some unrelated render/refetch/navigation occurs.
  - Without a working payment action, the fail-closed gate can strand unpaid users with only logout/support text.
  - Existing tests are useful but slightly overfit static render states; they do not yet exercise time passing after render or a real start-payment callback.

recommendation: >
  Request changes for the two major issues before merge. After fixing them, keep this as a single PR3 size-exception because the scope is the approved frontend gate slice and most added lines are test coverage.

skill_resolution: none
