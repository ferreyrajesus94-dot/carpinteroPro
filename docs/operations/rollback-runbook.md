# Rollback runbook

Use this runbook when production is unhealthy after a release. Classify the incident first, choose the least destructive recovery path, and record what changed.

## Quick path

1. Classify the incident: frontend, Edge Function, database, or mixed.
2. Stop further deploys until an owner is assigned.
3. Prefer reversible actions: Vercel revert, previous function version, or reviewed forward-fix.
4. Escalate database recovery before direct production manipulation.
5. Verify recovery and record the timeline.

## Incident classification

| Type | Signals | First action |
| --- | --- | --- |
| Frontend-only | Broken UI, failed Vite chunks, route errors after Vercel deploy | Revert to previous Vercel deployment. |
| Edge Function-only | Billing/webhook/function errors while database and UI are healthy | Redeploy previous function version or fix function secret/config. |
| Migration/database | Missing data, RLS failures, schema errors, failed migrations | Escalate; choose PITR, backup restore, or forward-fix migration. |
| Mixed | Multiple systems failing or unknown blast radius | Freeze deploys and coordinate frontend, Supabase, and billing owners. |

## Vercel frontend rollback

- [ ] Open the Vercel project dashboard.
- [ ] Find the last known good production deployment.
- [ ] Use Vercel's promote/redeploy/revert action for that deployment.
- [ ] Verify the production URL loads.
- [ ] Verify a nested app route loads by direct URL.
- [ ] Check browser console for missing JS/CSS chunk errors.
- [ ] Record deployment ID, rollback time, and verifier.

## Edge Function recovery

- [ ] Identify the affected function and last known good revision.
- [ ] Confirm required secrets still exist in Supabase.
- [ ] Redeploy the previous function version from the dashboard or CLI.
- [ ] Retest the affected flow, such as MercadoPago checkout or webhook processing.
- [ ] Record function name, version/source reference, and verification result.

## Database recovery decision tree

```text
Was data corrupted or deleted?
├─ No, schema/policy bug only
│  ├─ Can a reviewed forward-fix migration restore service safely?
│  │  ├─ Yes → write/apply forward-fix migration with approval.
│  │  └─ No  → escalate to restore/PITR decision.
│  └─ Do not manually patch production without approval.
└─ Yes, data impact exists
   ├─ Is PITR available and acceptable for the blast radius?
   │  ├─ Yes → coordinate PITR with Supabase operator approval.
   │  └─ No  → evaluate latest backup restore or manual recovery plan.
   └─ Escalate before destructive or irreversible actions.
```

Approval-required operations:

- Direct production data edits.
- Migration ledger repair.
- Backup restore or PITR.
- Dropping/recreating production objects.
- Replaying old migrations against the linked project.

## Communication checklist

Record this in the incident channel or ticket:

- [ ] Incident start time and detection source.
- [ ] User impact and affected workflows.
- [ ] Current owner and decision maker.
- [ ] Action taken: revert, redeploy, forward-fix, restore, or monitor.
- [ ] Verification performed after recovery.
- [ ] Remaining follow-ups and SDD 6 observability/support gaps.

## Recovery verification

- [ ] Auth works for an existing user.
- [ ] Dashboard loads without cross-tenant leakage.
- [ ] Touched feature path works.
- [ ] Billing/webhook path works if involved.
- [ ] No new console, function, or database errors are visible in available dashboards.

## Out of scope / SDD 6 handoff

This runbook documents manual recovery. Automated alerting, uptime monitoring, structured logs, support workflows, and health checks are deferred to SDD 6.
