# Verify — Tenant RLS Security

**Status: PASS.**

See `verify-report.md` for full details.

## Summary

- SQL/RLS, frontend tests, lint, and build all pass locally.
- Core spec is implemented: RLS no longer trusts `x-workshop-id`, `workshops` has own-workshop RLS, and frontend header mutation was removed.
- The prior strict-TDD blocker is resolved: `apply-progress.md` now contains a `TDD Cycle Evidence` table with RED/GREEN/TRIANGULATE evidence.
- **Warnings:** review packaging still needs stacked PR handling or an explicit `size:exception`, and migration renumbering requires a remote-safe deployment plan before any remote Supabase operation.

## Commands run

```bash
sg docker -c 'supabase test db' && npm test && npm run lint && npm run build
```

Results: SQL tests PASS (10/10), Vitest PASS (141/141), lint PASS with 6 warnings, build PASS.
