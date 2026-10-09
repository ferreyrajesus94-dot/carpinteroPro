# Hosted validation — beta.4 closure

## Current status — 2026-10-08

Application QA fixes are merged and released as `v0.3.1-beta.4` at `3fd83011280fe6472ca08e081d7074cbee88e1ba`. [CI and production deploy](https://github.com/ferreyrajesus94-dot/carpinteroPro/actions/runs/37859075592) both passed; the workflow confirmed the production alias https://carpinteropro.com.ar. Migration `20261008171822_qa_production_actual_dates.sql` is applied to the linked production project, its trigger is enabled, and both existing orders recovered start/end dates from audit history. Temporary rollback-only checks passed for start, delivery, cancellation and preserved start on resume.

Merged delivery: [#138 dependencies](https://github.com/ferreyrajesus94-dot/carpinteroPro/pull/138), [#136 workshop workflow](https://github.com/ferreyrajesus94-dot/carpinteroPro/pull/136), [#139 contract/PDF](https://github.com/ferreyrajesus94-dot/carpinteroPro/pull/139). The user subsequently authorized fixes, commit/push/PR/merge, a tag-triggered production release, the hosted migration, and this documentation closure. Earlier restrictions below describe historical phases, not current unresolved permissions.

Remaining follow-ups: [#140 hosted email confirmation/redirect verification](https://github.com/ferreyrajesus94-dot/carpinteroPro/issues/140), and deferred portfolio captures (T4). A new feature does not require repeating backend restoration or credential resets. The cancelled dashboard redesign remains cancelled.


## Historical beta.3 objective
Resume the linked paused Supabase project without changing its data, establish the actual beta.3 deployment state, and complete safe hosted verification and genuine portfolio captures.

## Historical beta.3 problem and rationale
The beta.3 tag and GitHub prerelease are published, but publication is not evidence of a production deployment. Preflight found Supabase `INACTIVE`; one authorized restore and independent read-only follow-up now confirm healthy project/Auth/DB and `SELECT 1 AS ready` = 1. Vercel has a `READY` beta.3 preview; the recorded tag production workflow remains failed. Portfolio images are still intentional SVG placeholders.

## Historical scope and authorization
- The user approved following the deployment-verification, hosted-smoke, and portfolio roadmap.
- The user explicitly authorized resuming the linked Supabase project if paused. Confirm identity and fresh state before one documented resume operation; no-op if already healthy.
- Supabase target: `revbbzqjglqnphjrasvv` (`carpinteroPro`), organization `cwrryxgtooyrmxxatkga`, region `us-west-2`.
- Vercel target: `carpintero-pro`, project `prj_sodQ9wVI8Jwk7ADMHpdTNnqQWQIV`, team `team_1Kojf9iJTmD01QOha8UO40MV` / `ferreyrajesus94-dots-projects`.
- Read-only GitHub/Vercel verification and local task tracking are authorized.
- The human explicitly authorized up to two local documentation commits to record evidence and close A1/B1/T1. Only the existing operational report and this task document are included.
- Fresh T2 authorization permits minimal CI pipeline/tests/docs repair and coherent local work-unit commits. Production deployments, remote workflow reruns, credential mutation/scope broadening, pushes, PRs and merges remain unauthorized; none is inferred from review or release publication.
- Hosted fixture writes and privileged credentials require an approved isolated target and explicit fixture/cleanup authorization. Do not run synthetic journeys against shared production by default.

## Historical non-goals and constraints
No database reset, backup/PITR overwrite, migrations, schema/index modifications, real customer-data writes, billing operations, paid-plan changes, credential disclosure, new project creation, or release/tag repetition. Keep writes single-threaded. Never put secrets in argv, logs, task files, reports, or source. Do not copy personal Vercel OAuth credentials to CI.
Preserve the user's existing landing: no redesign or replacement. Clarify whether this also means preserving the current production deployment; do not infer production or credential permission from that preference.

## Branch and work-unit strategy
- Working branch: `chore/beta3-hosted-validation`, created from release commit `9e6a705800c8a4910b83622cc667ce4c8be559fb`.
- Delivery strategy: `ask-on-risk`.
- Initial forecast: approximately 150-300 authored changed lines for tracking, bounded operational evidence, and capture/docs wiring; generated PNG bytes are excluded. A pipeline redesign is not included and requires a separate scope decision.
- Proposed work units: Supabase reactivation evidence; deployment/readiness evidence; isolated smoke/capture wiring and assets. Keep applicable checks and docs with each unit.
- Local closure authorization: up to two commits, evidence first and real-hash task closure second. Evidence commit `6ce089324657615b519398fa030350b6e619b03b` is observed; this bounded closure metadata records that real identity. Any further commit beyond the authorized pair requires fresh permission; no push/deploy.
- Completed A1/B1/T1 documentation checks: structural readback and whitespace/index scope checks; no deterministic RED or app test/build applied. Supabase functional evidence is retained, never rerun for T2.
- T2 writer checks observed: regression RED/GREEN with fake CLI credentials, `npx --no-install vitest run scripts/release/verify-release-workflow.test.mjs scripts/release/verify-release.test.mjs`, then `npm test`, `npm run lint`, `npm run build` and `git diff --check`. Node 26.2.0/npm 12.2.0 and local Vitest are available; CI remains Node 24. No real token values or hosted calls in tests.
- Delivery strategy: `ask-on-risk`. T2 forecast about 200 authored changed lines including pipeline/tests/tracker; prior local branch slice is 153 lines, forecast total about 353. Advisory estimate, not a task hard cap; check actual accumulated size before delivery.
- T2 rollback boundary: only its CI/tests/docs changes; rollback must not change the remote backend, production alias or existing landing.

## Tasks

### A1 — Resolve the secure authentication blocker
- [x] Relay the worker's closed choice between establishing supported secure authentication and deferring T1; do not ask for resume authorization again.
- [x] Establish a documented existing CLI/API authentication mechanism through a protected channel without credential disclosure; the human explicitly selected continuation.
- [x] Reconcile the decision and authenticated read-only evidence before restarting T1.
- [x] Record the observed shared work-unit commit `6ce089324657615b519398fa030350b6e619b03b`.
- Status: done — secure authentication and exact-target API access verified; actual shared evidence commit observed and recorded.
- Route: exact first-choice response was forwarded once. Worker continuation `musp24x1-8-cmgj` verified current-profile system keyring / Linux Secret Service reuse from official version-matched source, then exact-project GET 200 and restore-versions GET 200 with secrets kept in process memory. Restore POST count remains zero at this boundary.
- Trigger evidence: worker returned `interaction_required` after safe authentication reuse could not be established. This is an authentication-method blocker, not missing resume consent.
- Checks: credentials never appear in chat, logs, argv, source, or report files; no unsupported token-storage assumptions; selected continuation recorded honestly.
- Commit: `6ce089324657615b519398fa030350b6e619b03b` — shared verified Supabase readiness evidence.

### B1 — Verify services with a corrected read-only health request
- [x] Diagnose the HTTP 400 query-validation failure independently of the accepted restore; verify the documented health query shape.
- [x] Query exact-target Auth/DB health without the optional `timeout_ms` URL parameter; use a client/socket timeout instead and no restore replay.
- [x] If services are healthy, run only literal `SELECT 1 AS ready` through the documented `/database/query/read-only` transport, or record its exact unavailability.
- [x] Reconcile observed verification evidence.
- [x] Record the observed shared work-unit commit `6ce089324657615b519398fa030350b6e619b03b`.
- Status: done — independent read-only Auth/DB/query verification and shared evidence commit observed; no second restore.
- Route: `gentle-ai-verify` task `musq86vr-a-lzw3` completed read-only checks, no source/index writes. Parent performed one bounded CLI state spot check and mechanically reconciled the passive operational record.
- Trigger evidence: writer reported partial due to external health-request failure; independent command-running functional verification applied despite passive source-doc risk.
- Checks observed: exact-project GET 200 / `ACTIVE_HEALTHY`; health GET `services=auth%2Cdb` with no `timeout_ms` and 15-second client timeout returned 200, Auth/DB both `ACTIVE_HEALTHY` / `healthy: true`. Read-only query POST containing only `SELECT 1 AS ready` returned 201 / exactly `ready=1`. No retry, restore, data writes or credential output. Parent CLI spot check exited 0 and matched exact healthy target after correcting a local JSON-envelope parser assumption.
- Commit: `6ce089324657615b519398fa030350b6e619b03b` — shared verified Supabase readiness evidence.

### T1 — Resume and verify linked Supabase
- [x] Reconfirm the exact project and fresh status through authenticated read-only evidence.
- [x] If still `INACTIVE`, use the documented paused-project resume route once, with existing authorized local authentication kept in memory; never use backup/PITR endpoints.
- [x] Observe terminal `ACTIVE_HEALTHY` project status and database/Auth service health; record blockers without claiming readiness or replaying a mutation.
- [x] Write a bounded sanitized operational record at `docs/operations/supabase-reactivation-2026-10-03.md`.
- [x] Obtain explicit authorization for up to two local evidence/closure documentation commits, excluding push/deploy.
- [x] Observe the actual work-unit commit `6ce089324657615b519398fa030350b6e619b03b` and record its identity.
- Status: done — actual documentation evidence commit observed and recorded. Operationally, backend project, Auth, DB and literal read-only query are verified; operational record includes the independent follow-up. No frontend or production readiness is inferred.
- Route: worker `muspg4vp-9-0dej` executed exactly one accepted restore; verifier `musq86vr-a-lzw3` resolved the health-request incident through read-only checks. Parent's bounded CLI spot check confirmed current state and reconciled the report from observed facts.
- Trigger evidence: coordinated external operation and command-running verification; parent owns target authorization and task reconciliation.
- Checks observed: exactly one bodyless restore POST 200; project progressed `COMING_UP` 4 / `RESTORING` 2 / `ACTIVE_HEALTHY` 14. Initial health requests returned 400 due to `timeout_ms` query typing; independent omission of that optional parameter succeeded with Auth/DB healthy 200 and literal read-only query 201 / `ready=1`. Parent CLI comparison exit 0 confirmed exact healthy target; initial local JSON parser failure was corrected without remote mutation. No unavailable backend readiness check remains.
- Reconciled source assessment reports `passive`, 2 paths / 145 lines, `reviewDue: false`, structural parent readback-only; final operational record was read back. No source tests/separate verifier are required for passive docs. Historical source-doc targets received low-risk native approval/acknowledgement burns (`review-5419378aa9056eb6`, then `review-950261bfcbc59218`); neither approval covers later report changes or grants delivery.
- Test-first exception: operational recovery/passive evidence has no deterministic local RED/GREEN. Actual before/after state, service health and read-only query were observed; no test-suite/build claim is made.
- Commit: `6ce089324657615b519398fa030350b6e619b03b` — `docs(ops): record verified hosted readiness checks`; parent `9e6a705800c8a4910b83622cc667ce4c8be559fb`, 2 docs / 154 insertions. Whitespace, staged-path scope, exact staged-tree match and clean post-commit worktree observed; no app suite/build applies to passive docs.

### T2 — Establish deployment state and resolve only authorized blockers
- [x] Inspect the existing production deployment/alias and beta.3 preview; distinguish their commit identities and environments.
- [x] Reconcile the failed tag workflow with current Vercel state.
- [x] Obtain explicit authorization for minimal CI repair, tests/docs and local work-unit commits, excluding push/deploy and credential changes.
- [x] Establish the published minimum-permission path: pin CLI 62.2.0 with linked-pull owner-lookup avoidance, environment-only token authentication and explicit production environment; do not broaden credentials.
- [x] Observe regression RED (5 expected failures / 73 passing), implement the bounded correction, then GREEN (78 tests / 2 files) with env-only dummy credentials.
- [x] Observe writer checks: full suite 1,093 tests / 134 files, lint 0 errors / 6 coverage warnings, TypeScript/Vite build and whitespace check pass; remote delivery unexecuted.
- [x] Observe independent verifier `mut5moib-2-alb0`: focused 78 tests / 2 files and whitespace/scope checks pass, gate/auth wiring unchanged. Its PARTIAL label refers to deliberately unexecuted remote delivery, not a failed authorized local check.
- [x] Complete native review of the coherent repair and actual work-unit commit, observe exact acknowledgements and clean post-commit tree.
- [x] Preserve delivery/credential boundaries: supported local correction required no token-scope change, remote workflow rerun or production action.
- [x] Record local verification, unexecuted remote checks and actual work-unit commit `484425ac4d4445baeda4098eff312506733d6c27`.
- Status: done — authorized local CI correction, test-first evidence, independent local verification, native approved/acknowledged committed candidate and actual Git evidence observed. Remote CI credentials/run/deployment are not verified or claimed.
- Route: read-only scout `mut3u81j-e-kntx`, writer `mut5bwfc-1-8w79` and independent verifier `mut5moib-2-alb0` completed. Parent relayed missing public tools, owns tracker/Git closure. No agent remains running; historical baseline investigations were not repeated.
- Trigger evidence: consequential unproven token-compatibility premise plus external source research and at least two non-trivial pipeline/test surfaces; mandatory explorer/writer delegation.
- Checks observed: production alias `carpintero-pro.vercel.app` resolves to `dpl_8AGvT6rppvdKPGUVtqLBimS4uTxE`, `READY`/production at `7443d08d68ac1aafc80580faaf2c777b943530dc` (2026-09-15); beta.3 preview `dpl_4chVEZsAud6ycCntbuKQZg9BsyRq` is `READY`/preview at `9e6a705800c8a4910b83622cc667ce4c8be559fb` (2026-09-21). Scoped project inspection corroborated the exact configured project ID/name. Run `35583806084` attempt 3 tests/lint/build passed, settings pull failed, production deploy was skipped.
- Failure evidence: the failed step used CLI `59.23.2`, installed via `vercel@latest` (`release.yml:101-109`), not local `58.0.0`. One sanitized log retrieval showed `Could not retrieve Project Settings`, but no HTTP status or ID mismatch. Current CI secret values were neither observable nor retrieved.
- Published source correction: independently inspected the npm-published `vercel@59.23.2` and `vercel@62.2.0` archives in memory, without execution/install, and verified their registry SHA512 integrity. 59.23.2 `pullCommandLogic` omits `skipOwnerLookup`; 62.2.0 `dist/chunks/chunk-WOKSTB3F.js` passes it as true, and `chunk-7IRKF3ZG.js` conditionally skips `getOrgById`. Both versions consume `process.env.VERCEL_TOKEN` before persisted auth. [Published 62.2.0 artifact](https://registry.npmjs.org/vercel/-/vercel-62.2.0.tgz), integrity `sha512-hwet6qXoOfZEc6waIx1VgI2nLl83wwuZZnFqKSsKJ47UFi9waEezPmAV7uNOx8Fq+6JTJIi+lRnxFXr9YFW3Eg==`. This is evidence for the linked-project owner-lookup correction, not proof that the private CI secret is valid or that a remote run succeeds. Issue #17506 remains open; its state is not published-fix evidence.
- Safety boundary: old tag YAML passes tokens through argv at `release.yml:109,121`, contrary to the protected-env convention. Rerun retains that tag workflow but installs latest CLI, and successful pull proceeds to production deployment. Do not treat retry as a harmless diagnostic or broaden credentials blindly; preserving the no-secret-argv constraint needs a supported safe path before execution.
- Initial diagnosis scope check: production-to-beta.3 comparison found no `src/` or migration delta; other config/assets/build differences were not excluded. Parent spot-checked `release.yml:99-125`. During subsequent authorized repair, local test/build checks and Git work-unit commit occurred as recorded above; no production, fixture or credential change.
- Test-first: hermetic release workflow/CLI command regression is applicable; capture genuine RED/GREEN and refactor checks with fake credentials only. Remote deployment/real CI-secret validation is not authorized and cannot be replaced by mock-test claims.
- Native review: high (`shell_source`), granted/approved then acknowledged. Committed target `sha256:b0868f8f2f8efc307d8d1c1021bc4812fcb17ef97204a030cc89035c0edba195`, lineage `review-cc43f92db925c246`, consumed revision `sha256:1715b2de8b7d9a45c5501cc348644744cfd1c205b7675b623132e644428d68fc`; post-ack ASSESS derives `closed`, `candidate.consumed: true`, `reviewDue: false`. Prior workspace review `review-1e85496b4e36100f` was separately burned, never reused.
- Commit: `484425ac4d4445baeda4098eff312506733d6c27` — `fix(ci): support project-scoped Vercel authentication`; parent `c20615857b40acc772f4d7bdcd8335ae0020a006`, 3 files / 50 additions / 25 deletions. Staged/committed tree exactly matched reviewed `0d01dd6ae178b4fcf12d5c1a5325dc34e56003a9`; post-commit clean tree observed. Branch slice was 206 authored diff lines, below the advisory delivery threshold.

### T3 — Complete QA journey and verify delivered corrections
- [x] Complete the ordinary hosted journey with preserved fictional own-workshop fixtures: inventory, client, recipe/BOM, two quotes, contract/PDF and both production lifecycles.
- [x] Diagnose defects, implement regression coverage and verify corrections locally with real Supabase and a visible browser.
- [x] Deliver fixes through PRs #138, #136 and #139; publish beta.4 through passing tag CI and production deployment.
- [x] Apply the production dates migration and verify history, trigger, recovered dates and rollback-only lifecycle checks.
- [x] Run the bounded production smoke described below.
- [ ] Verify public email confirmation with an authorized controlled mailbox; tracked separately in #140.
- Status: application correction and delivery complete; public signup email delivery remains separately unverified. This is not an unconditional end-to-end signup pass.
- Hosted journey evidence: P-0001 total $84,500 and recipe-linked P-0002 total $91,000; OP-QA-0001 and OP-QA-0002 completed through delivered. Starting the recipe-linked order produced a -1 Melamina stock movement; before the fix, cached inventory required reload to reflect it. Audit history retained pause/resume/quality/ready/delivery transitions.
- Local verification: 1,107 JavaScript tests passed, build passed, lint had zero errors and six existing coverage warnings. Lifecycle/audit pgTAP checks: 41 passed; migration/backfill verification: 12 checks passed. Visible local browser covered contract creation/reload/edit/PDF/default opt-out/mobile, board-to-detail navigation and lifecycle date persistence.
- Production smoke (2026-10-08, visible browser, https://carpinteropro.com.ar): search retained Melamina after debounce and returned one material; dashboard showed two delivered quotes, zero active orders and $175,500 revenue; P-0001 contract empty state exposed first-template creation. Created fictional QA Smoke beta.4 template, observed substitution and persistence after browser reopen, and downloaded presupuesto-P-0001.pdf with quote plus contract on two pages. Extracted text and both rendered pages were inspected. Existing OP-QA-0001 detail displayed actual start/end alongside audit timeline. Settings showed no billing card and its response CSP allowed the Flaticon font host; profile displayed the workshop name Test QA Carpintería.
- Smoke limits: no new order lifecycle or stock mutation was repeated after deployment; the active board was empty, so its new order-detail link is supported by local browser/regression evidence rather than a new hosted active-card click. Public signup, mail delivery and portfolio captures were not rerun. Two run-code download waits lost the browser context; the CLI click/download path subsequently succeeded. No app download defect was established by those harness interruptions.
- Evidence: private browser snapshots and production PDF/renderings are retained outside the repository under the existing QA evidence directory. No credentials or browser storage are committed. QA data/session are preserved; no cleanup deletion, external sharing, signing or payments occurred.

### T4 — Replace portfolio placeholders with genuine captures
- [ ] Produce the seven real PNG captures using `docs/portfolio/README.md` on the approved verified environment, without exposing private data.
- [ ] Update screenshot references and remove obsolete placeholders only within the approved capture scope.
- [ ] Verify the screenshot grid, PNG validity, and PWA build/precache; record the work-unit commit identity when authorized.
- Status: pending — requires T3 and hosted capture safety.
- Route: delegated `gentle-ai-worker` for multi-file assets/docs/test wiring and foreground checks; external browser verification uses `gentle-ai-verify` when needed.
- Trigger evidence: multiple non-trivial assets/docs surfaces and browser/build verification.
- Checks: seven assertion-backed screenshots; visual grid inspection; `npm run build`; applicable focused tests if capture wiring changes.
- Test-first exception: generated captures and passive references have no meaningful RED; use image/browser/build checks. Behavior changes require applicable test-first development.
- Commit: pending; no authorization yet.

## Historical beta.3 preflight evidence
- Local Supabase link: `supabase/.temp/project-ref`; Vercel mapping: `.vercel/repo.json`.
- Supabase CLI `2.113.0` supports `projects list --output-format json`; help exposes no hosted restore or generic API request command. Initial preflight did not capture pipeline exit status separately; the T1 worker subsequently captured actual subprocess exit 0 in before/after listings, both reporting the exact linked project as `INACTIVE`.
- `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN` were absent in the checked environment. A1 subsequently verified Supabase CLI v2.113.0 current-profile system keyring use and supported Linux Secret Service retrieval in process memory. Authenticated exact-project GET returned 200/`INACTIVE`; restore-versions GET returned 200 with `supabase-postgres-17.6.1.104`. These read checks do not prove restore-write permission.
- Official public OpenAPI `https://api.supabase.com/api/v1-json` documents GET/POST `/v1/projects/{ref}/restore`. POST declares no request body; the route requires Bearer authorization and projects-write/project-admin permission. Health GET requires a `services` query parameter. This is paused-project resume, not backup/PITR restoration.
- PR #133 is merged at `c3fafca8592e45c3fd6ca7e1a5c0a7adad260ca6`; `v0.3.1-beta.3` is a published prerelease.
- Actions run `35583806084` remains failed: tests/lint/build succeeded, production deployment job failed. URL: https://github.com/ferreyrajesus94-dot/carpinteroPro/actions/runs/35583806084.
- Beta.3 preview `https://carpintero-de2mphion-ferreyrajesus94-dots-projects.vercel.app` is `READY`, target `preview`, linked by listing to release commit `9e6a705800c8a4910b83622cc667ce4c8be559fb`.
- Production alias `https://carpintero-pro.vercel.app` resolves to `https://carpintero-59wtxn3l2-ferreyrajesus94-dots-projects.vercel.app`, `READY`/production at `7443d08d68ac1aafc80580faaf2c777b943530dc`, created 2026-09-15. Beta.3 is confirmed only on its separate `READY` preview. Read-only diagnosis found no `src/`/migration delta, but project-token compatibility and an applicable published fix remain unproven; no production readiness is inferred.
- Hosted portfolio journeys create synthetic Auth users and fixture rows with a privileged client. Browser base URL and backend credentials are independent configuration boundaries.
- Exactly one paused-project restore was accepted HTTP 200; independent project/Auth/DB health GETs returned 200/healthy, and literal read-only `SELECT 1 AS ready` returned 201/`ready=1`. No deployment, remote workflow rerun, migration, fixture/business-data write, engine/plan change or push occurred. Subsequent authorized local T2 tests/build and its real work-unit commit are recorded above.

## Progress and next step
A1/B1/T1/T2 historical work and the application portion of T3 are complete. Beta.4 is live and the dates migration is applied. SMTP confirmation verification is separated into #140; T4 remains deferred portfolio work. The release skill is registered in AGENTS.md. This documentation closure is tracked by #141; a clean synchronized main is the starting point for the next feature.

## Persistence
Repository document is the current durable record. The earlier Engram mirror uses topic `odd/beta3-hosted-validation/tasks`; it was not updated during this closure because the runtime hook did not register an authoritative session identity. Do not invent or reuse an identity to write memory. Preserve unverified checkboxes and retained historical evidence.
