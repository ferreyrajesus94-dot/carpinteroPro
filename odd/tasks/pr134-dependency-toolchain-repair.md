# PR134 Dependency Toolchain Repair

## Goal
Restore the existing high-severity audit gate and build pipeline while preserving the incumbent landing design and behavior.

## Authorization
- Human explicitly authorized necessary dependency, Tailwind 4, CSS/build compatibility changes, local work-unit commits, PR pushes and merge only after green CI.
- Existing automatic Git previews are allowed.
- No audit weakening, forced blanket upgrades, unsupported advisory bypass, redesign, production/manual deployment, tag/release, credentials, Supabase/schema/data/fixtures or hosted T3/T4 work.
- Source writes remain single-threaded. Parent owns tracking, Git delivery and native authority.

## Baseline
- Branch: `chore/beta3-hosted-validation`; PR: #134.
- Starting head: `e823f6e004d3dd212b16c029fec6ab8908e23c96`.
- Main at preparation: `c3fafca8592e45c3fd6ca7e1a5c0a7adad260ca6`.
- CI run `37176515207`: production audit passed; development/full audit failed with 11 findings (7 high); tests, coverage, lint and build skipped.
- Dependency metadata and audit gate predate this PR.
- `braces <=3.0.3` has no published patch (GHSA-vfj7-8cjw-p6xm); latest Tailwind 3.4.19 retains it through watcher/glob dependencies.
- Previously approved CI/source work units remain closed; their authority is not reused for this new candidate.

## Work unit H1
- [x] Restore an audit-clean, UI-preserving dependency toolchain and close its verified commit.
- Status: done — functional and preserved-UI acceptance passed; exact work-unit commit observed. Human explicitly left only this commit natively unreviewed after consent expiry, while preserving RDD and all verification gates. Remote CI/merge remain separate delivery checkpoints.
- Coherent scope: dependency graph, existing PostCSS integration, explicit legacy Tailwind configuration/theme compatibility, global stylesheet and focused regression coverage.
- Allowed writer paths: `package.json`, `package-lock.json`, `postcss.config.js`, `tailwind.config.ts`, `src/index.css`, `scripts/release/verify-tailwind-toolchain.test.mjs`. Parent owns this task file.
- Verified targets: official Tailwind and PostCSS integration 4.3.3; high-severity transitive patch floors `brace-expansion` 1.1.21/2.1.7/5.0.12 (preserve each major), `undici` 7.29.1. Verify target engines and complete resolved graph before claiming security clearance.
- Visual baseline: `/tmp/carpinteroPro-pr134-baseline/`, eight local screenshots and `baseline.json`; desktop 1440x1000/mobile 390x844, light/dark and normal/reduced motion. External fonts/icons were blocked; compare like for like.
- No landing component/content redesign is required by the current map.
- Commit: `4b914dc1856aae00c704f6f8a7f59e2462fc2413` — `fix(build): migrate to an audited Tailwind 4 toolchain`; parent `e823f6e004d3dd212b16c029fec6ab8908e23c96`, verified tree `c0007847b26cefba419dce958aed2dda3aafac43`, seven paths / 571 additions / 872 deletions.
- Rollback: revert this repair work unit's dependency/config/CSS/test changes without reverting the earlier Vercel CI fix or backend evidence.

