# Design: Vitest Coverage Thresholds

## Technical Approach

Add a Vitest-native coverage gate without changing application behavior. The implementation will extend the existing `vite.config.ts` `test` block with V8 coverage, add the matching provider dependency and `test:coverage` script, document the four-command verification contract, and introduce CI only if no existing workflow is present. Thresholds are set after measuring the current suite so the first gate prevents regression rather than demanding new coverage.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| V8 provider in `vite.config.ts` vs separate config | Shared config keeps `npm test`, IDE Vitest, and coverage policy aligned; separate config can drift. | Use `test.coverage` in `vite.config.ts` with `provider: "v8"`. |
| Conservative global thresholds vs per-file gates | Global thresholds are launch-safe for an existing mixed-coverage codebase; per-file gates would create noisy failures. | Set global `lines`, `branches`, `functions`, `statements` at or below measured baseline. |
| Exclude backend/generated surfaces vs count everything | Vitest JS coverage cannot fairly measure Deno Edge Functions, SQL migrations, generated types, build output, or tests. | Maintain explicit coverage excludes and document the rationale. |
| Forced chained strategy vs single PR | The change is expected under 400 changed lines, but session preflight forces chaining. | Plan a minimal one-slice chain; no `size:exception` needed unless CI artifact upload expands unexpectedly. |

## Data Flow

```text
package.json test:coverage
  └─ vitest run --coverage
      └─ vite.config.ts test.coverage
          ├─ @vitest/coverage-v8 instrumentation
          ├─ coverage.exclude filters repository noise
          ├─ coverage.thresholds enforce baseline floor
          └─ coverage/{html,lcov,json} + stdout summary
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Add `test:coverage` and dev dependency `@vitest/coverage-v8` aligned with `vitest@^4.1.4`. |
| `package-lock.json` | Modify | Lock the coverage provider dependency. |
| `vite.config.ts` | Modify | Add `test.coverage` provider, reporters, excludes, and global thresholds. |
| `openspec/config.yaml` | Modify | Replace “not configured yet” with coverage policy, ratchet guidance, and four-command verification. |
| `docs/production-sdd-roadmap.md` or `docs/testing/runbook.md` | Modify | Document the coverage gate and verification expectations for future SDD work. |
| `.github/workflows/ci.yml` | Create if absent | Run `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`; upload coverage artifacts. |

## Interfaces / Contracts

Coverage config shape:

```ts
coverage: {
  provider: "v8",
  reporter: ["text", "html", "lcov", "json"],
  exclude: [
    "tests/**", "tests/e2e/**", "**/*.test.{ts,tsx}",
    "dist/**", "coverage/**", "**/*.d.ts",
    "src/shared/lib/database.ts",
    "supabase/functions/**", "supabase/migrations/**",
  ],
  thresholds: { lines: 50, branches: 50, functions: 50, statements: 50 },
}
```

During apply, first run `npx vitest run --coverage --coverage.thresholds.lines=0 --coverage.thresholds.branches=0 --coverage.thresholds.functions=0 --coverage.thresholds.statements=0` or equivalent temporary local config to capture baseline. If any metric is below 50, set that metric at or slightly below the measured value and record the ratchet note in docs.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Config | Coverage provider, reporters, excludes, thresholds | Prefer a focused config assertion test only if static review is insufficient; avoid brittle Vite plugin introspection. |
| Script | One-shot coverage command | Run `npm run test:coverage` and verify non-watch execution plus report output. |
| CI | Regression gate and artifact availability | Workflow runs four commands; coverage artifacts upload on completion/failure. |
| Verification | Existing suite still passes | Run `npm test`, `npm run test:coverage`, `npm run lint`, `npm run build`. |

## Migration / Rollout

No data migration required. Roll out as one forced-chain slice: coverage dependency/config/script, docs, and CI together so the gate is reviewable and rollback is a single revert. Rollback removes provider dependency, script, coverage config, CI coverage step, and docs policy; `npm test` remains unchanged.

## Open Questions

- [ ] Confirm whether CI should be GitHub Actions under `.github/workflows/ci.yml` because no workflow currently exists in the repository.
