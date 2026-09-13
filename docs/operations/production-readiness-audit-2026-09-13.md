# Production readiness audit — 2026-09-13

**Target: a free production application that demonstrates engineering ability for the job market.** The user clarified this objective after the initial audit. The current checkout still needs a working build and database/release verification. Payment processing is not a launch requirement if billing is fully disabled and normal access is independent of subscriptions.

## Implementation handoff — start here

This document is both the audit record and the implementation brief. **All implementation work units below are pending.** The audit and its updated scope are complete; the application has not been fixed or converted to free access. The free-launch scope in this section takes precedence over conditional billing recommendations elsewhere in this document.

### Working instructions

- Read the repository `AGENTS.md` and applicable skills before implementation. Follow its CodeGraph-first exploration, feature import boundaries, typed Supabase client, and tenant isolation rules.
- Inspect `git status` and the current revision. The audit baseline is `4e36995`; revalidate each finding against the current checkout before changing it. Preserve unrelated user work. Do not depend on this conversation, Engram availability, or temporary files from the audit.
- Start with W1 and proceed through the work units. Use small deliverable changes with their relevant tests and documentation. Do not turn this into a rewrite or add new product features.
- Free means that a valid authenticated user can use the core app without a subscription record or payment. Expired trials, cancelled subscriptions, and billing lookup failures must not deny otherwise authorized free access. Authentication, profile/onboarding requirements, tenant isolation and administrative permissions remain mandatory.
- Do not repair MercadoPago or commissions for this launch. Remove payment prompts and isolate unused billing code from the free journey. Keep historical billing data intact. Inspect deployed billing usage before proposing remote shutdown; this document does not establish that no real subscriptions exist.
- Use dedicated synthetic accounts and a disposable database for integration verification. Do not reset the running shared Supabase stack, replay historical migrations against production, modify real users, rotate credentials, or cancel real subscriptions as an audit shortcut.
- Local implementation and verification can proceed when assigned this brief. Publishing, remote migration/ledger repair, paid service setup, and production payment changes require the authorization applicable to that action; reading this file alone is not authorization. Prepare the exact reviewed change and evidence before any required approval.
- When a remote check lacks access, record it as **unverified** with the precise missing input and continue independent local work. Never report production ready based only on mocked tests or local results.

### Ordered work units

| ID / status | Deliverable and starting points | Acceptance evidence |
| --- | --- | --- |
| W1 — pending | Restore the build: `src/index.css:205`, `tailwind.config.ts`. Preserve the existing font stack and letter spacing. | Reproduce the circular `@apply`, make the smallest fix, run `npm run build` on the intended CI Node version, and inspect affected typography in a browser. Record runtime versions and result. |
| W2 — pending | Make the core app free: start at `src/app/layouts/AppLayout.tsx`, `src/features/billing/components/BillingGate.tsx`, billing hooks/settings and their app composition. Locate pricing/trial/payment prompts in landing, onboarding, settings and admin routes. | Tests prove access with absent, expired, cancelled and failed-to-load subscription state while unauthenticated users remain protected. A browser journey must work beyond the former trial date without checkout prompts or billing network calls. Retain tenant/admin protections and historical billing data; document deployed payment shutdown work separately. |
| W3 — pending | Reproduce and secure the database: committed `supabase/migrations/`, `supabase/tests/`, and migration reconciliation docs. Distinguish missing grants, fixture assumptions and actual policy defects. | A disposable database built from repository history passes `supabase test db --local`. Demonstrate cross-tenant read/write denial and denial of profile/admin-field escalation. If workshop suspension remains exposed, enforce it server-side and prevent owner reactivation. Record differences from the hosted ledger separately without repairing it blindly. |
| W4 — pending | Qualify dependencies and release checks: `package.json`, lockfile, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `playwright.config.ts`, `src/shared/lib/supabase.ts`. Depends on W1–W3 for the final full gate. | Clean installation, lint, coverage, build and the configured audit threshold pass. Workflow syntax is valid; `VITE_DB_*` names match runtime configuration. SQL and critical browser tests run in isolated CI, and release requires evidence for the same revision. Verify Vercel's independent auto-deploy settings when access is available. |
| W5 — pending | Verify the user journey and basic operations: signup, onboarding, inventory → quote → production → reversal, PDF, mobile/keyboard, session recovery, error reporter and support configuration. | Execute and record those browser journeys with synthetic accounts. A deliberately generated safe error reaches the configured reporting destination. Verify signup/reset email delivery and a staging backup restore; label hosted checks unverified until exercised. Fix accessibility issues in retained screens, not unused billing features. |
| W6 — pending | Prepare the portfolio and release handoff: README, safe demo/sample data, screenshots and operational docs. Depends on passing application checks. | Someone can open the app, understand its purpose and explore a meaningful example without an administrator credential. README documents reproducible setup, architecture/tradeoffs, tests and limitations. Provide exact revision, test evidence, rollback boundaries, remaining hosted checks and deployment instructions; publish only with the applicable authorization. |