### Required evidence
- [x] Published Tailwind/PostCSS 4.3.3 and resolved Undici 7.30.0 engine constraints support Node 24; actual remote Node 24 run still awaits publication.
- [x] Writer observed baseline security RED on `braces@3.0.3`, intermediate custom-utility compilation failure, then focused GREEN: 3 files / 30 tests. No fabricated baseline preservation failure/count.
- [x] Independent unchanged production moderate+ and full high+ audits passed with 0 vulnerabilities; `npm ci` also passed.
- [x] Independent graph check: no `braces`, no overrides, brace-expansion major floors and Undici 7.30.0 verified. Optional Windows IA-32 sharp binary has a Node 20-only engine; Ubuntu Node 24 CI applicability still awaits the remote run.
- [x] Initial focused landing/CSS/security tests passed: 3 files / 30 tests.
- [x] Final independent tests and coverage: 135 files / 1,095 tests each; focused 30 tests; lint 0 errors / 6 generated coverage warnings; TypeScript/Vite/PWA build and whitespace passed. Coverage statements 67.05%, branches 61.89%, functions 60.44%, lines 68.56%; local Node 26.2.0, not Node 24. Package/lock hashes were unchanged, so prior `npm ci` and zero-vulnerability audits were reused, not claimed rerun.
- [x] Restored original CTA `shadow-sm` via maintained `@theme --shadow-sm`: one CSS line and seven regression lines, genuine RED 1/29 then GREEN 30 tests. No component, animation or dependency changes.
- [x] Final eight-state local preserved-UI acceptance passed; original shadow restored, no overflow/errors, mobile menu/anchors/focus worked. Reduced-motion changed channel fractions 0.0042% desktop / 0.0102% mobile. Normal heights initially matched baseline, then increased 28px after 500ms with eight landing-float/landing-grow animations: phase overflow, not a stable layout regression. Baseline phase timestamps are unavailable; exact normal-motion pixel parity is not claimed. Artifacts: `/tmp/pr134-final-confirm/`.
- [x] Local checks blocked external fonts/icons and backend/non-root navigation; menu, anchors and visible keyboard focus passed. No hosted journeys, fixture/customer writes or CTA activation. External-font/icon rendering remains a limitation.
- [x] Source hashes/scope stayed unchanged through independent verification; whitespace passed, generated lockfile 396 additions / 851 deletions.
- [x] Human explicitly left only `4b914dc` without native review after three expired consent attempts created no lineage or mutation. No native approval, receipt or consumption is claimed; RDD remains on. Scoped ASSESS reports medium risk, a large runtime writer, explicit declined outcome, `candidate.consumed: false` and `reviewDue: true`; its RDD-off-equivalent plan retains writer self-verification. The completed independent verifier exceeds that plan. No inherited receipts.
- [x] Parent committed the exact seven-path verified scope with root/branch/base/index/allowed-path/source-hash/whitespace/staged-tree/committed-tree/parent guards and observed a clean post-commit state.

## Routing and review burden
- Static mapping: `mutck5p1-6-ey7p` completed, CodeGraph first.
- Patch-version verifier: `mutck5r8-7-5kif`.
- Local visual baseline verifier: `mutcqgp5-8-frzo`.
- Both read-only baselines completed; a single bounded writer owns the six explicit implementation surfaces. No parallel source writers.
- Delivery strategy: single coherent PR #134, maintainer explicitly accepted `size:exception` (`accept_pr134_generated_lock_size_exception_single_coherent_pr`). One honest slicing pass found the generated graph inseparable from manifest/CSS integration.
- Count at acceptance: PR 1,640 changed lines, comprising 1,247 generated lock lines and 393 handwritten/prior-work/tests/docs lines. Report the actual final count including the bounded shadow regression/evidence metadata; do not golf or omit checks.
- Warnings: deprecated source-map/glob, blocked core-js/unrs-resolver install scripts, experimental localStorage notices and 6 generated coverage lint warnings. Final checks may add evidence; none is hidden.
- Keep the migration graph/config/CSS/tests coherent; report or slice actual review overage before delivery.

## Delivery continuation
Publication P1 is already done. This document closes the local H1 checkpoint, not remote delivery. P2 now publishes the repair and waits for exact-head GitHub CI. P3 merges only a green PR and verifies a clean local state; subsequent immutable delivery evidence is recorded in Engram rather than creating self-referential documentation commits.
The published beta.3 tag keeps its old workflow; do not rerun it blindly. No production delivery is authorized.
The earlier `odd/tasks/beta3-hosted-validation.md` remains a historical local closure checkpoint; T3/T4 remain deferred.

## Persistence
Canonical task file: `odd/tasks/pr134-dependency-toolchain-repair.md`.
Full Engram mirror: `odd/pr134-dependency-toolchain-repair/tasks`.
