# SDD-6 Apply Progress — PR A

## Status

**PR A implemented / awaiting fresh review**

## Scope Applied

Implemented PR A only:

- shared frontend error reporter wrapper
- support contact helper
- React ErrorBoundary and fallback UI
- global browser error/unhandled rejection handler registration helper
- Vite env typings for `VITE_SENTRY_DSN` and `VITE_SUPPORT_EMAIL`
- `.env.example` placeholders for observability/support variables

Not implemented yet:

- PR B app/router/query/support UI wiring
- PR C structured billing edge errors

## Strict TDD Evidence

| Cycle | RED evidence | GREEN evidence | Notes |
| --- | --- | --- | --- |
| Reporter | `errorReporter.test.ts` initially failed because `./errorReporter` did not exist. | Implemented `errorReporter.ts`; focused tests pass. | Env-gated no-op/client seam, unknown errors, and context allowlist covered. |
| Support contact | `supportContact.test.ts` initially failed because `./supportContact` did not exist, then failed on mailto space encoding. | Implemented helper and fixed encoding with `encodeURIComponent`; focused tests pass. | No broken `mailto:` when email is absent/invalid. |
| ErrorBoundary | `ErrorBoundary.test.tsx` initially failed before component existed. | Implemented class-based ErrorBoundary and fallback component; focused tests pass. | Class component is intentional because React error boundaries require lifecycle methods. |
| Global handlers | `registerGlobalErrorHandlers.test.ts` initially failed before helper existed. | Implemented registration/cleanup helper; focused tests pass. | Covers `error`, `unhandledrejection`, and cleanup. |

## Fresh Review Fix

A fresh reviewer found one blocker: arbitrary `tags` could forward PII despite the privacy allowlist. The reporter now removes free-form tags entirely and forwards only explicit top-level allowlisted context. A nice-to-have was also fixed: `supportEmail={null}` now explicitly disables support links even if `VITE_SUPPORT_EMAIL` is configured.

## Validation

| Command | Result |
| --- | --- |
| `npm test -- src/shared/lib/errorReporter.test.ts src/shared/lib/supportContact.test.ts src/shared/components/ErrorBoundary.test.tsx src/shared/lib/registerGlobalErrorHandlers.test.ts` | PASS — 4 files / 16 tests |
| `npm test` | PASS — 34 files / 246 tests |
| `npm run lint` | PASS with 6 pre-existing React Compiler/RHF `watch()` warnings |
| `npm run build` | PASS |
| `git diff --check` | PASS |

## Review Workload

PR A code/test files are larger than forecast because strict TDD added focused coverage for each helper. Keep PR B and PR C separate; do not continue implementation in the same diff without review/approval.

Unrelated dirty repo state remains excluded:

- `supabase/.temp/cli-latest`
- `.playwright-mcp/`

## Changed Files for PR A

- `.env.example`
- `src/vite-env.d.ts`
- `src/shared/lib/errorReporter.ts`
- `src/shared/lib/errorReporter.test.ts`
- `src/shared/lib/supportContact.ts`
- `src/shared/lib/supportContact.test.ts`
- `src/shared/components/ErrorBoundary.tsx`
- `src/shared/components/ErrorBoundary.test.tsx`
- `src/shared/lib/registerGlobalErrorHandlers.ts`
- `src/shared/lib/registerGlobalErrorHandlers.test.ts`
- `openspec/changes/2026-06-02-sdd-6-observability-support/apply-progress.md`

## Next

Run fresh review before deciding whether to apply PR B.