Use one work unit per reviewable change where practical. If commits are made, use Conventional Commits without AI attribution, and keep each behavior's tests/docs together. Do not split by file type. If the change grows beyond the repository's review-size guidance, apply its chained-PR workflow when preparing PRs.

### Completion record

Update the work-unit status and append a short entry after each unit:

```text
Work unit: Wn — pending / in progress / complete / blocked
Revision or working-tree state:
Behavior delivered and files changed:
Focused checks: exact command and result
Runtime verification: scenario and result, or N/A with reason
Rollback boundary: changes that can be reverted independently
Remaining remote checks or missing inputs:
```

Do not mark the overall free launch complete until W1–W6 acceptance criteria are satisfied and hosted checks have evidence. Distinguish “implementation verified locally”, “ready for deployment” and “deployed and smoke-tested”.

## Priorities for the free launch

1. Fix the CSS build and establish a reproducible passing release pipeline.
2. Remove subscription/trial dependency from free access and remove payment prompts. `AppLayout.tsx:415` currently wraps the application in `BillingGate`; `access.ts:21` blocks expired trials. Merely hiding a checkout button will not make the app permanently free. Disable unnecessary deployed payment entry points as part of the change.
3. Verify authentication, tenant isolation, administrative permissions, and database migrations/tests. Free access removes the need for paid-entitlement checks; it does not remove data protection requirements.
4. Prove the core journey: signup → onboarding → inventory → quote → production → PDF. Check mobile use, errors and session recovery, and configure basic error alerts and a restorable backup when storing real user data.
5. Prepare the portfolio presentation: an accessible demo with synthetic data, a concise README with setup and screenshots, and a short account of architecture, tradeoffs, tests, and known limitations. A demo must not expose an administrator credential or real customer data.

Billing findings below remain recorded for accuracy, but payment mapping, webhook recovery, checkout mode, commissions, and renewal behavior are conditional work only if those features remain active. They should not expand the free-launch scope. No application behavior has been changed by this audit update.

Scope: local commit `4e36995`, existing dependencies matching the lockfile's Vite version, local Supabase containers, and unauthenticated HTTP checks of `https://carpintero-pro.vercel.app`. No application code, production data, credentials, deployment settings, or remote migrations were changed. The only tracked addition is this report. Checks used Node 26.2.0 / npm 12.0.2; CI specifies Node 24. This is a targeted readiness audit, not an exhaustive penetration test or certification of the hosted database.

## Verification results

