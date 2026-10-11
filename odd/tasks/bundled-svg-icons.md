# Bundled SVG icons

## Objective
Replace live Flaticon icon-font usage with bundled Lucide SVGs so icons remain visible when remote fonts are blocked or unavailable.

## Authorization and scope
User authorized the SVG replacement. Preserve current Spanish UI, layout, colors, accessibility and behavior. User subsequently explicitly authorized commit, push and merge of the icon change, including the repository-required PR. Production release/tag remains unauthorized. Double-scroll report is withdrawn from this scope. Branch: `fix/bundled-svg-icons`.

Exploration found 64 logical icon choices/configurations across 23 source files. Lucide is already installed. Update active design/spec/CSP documentation; leave historical evidence and archived changes untouched.

## Work unit
- [x] U1 — Replace external icon fonts with bundled SVGs, regression tests and current documentation.
  - Status: implementation and work-unit commit complete; PR delivery in progress.
  - Test-first: add regression tests for shared brand/navigation/theme SVG rendering and absence of live Flaticon references; observe RED before implementation and GREEN afterwards.
  - Acceptance: all live icon choices use statically imported SVG components; explicit dimensions and decorative accessibility preserved; remove Flaticon stylesheet links and only its CSP allowances.
  - Checks: focused tests, full unit suite, lint, build, whitespace; visible desktop/mobile browser checks with external icon fonts blocked when available; native review under enabled RDD.
  - Commit: `d6bf60cea50b96d08036313fe9875587a9d3fdef` — `fix(ui): bundle SVG icons instead of external icon fonts`.

## Verification evidence
Writer `mv36e917-3-adyi` completed replacement across 30 tracked files and four new tests. Observed RED before SVG implementation; focused GREEN groups: 38 and 79 tests. Full suite: 142 files / 1,123 tests passed. Lint: zero errors, six existing coverage warnings. Build initially failed on Node imports in new structural test; Vite raw imports corrected it and final build passed. Whitespace passed. Detector: 29 advisory findings on retained typography. No staging/commit/remote actions during writer/verification; subsequent authorized work-unit commit recorded above. Native four-lens review approved and exact acknowledgement burned authority for `review-655e37914b56859b`, target `sha256:56e99ed0200bb5af171cf1f1c4c8d44fecbc86cd97c15fd4538b917b2c1881d3`. ASSESS failed on untracked declaration and selected conservative independent verification; verifier `mv36opph-4-1cqi` settled. Independent focused tests: four files / 14 tests passed. Independent CSP/source checks confirmed only Flaticon permissions/links removed, Google typography retained, no residual live Flaticon dependencies. Browser evidence: public login and mocked shell desktop/mobile light/dark passed with external hosts denied, actual Google font request blocked; no page errors. Mobile admin header overflow observed at 390px (537px document), causality unproven; header structure is unchanged. Admin data-dependent icons unavailable with remote Edge Functions blocked. Do not repair unrelated layout without evidence/authorization. Screenshot alone does not establish Zen as the cause.

## Rollback boundary
Only the SVG migration, affected tests, current documentation and Flaticon-loading/CSP removal. Do not alter Google typography, auth/backend configuration or historical records.

## Progress and next step
Implementation, native review and independent verification finished. User approved local visual appearance; work-unit commit is recorded. Next: push feature branch, open PR under CarpinteroPro CONTRIBUTING.md (business-need linkage accepted), observe CI and merge only when controls pass. Mobile Admin overflow is a disclosed limitation, not authorized follow-up.

## Remaining checks and follow-ups
- Mobile Admin header overflows at 390px: observed, attribution to SVG migration unproven; unchanged flex/chip structure. Follow-up requires separate scope decision.
- Data-dependent Admin icons not browser-verified because external Edge Functions were intentionally blocked; existing component tests pass.
- Zen itself and production deployment were not tested; headed Chromium checked local app with external hosts denied, including an actually blocked Google font request.
- Browser evidence: 22 screenshots retained privately outside the repository; no browser storage, credentials or screenshots are committed.
- Final lint has six known warnings; detector has 29 retained-typography advisories. No outstanding build or unit-test failures; initial test typing failure was corrected and build rerun successfully.
- ASSESS was unavailable due untracked declaration; conservative independent verification completed. Native approved acknowledgement is observed, not inferred from ASSESS.
