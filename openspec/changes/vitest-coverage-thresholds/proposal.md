# Proposal: Vitest Coverage Thresholds

## Intent

CarpinteroPro has 100+ Vitest files and growing SDD test investment, but `vite.config.ts` has no coverage provider or numeric regression gate. Add a lightweight signal so future work cannot silently reduce tested surface.

## Scope

### In Scope
- Configure Vitest coverage with V8 and repo-safe excludes.
- Add `test:coverage` script and threshold enforcement suitable for the current baseline.
- Update SDD/project docs so future packages know when coverage is required.
- Wire coverage into verification/CI without app behavior changes.

### Out of Scope
- Raising coverage by adding broad product tests.
- Enforcing 100% coverage or per-feature coverage ownership.
- Changing Playwright, pgTAP, Supabase migrations, or application source behavior.
- Installing dependencies during proposal/design phases.

## Capabilities

### New Capabilities
- `coverage-regression-gate`: Vitest coverage reporting and threshold policy for unit/integration tests.

### Modified Capabilities
- None.

## Approach

Use `@vitest/coverage-v8` aligned with Vitest 4.1.4. Configure coverage in `vite.config.ts`, excluding generated artifacts, tests, e2e snapshots, build output, Supabase functions/migrations, and type declarations. Add conservative global thresholds after measuring baseline; prefer a launch-safe 50% floor unless baseline requires lower initial thresholds with a ratchet note. Add `npm run test:coverage` and make verification run `npm test`, `npm run test:coverage`, `npm run lint`, and `npm run build`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` / `package-lock.json` | Modified | Add provider dependency and script. |
| `vite.config.ts` | Modified | Add Vitest coverage config and thresholds. |
| `openspec/config.yaml` | Modified | Replace “not configured yet” coverage gap with policy. |
| `docs/production-sdd-roadmap.md` or testing docs | Modified | Record gate for future SDD work. |
| CI/verification runner | Modified | Ensure coverage command participates in regression checks. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Initial threshold blocks launch | Med | Measure first, set conservative baseline, ratchet later. |
| Generated/config files distort coverage | Med | Maintain explicit excludes and document rationale. |
| CI becomes slower | Low | Keep only Vitest coverage in this gate; leave E2E separate. |

## Rollback Plan

Remove the coverage dependency/script/config and revert docs/config policy updates. Existing tests continue through `npm test`.

## Dependencies

- `@vitest/coverage-v8` compatible with `vitest@^4.1.4`.
- Existing CI/verification mechanism that can run npm scripts.

## Success Criteria

- [ ] `npm run test:coverage` exists and fails below configured thresholds.
- [ ] Coverage excludes generated/test/e2e/build artifacts intentionally.
- [ ] `npm test`, `npm run test:coverage`, `npm run lint`, and `npm run build` are the expected verification commands.
- [ ] Planned implementation fits one review slice under the 400-line budget; if forced chaining is applied, use a minimal one-slice chain.