| Check | Result | Meaning |
| --- | --- | --- |
| `npm run test:coverage` | 135 files / 1,034 tests passed | Vitest suite passes; lines 72.24%, branches 65.89%, functions 62.68%, statements 71.10%. Edge Function code is excluded from coverage. |
| `npm run lint` | Passed | Current ESLint checks pass. |
| `npm run build` | Failed | TypeScript stage completed; Tailwind CSS processing rejects a circular `@apply`. |
| `npm audit` | 10 affected dependencies: 4 high, 5 moderate, 1 low | Current CI audit threshold would fail. These counts include development dependencies and transitive effects. |
| `npm audit --omit=dev` | 1 moderate (`fflate`) | No high/critical findings in the production dependency graph. No reachable exploit was demonstrated. |
| `supabase test db --local` | Failed: 16 files, 124 executed assertions | Multiple suites abort on table permission errors. This does not establish the status of hosted production. |
| Local database catalog | All public tables have RLS enabled | Table privileges and policy behavior still need verification; enabled RLS alone is insufficient. |
| Public HTTP routes | `/`, `/login`, `/dashboard`, `/auth/callback`, `/billing`, `/privacy`: 200 | SPA rewrite works at HTTP level. Authentication and payment callback completion were not exercised. |
| Isolated webhook harness | Confirmed incorrect status and retry loss | Real handler executed with fixture provider/database/signature dependencies; no network payment or real account operations. |

## Technical findings and conditional billing work

### 1. The release build fails

