# Archive Report — sdd-2-billing-mercadopago

## Status

PASS — SDD 2 verified complete enough to archive; archive-time fallback was approved for the legacy flat spec.

## Artifacts read

- `openspec/config.yaml`
- `docs/production-sdd-roadmap.md`
- `openspec/changes/sdd-2-billing-mercadopago/proposal.md`
- `openspec/changes/sdd-2-billing-mercadopago/spec.md`
- `openspec/changes/sdd-2-billing-mercadopago/design.md`
- `openspec/changes/sdd-2-billing-mercadopago/tasks.md`
- `openspec/changes/sdd-2-billing-mercadopago/verify-report.md`
- `openspec/changes/sdd-2-billing-mercadopago/apply-pr1-progress.md`
- `openspec/changes/sdd-2-billing-mercadopago/apply-pr2-progress.md`
- `openspec/changes/sdd-2-billing-mercadopago/apply-pr3-progress.md`
- `openspec/changes/sdd-2-billing-mercadopago/apply-pr4-progress.md`
- `git log --oneline --decorate -n 12 main`

## Domains reviewed

- Billing Schema & RLS
- Trial Lifecycle
- MercadoPago Subscription Creation
- Webhook Processing
- Billing Gate
- Settings Billing
- Configuration & Legal Alignment

## Requirement names preserved in the canonical fallback copy

- Subscriptions Table Structure
- Tenant Isolation via RLS
- SQL-Level Isolation Tests
- Trial Start Trigger
- Trial Expiry Enforcement
- Server-Side Subscription Creation
- No Secret Exposure
- Subscription Record Linkage
- Webhook Endpoint
- Webhook Verification
- Idempotency and Duplicate Handling
- State Reconciliation
- Cross-Tenant Event Safety
- App Shell Billing Check
- Blocked-State UX Boundaries
- Immediate Gate at Trial End
- Billing Status Display
- Start Payment Action
- Cancellation Action
- Environment Variables
- Price Authority
- Legal Copy Alignment
- Frontend Unit Tests
- SQL/RLS Tests
- Webhook Verification Checklist

## Archive notes

- PRs through `#56` are merged on `main`; current `git log` shows `2674cb4 fix(billing): validate MercadoPago subscription webhooks (#56)` at `HEAD`.
- Signed MercadoPago dashboard simulation evidence and DB mutation are recorded in `apply-pr4-progress.md` and summarized in `verify-report.md`.
- `verify-report.md` still notes review-budget failure for normal single-PR readiness, but functional validation and signed webhook verification both passed.
- No active same-domain sibling change was found under `openspec/changes/*/spec.md`.
- Archive-time fallback was approved because this change only had a legacy flat `spec.md` and no `sync-report.md`.
- Canonical fallback copy created at `openspec/specs/sdd-2-billing-mercadopago/spec.md` before moving the change.
- No destructive merge was required.
- No Engram memory tool was available in this toolset, so no memory observation ID was recorded.

## Archived path

`openspec/changes/archive/2026-05-31-sdd-2-billing-mercadopago/`