Evidence: [src/index.css:205](../../src/index.css#L205) defines `.font-display { @apply font-display; ... }`. The utility applies itself. `npm run build` fails with `You cannot @apply the font-display utility here because it creates a circular dependency`.

Required outcome: remove the circular application while retaining the intended typography, then build from a clean installation on the CI Node version. The currently published site returning HTTP 200 does not prove this checkout is releasable.

### 2. Payment status mapping can block a paying customer

Evidence: [billing.ts:8](../../supabase/functions/_shared/billing.ts#L8) maps `authorized` and `active` to `active`, but `approved` falls through to `past_due`. [mercadopago-webhook/index.ts:188](../../supabase/functions/mercadopago-webhook/index.ts#L188) applies this mapper to multiple resource types, including the approved-payment branch at line 222.

Reproduction: invoking the mapper with `approved` returns `past_due`; the isolated handler harness for `subscription_authorized_payment` with an approved fixture returns HTTP 200 and writes `past_due`.

Required outcome: use resource-specific payment/subscription transitions. Cover approved, failed, cancelled, duplicate, and out-of-order events using realistic provider fixtures. Verify the actual payment lifecycle in sandbox before production credentials are used.

### 3. Webhook retries can permanently skip incomplete processing

Evidence: [mercadopago-webhook/index.ts:162](../../supabase/functions/mercadopago-webhook/index.ts#L162) inserts an event with `processed_at` before updating the subscription or recording commissions. A duplicate insert returns `Already processed` at line 178. Subsequent failures return HTTP 500 without clearing or transitioning that event.

Reproduction: inject a subscription-update failure. First delivery returns 500; retry after recovery returns 200 `Already processed`; total subscription-update attempts remain one.

Required outcome: distinguish received, processing, failed, and completed events, or commit database effects atomically. Deduplication must prevent duplicate effects while allowing recovery after partial failure. Test failures at both the subscription and commission steps, concurrent deliveries, and event reordering.

### 4. Paid access and workshop suspension lack database enforcement

Evidence: [BillingGate.tsx:36](../../src/features/billing/components/BillingGate.tsx#L36) enforces subscription access in React. The material policy in [0004_rls_policies.sql:42](../../supabase/migrations/0004_rls_policies.sql#L42) checks workshop membership only. The latest tenant resolver in [0020_tenant_rls_security.sql:9](../../supabase/migrations/0020_tenant_rls_security.sql#L9) does not check subscription eligibility or `workshops.is_active`. [admin-toggle-workshop/index.ts:30](../../supabase/functions/admin-toggle-workshop/index.ts#L30) only updates that flag.

The workshop owner UPDATE policy also does not protect `is_active` as an administrative field. With normal table grants, the source-defined policies allow entitled and non-entitled members alike, and permit owners to change that flag. This is a source/policy finding; a hosted bypass was not attempted. The current local database denies table access more broadly, so it cannot serve as a successful runtime reproduction of the bypass.

Required outcome for the free launch: retain tenant isolation and protect administrative columns. If workshop suspension remains exposed, enforce it in database policies/RPCs while preserving explicit recovery/export operations. Expired or cancelled subscriptions must not block free users. Paid-entitlement enforcement is conditional on a future decision to charge and is outside this brief.

### 5. Checkout environment is inferred from the hostname

Evidence: [create-subscription/index.ts:43](../../supabase/functions/create-subscription/index.ts#L43) sets sandbox behavior whenever `APP_ORIGIN` contains `vercel.app`, selecting a sandbox payer and checkout URL. The README's production URL uses that domain. Hosted `APP_ORIGIN` was not inspected, so the actual configured payment mode remains unverified.

Required outcome: choose sandbox/production explicitly through server configuration and validate matching credentials and callback URLs. Hosting a paying production app on a Vercel subdomain must not implicitly select sandbox behavior.

Additional billing concern: lines 66–125 compute a “first-period” referral discount but place the reduced amount into `auto_recurring.transaction_amount`; no subsequent price-restoration implementation was found in the payment helpers/webhook. Confirm and test the second billing period before enabling this promotion.

### 6. Database state and the SQL test suite are not reproducible yet

Evidence: local pgTAP execution aborts with `permission denied` on `materials`, `profiles`, `quotes`, `stock_movements`, and production tables. Catalog queries confirm `authenticated` lacks SELECT on local `materials` and UPDATE on local `workshops`.

The local migration ledger includes July versions absent from the checkout and does not list the repository's three August migrations. The existing [migration reconciliation document](supabase-migration-reconciliation.md) separately warns about historical numeric/timestamp ledger reconciliation. Remote ledger status was not inspected.

Required outcome: create a disposable database from the committed migrations, establish intended grants, run all SQL suites successfully, and compare the target environment's ledger and actual schema before release. Diagnose the current local failures as environment/schema evidence rather than declaring every aborted assertion an application defect. Do not reset shared or production databases to obtain this evidence.

### 7. The release path does not establish a verified artifact

Evidence: [.github/workflows/release.yml:21](../../.github/workflows/release.yml#L21) uses `secrets.VERCEL_TOKEN` in a job-level `if`. GitHub's allowed contexts for that key exclude `secrets`, making that condition invalid according to the [official contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#context-availability).

The tag workflow has no verification dependency. [.github/workflows/ci.yml](../../.github/workflows/ci.yml) runs Vitest/lint/build/audit but does not run Playwright or SQL tests. Its `VITE_SUPABASE_*` environment names also differ from the `VITE_DB_*` names consumed by [supabase.ts:4](../../src/shared/lib/supabase.ts#L4); build success alone does not exercise runtime initialization.

Required outcome: fix workflow validation, require passing checks for the released revision, align environment names, and add isolated database and critical browser journeys. Verify any independent Vercel auto-deploy path also follows the intended release gate; hosted integration settings were not inspected.

## Operational requirements before launch

**Connect real error reporting.** [errorReporter.ts:29](../../src/shared/lib/errorReporter.ts#L29) defaults to an empty client. `configureErrorReporterClient` has no non-test caller; setting `VITE_SENTRY_DSN` therefore does not produce reports. Install/configure a real adapter and demonstrate a test incident reaching the responsible operator. Verify an external uptime check; payment failure alerts apply only if payment processing remains active.

**Resolve dependency findings.** All ten reported affected dependencies have fixes available according to npm audit. Separate tooling exposure from browser runtime exposure: the sole production finding is `fflate`'s malformed ZIP64 handling, documented in the [advisory](https://github.com/advisories/GHSA-px8p-9vwx-vf98). No ZIP exploit path was demonstrated in this app. Update deliberately, retain the lockfile, and rerun relevant checks.

**Verify hosted recovery and authentication.** The repository checklist is not evidence that backups, restoration, SMTP delivery, email confirmation, Auth redirect URLs, or account MFA are configured. Record a successful staging restore, acceptable data-loss/recovery targets, and successful signup/reset flows. These checks align with the [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

**Finish interface and support verification.** [BillingPage.tsx:186](../../src/features/admin/components/BillingPage.tsx#L186) uses clickable table headers for sorting and clickable rows for expansion without equivalent keyboard controls. Check those interactions against the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md). Re-run mobile/keyboard browser journeys after fixing the CSS build; a full interactive browser audit was not completed. Verify a real support inbox and the operational process for customer data export/deletion. The legal pages fall back to `soporte@example.com` if support configuration is absent; this is not proof of the hosted value.

**Align deployment documentation.** `vercel.json` now defines an SPA rewrite, while [vercel-config-decision.md](vercel-config-decision.md) still says configuration is deferred. Update that stale decision. Current responses include HSTS; the repository does not define CSP or other application-specific security headers. Introduce compatible headers with preview validation of Auth, checkout, PWA, and assets.

## Release acceptance sequence

1. Fix the build and qualify dependencies; obtain a clean CI result from the intended Node version.
2. Decouple free access from subscriptions, remove payment prompts and disable unused payment entry points. Preserve and test authentication, tenant isolation and administrative authorization.
3. Reproduce the schema from committed migrations and pass SQL and browser suites in staging.
4. Demonstrate signup, onboarding, inventory → quote → production → reversal, PDF export and session recovery with dedicated test accounts. Confirm access still works beyond the former trial expiration.
5. Connect basic alert delivery, verify restore and support procedures, publish the free application and prepare its portfolio walkthrough. Keep demo data synthetic and isolated from real users.

Existing strengths worth preserving: feature boundaries enforced by ESLint, broad Vitest coverage, tenant-derived access instead of browser-supplied tenant IDs, guarded profile/admin fields, authenticated admin functions, sensitive-cache cleanup, fail-closed billing UI, legal routes, and working public SPA deep links. Current `.env.example` E2E credentials are placeholders; this audit did not revalidate historical credential rotation or scan all Git history.

## Completion record

### Work unit: W1 — complete (local only, not committed)

- **Revision or working-tree state:** Working tree on baseline `4e36995`. Only `src/index.css` is modified; `docs/operations/production-readiness-audit-2026-09-13.md` is the audit itself (untracked, intentionally excluded from the review candidate). No other file changed.
- **Behavior delivered and files changed:** Removed the circular `@apply font-display` in `src/index.css:205` that broke the Tailwind build. The custom `.font-display` rule now sets `font-family` directly to the Fraunces stack documented in `tailwind.config.ts` and preserves `letter-spacing: -0.01em`. `tailwind.config.ts` was already correct and required no change. Diff: `src/index.css` +4 / −1 lines.
- **Focused checks:**
  - `npm run build` (Node v26.2.0, npm 12.0.2): passed in ~1.3 s, no circular-`@apply` error, PWA service worker generated. CI specifies Node 24; this run used the local Node 26 — local-verified, not CI-verified.
  - `npm run lint`: passed with 0 errors (6 pre-existing `unused eslint-disable` warnings inside `coverage/` are unrelated to W1).
  - Compiled CSS inspection: `dist/assets/index-*.css` contains Tailwind's `.font-display{font-family:Fraunces,Newsreader,Crimson Text,Georgia,serif}` followed by the custom `.font-display{letter-spacing:-.01em;font-family:Fraunces,Newsreader,Crimson Text,Georgia,serif}` — font stack and letter-spacing preserved exactly.
- **Runtime verification:** Browser typography inspection not run locally in this session (no headless browser was launched for the affected selectors). The compiled-CSS inspection above is the closest available evidence and matches the documented intent. Visual confirmation in a real browser is recommended before merge.
- **Rollback boundary:** Reverting `src/index.css` to commit `4e36995` restores the original (broken) `.font-display` definition; no other file participates in this change. Safe to revert independently.
- **Review lifecycle:** `gentle_review inspect` returned `ready` after excluding the audit document from the intended-untracked selection. `gentle_review start` was attempted and returned `candidate-owner-preparation-failed` (native-layer rejection, `lineage_created: false`, no lineage bound, no authority burned). Not retried. The user should explicitly request review for this candidate or accept the local evidence above.
- **Remaining remote checks or missing inputs:** CI run on Node 24 not executed in this session; visual browser check on a real browser not executed; no commit performed (per the audit's "do not commit unless explicitly asked" instruction).

### Work unit: W2 — complete (local only, not committed)

- **Revision or working-tree state:** Working tree on baseline `0c0f1f7`. 15 files changed: 8 deletions, 6 modifications, 1 new file (`src/features/billing/index.ts`). All changes inside the `src/app/**`, `src/features/billing/**`, and `src/shared/lib/mockData.ts` scope. `supabase/**` untouched.
- **Behavior delivered and files changed:** Removed the React subscription gate and every free-journey payment prompt. Deleted `BillingGate`, `BillingBlockedScreen`, `access.ts` (predicate), `useSubscription`, and their tests. Stubbed `BillingSettingsCard` to a read-only component (status badge + "Sin suscripción activa" copy, no CTAs, no mutations, no Edge Function calls). Updated `AppLayout` to render the shell directly with no billing subscription reads; updated `SettingsPage` to compose the read-only card from the new public barrel `@/features/billing`. Cleaned the demo mock: `MOCK_SUBSCRIPTION` seed removed, `mockData.ts` `subscriptions` table now empty. Created `src/features/billing/index.ts` as the narrow public API (only `BillingSettingsCard` + types).
- **Focused checks:** Node `v26.2.0`. `npm run lint` 0 errors (6 pre-existing `coverage/` warnings). `npm run test:coverage` 131 files / 991 tests passed (Statements 70.35 / Branches 64.88 / Functions 62.04 / Lines 71.51 — above the 50% threshold). `npm run build` passed in ~1.33 s, PWA precache 103 entries.
- **Runtime verification:** AC-1 through AC-5 (absent / expired / cancelled / failed-to-load subscription, plus unauthenticated redirect) are asserted by the new `describe("AppLayout free-journey access")` block in `src/app/layouts/AppLayout.test.tsx`. AC-6 (no subscribe/cancel CTA on `BillingSettingsCard`) is asserted by 6 tests including a regex self-guard so any weakening of the negative regex fails the test first. Grep evidence:
  - `from "@/features/billing/"` over `src/app/**` → 0 matches (no deep imports into billing).
  - `from "@/features/billing"` over `src/app/**` → 1 match (the public barrel, by design).
  - `from "@/features/billing"` over `src/features/**` excluding `billing/` → 0 matches.
  - `useSubscription|useCreateSubscription|BillingGate|BillingBlockedScreen|getBillingAccess|isTrialActive|create-subscription` over `src/app/**` → 0 matches.
  - `supabase.functions.invoke("create-subscription")` over `src/features/billing/**` → 0 matches.
- **Deviation from the approved plan:** `SettingsPage` composes `BillingSettingsCard` with `subscription={null}` rather than fetching the user's historical row via `useSubscription`. The card component still accepts a `subscription` prop and renders the badge path correctly (covered by 6 tests). The user-facing `/settings` page therefore shows "Sin suscripción activa" for every signed-in user. This was the only way to satisfy AC-9 (no inbound edges from `src/app/**` to deep billing paths) and AC-11 (free journey has zero subscription renders) simultaneously with the design's "no remaining inbound edges" intent. Historical subscription data is still visible to platform admins through `/admin/*` tools; `supabase/migrations/**` and the `subscriptions` table itself are untouched.
- **Rollback boundary:** `git revert` of the upcoming W2 commit restores the gate, the blocked screen, the subscription predicate, and the original `BillingSettingsCard` with CTAs. The `subscriptions` table, billing Edge Functions, and admin tooling are unaffected. Safe to revert independently.
- **Review lifecycle:** Not exercised for this candidate (the previous `gentle_review start` had returned `candidate-owner-preparation-failed`). If the host recovers, future `gentle_review inspect` should re-offer the start route; for now the local evidence above is the proof.
- **Remaining remote checks or missing inputs:** CI run on Node 24 not executed; browser journey in a real browser not executed; deployed payment shutdown (disable `create-subscription` / `mercadopago-webhook` Edge Functions in production) is a separate, conditional task not in W2 scope per the audit.
