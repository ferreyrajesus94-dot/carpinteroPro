# Beta.3 hosted validation

## Objective
Resume the linked paused Supabase project without changing its data, establish the actual beta.3 deployment state, and complete safe hosted verification and genuine portfolio captures.

## Problem and rationale
The beta.3 tag and GitHub prerelease are published, but publication is not evidence of a production deployment. Preflight found Supabase `INACTIVE`; one authorized restore and independent read-only follow-up now confirm healthy project/Auth/DB and `SELECT 1 AS ready` = 1. Vercel has a `READY` beta.3 preview; the recorded tag production workflow remains failed. Portfolio images are still intentional SVG placeholders.

## Scope and authorization
- The user approved following the deployment-verification, hosted-smoke, and portfolio roadmap.
- The user explicitly authorized resuming the linked Supabase project if paused. Confirm identity and fresh state before one documented resume operation; no-op if already healthy.
- Supabase target: `revbbzqjglqnphjrasvv` (`carpinteroPro`), organization `cwrryxgtooyrmxxatkga`, region `us-west-2`.
- Vercel target: `carpintero-pro`, project `prj_sodQ9wVI8Jwk7ADMHpdTNnqQWQIV`, team `team_1Kojf9iJTmD01QOha8UO40MV` / `ferreyrajesus94-dots-projects`.
- Read-only GitHub/Vercel verification and local task tracking are authorized.
- The human explicitly authorized up to two local documentation commits to record evidence and close A1/B1/T1. Only the existing operational report and this task document are included.
- Production deployments, workflow reruns, token scope broadening, pushes, PRs, merges, or additional commits remain unauthorized; none is inferred from native review or release publication.
- Hosted fixture writes and privileged credentials require an approved isolated target and explicit fixture/cleanup authorization. Do not run synthetic journeys against shared production by default.

## Non-goals and constraints
No database reset, backup/PITR overwrite, migrations, schema/index modifications, real customer-data writes, billing operations, paid-plan changes, credential disclosure, new project creation, or release/tag repetition. Keep writes single-threaded. Never put secrets in argv, logs, task files, reports, or source. Do not copy personal Vercel OAuth credentials to CI.
Preserve the user's existing landing: no redesign or replacement. Clarify whether this also means preserving the current production deployment; do not infer production or credential permission from that preference.

## Branch and work-unit strategy
- Working branch: `chore/beta3-hosted-validation`, created from release commit `9e6a705800c8a4910b83622cc667ce4c8be559fb`.
- Delivery strategy: `ask-on-risk`.
- Initial forecast: approximately 150-300 authored changed lines for tracking, bounded operational evidence, and capture/docs wiring; generated PNG bytes are excluded. A pipeline redesign is not included and requires a separate scope decision.
- Proposed work units: Supabase reactivation evidence; deployment/readiness evidence; isolated smoke/capture wiring and assets. Keep applicable checks and docs with each unit.
- Local closure authorization: up to two commits, evidence first and real-hash task closure second. Keep A1/B1/T1 unclosed until actual commit evidence is observed; no push/deploy or further mutation.
- Documentation checks: structural readback and whitespace/index scope checks; no deterministic local RED or app test/build applies. Already observed Supabase functional evidence is retained, not rerun.
- Rollback boundary: only the two documentation files; reverting documentation does not pause, restore, migrate or otherwise change the remote backend.

## Tasks

### A1 — Resolve the secure authentication blocker
- [x] Relay the worker's closed choice between establishing supported secure authentication and deferring T1; do not ask for resume authorization again.
- [x] Establish a documented existing CLI/API authentication mechanism through a protected channel without credential disclosure; the human explicitly selected continuation.
- [x] Reconcile the decision and authenticated read-only evidence before restarting T1.
- [ ] Record the work-unit commit identity when explicitly authorized.
- Status: pending observed Git closure — authentication and exact-target API access are verified; local documentation commit permission is now granted, actual hash still pending.
- Route: exact first-choice response was forwarded once. Worker continuation `musp24x1-8-cmgj` verified current-profile system keyring / Linux Secret Service reuse from official version-matched source, then exact-project GET 200 and restore-versions GET 200 with secrets kept in process memory. Restore POST count remains zero at this boundary.
- Trigger evidence: worker returned `interaction_required` after safe authentication reuse could not be established. This is an authentication-method blocker, not missing resume consent.
- Checks: credentials never appear in chat, logs, argv, source, or report files; no unsupported token-storage assumptions; selected continuation recorded honestly.
- Commit: pending; intended to share the coherent T1 operational evidence unit when explicitly authorized.

### B1 — Verify services with a corrected read-only health request
- [x] Diagnose the HTTP 400 query-validation failure independently of the accepted restore; verify the documented health query shape.
- [x] Query exact-target Auth/DB health without the optional `timeout_ms` URL parameter; use a client/socket timeout instead and no restore replay.
- [x] If services are healthy, run only literal `SELECT 1 AS ready` through the documented `/database/query/read-only` transport, or record its exact unavailability.
- [x] Reconcile observed verification evidence.
- [ ] Record the coherent T1 work-unit commit identity when explicitly authorized.
- Status: pending commit closure only — independent functional verification is complete, without a second restore.
- Route: `gentle-ai-verify` task `musq86vr-a-lzw3` completed read-only checks, no source/index writes. Parent performed one bounded CLI state spot check and mechanically reconciled the passive operational record.
- Trigger evidence: writer reported partial due to external health-request failure; independent command-running functional verification applied despite passive source-doc risk.
- Checks observed: exact-project GET 200 / `ACTIVE_HEALTHY`; health GET `services=auth%2Cdb` with no `timeout_ms` and 15-second client timeout returned 200, Auth/DB both `ACTIVE_HEALTHY` / `healthy: true`. Read-only query POST containing only `SELECT 1 AS ready` returned 201 / exactly `ready=1`. No retry, restore, data writes or credential output. Parent CLI spot check exited 0 and matched exact healthy target after correcting a local JSON-envelope parser assumption.
- Commit: pending; group verified evidence with T1 when explicitly authorized.

### T1 — Resume and verify linked Supabase
- [x] Reconfirm the exact project and fresh status through authenticated read-only evidence.
- [x] If still `INACTIVE`, use the documented paused-project resume route once, with existing authorized local authentication kept in memory; never use backup/PITR endpoints.
- [x] Observe terminal `ACTIVE_HEALTHY` project status and database/Auth service health; record blockers without claiming readiness or replaying a mutation.
- [x] Write a bounded sanitized operational record at `docs/operations/supabase-reactivation-2026-10-03.md`.
- [x] Obtain explicit authorization for up to two local evidence/closure documentation commits, excluding push/deploy.
- [ ] Observe the work-unit commit and record its actual identity before closing T1.
- Status: in progress — authorized local documentation closure; commit identity not yet observed. Operationally, backend project, Auth, DB and literal read-only query are verified; operational record includes the independent follow-up. No frontend or production readiness is inferred.
- Route: worker `muspg4vp-9-0dej` executed exactly one accepted restore; verifier `musq86vr-a-lzw3` resolved the health-request incident through read-only checks. Parent's bounded CLI spot check confirmed current state and reconciled the report from observed facts.
- Trigger evidence: coordinated external operation and command-running verification; parent owns target authorization and task reconciliation.
- Checks observed: exactly one bodyless restore POST 200; project progressed `COMING_UP` 4 / `RESTORING` 2 / `ACTIVE_HEALTHY` 14. Initial health requests returned 400 due to `timeout_ms` query typing; independent omission of that optional parameter succeeded with Auth/DB healthy 200 and literal read-only query 201 / `ready=1`. Parent CLI comparison exit 0 confirmed exact healthy target; initial local JSON parser failure was corrected without remote mutation. No unavailable backend readiness check remains.
- Reconciled source assessment reports `passive`, 2 paths / 145 lines, `reviewDue: false`, structural parent readback-only; final operational record was read back. No source tests/separate verifier are required for passive docs. Historical source-doc targets received low-risk native approval/acknowledgement burns (`review-5419378aa9056eb6`, then `review-950261bfcbc59218`); neither approval covers later report changes or grants delivery.
- Test-first exception: operational recovery/passive evidence has no deterministic local RED/GREEN. Actual before/after state, service health and read-only query were observed; no test-suite/build claim is made.
- Commit: pending hash; human explicitly authorized up to two local documentation commits for A1/B1/T1 only.

### T2 — Establish deployment state and resolve only authorized blockers
- [x] Inspect the existing production deployment/alias and beta.3 preview; distinguish their commit identities and environments.
- [x] Reconcile the failed tag workflow with current Vercel state.
- [ ] If a production change or broader token permission is needed, present the exact decision before any mutation. Do not rerun the failed workflow blindly.
- [ ] Record verified readiness, failed/skipped checks, and the work-unit commit identity when authorized.
- Status: pending production decision — read-only diagnosis is complete; preserve the existing landing. No pipeline, credential, rerun or deployment mutation is authorized.
- Route: verifier `musrtwh7-b-gn0n` completed alias/list/Actions checks; continuation `musshhrb-c-xdmh` completed bounded workflow/log/public-fix/Git-delta diagnosis without source/index changes. No verifier remains running.
- Trigger evidence: external deployment verification and potential credential permission boundary.
- Checks observed: production alias `carpintero-pro.vercel.app` resolves to `dpl_8AGvT6rppvdKPGUVtqLBimS4uTxE`, `READY`/production at `7443d08d68ac1aafc80580faaf2c777b943530dc` (2026-09-15); beta.3 preview `dpl_4chVEZsAud6ycCntbuKQZg9BsyRq` is `READY`/preview at `9e6a705800c8a4910b83622cc667ce4c8be559fb` (2026-09-21). Scoped project inspection corroborated the exact configured project ID/name. Run `35583806084` attempt 3 tests/lint/build passed, settings pull failed, production deploy was skipped.
- Failure evidence: the failed step used CLI `59.23.2`, installed via `vercel@latest` (`release.yml:101-109`), not local `58.0.0`. One sanitized log retrieval showed `Could not retrieve Project Settings`, but no HTTP status or ID mismatch. Current CI secret values were neither observable nor retrieved.
- Published-fix limitation: [Vercel issue #17506](https://github.com/vercel/vercel/issues/17506) remains open; project-token failure/team-token success is community workaround evidence, not a maintainer-confirmed fix or proof that broader scope is necessary now. Registry latest was `62.2.0`; no applicable published fix was verified.
- Safety boundary: old tag YAML passes tokens through argv at `release.yml:109,121`, contrary to the protected-env convention. Rerun retains that tag workflow but installs latest CLI, and successful pull proceeds to production deployment. Do not treat retry as a harmless diagnostic or broaden credentials blindly; preserving the no-secret-argv constraint needs a supported safe path before execution.
- Scope check: production-to-beta.3 Git comparison found no changes under `src/` or `supabase/migrations/`; other configuration/assets/build differences were not excluded. Parent spot-checked `release.yml:99-125`. No new test suite/build, production action, fixture write or Git delivery occurred.
- Test-first exception: read-only operational verification; no meaningful RED unless an approved pipeline behavior fix becomes necessary.
- Commit: pending; no authorization yet.

### T3 — Verify an approved isolated hosted journey
- [ ] Select/confirm an isolated approved backend/browser target and explicit synthetic fixture/cleanup permission before running mutating E2E flows.
- [ ] Verify signup, onboarding, inventory, quote, contract/PDF, and production using the smallest applicable existing journeys.
- [ ] Observe cleanup and record results, failures, limitations, and the work-unit commit identity when authorized.
- Status: pending — isolated target and fixture-write authorization unresolved.
- Route: delegated `gentle-ai-verify`; any necessary test changes go to one bounded writer.
- Trigger evidence: external E2E execution and privileged synthetic fixture lifecycle.
- Checks: backend identity independent of `E2E_BASE_URL`; no real customer records; observed assertions and cleanup; never infer readiness from a build alone.
- Test-first exception: existing functional journey execution is verification, not a new behavior implementation. Any new deterministic behavior change still follows RED/GREEN/refactor.
- Commit: pending; no authorization yet.

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

## Verified preflight evidence
- Local Supabase link: `supabase/.temp/project-ref`; Vercel mapping: `.vercel/repo.json`.
- Supabase CLI `2.113.0` supports `projects list --output-format json`; help exposes no hosted restore or generic API request command. Initial preflight did not capture pipeline exit status separately; the T1 worker subsequently captured actual subprocess exit 0 in before/after listings, both reporting the exact linked project as `INACTIVE`.
- `SUPABASE_ACCESS_TOKEN` and `VERCEL_TOKEN` were absent in the checked environment. A1 subsequently verified Supabase CLI v2.113.0 current-profile system keyring use and supported Linux Secret Service retrieval in process memory. Authenticated exact-project GET returned 200/`INACTIVE`; restore-versions GET returned 200 with `supabase-postgres-17.6.1.104`. These read checks do not prove restore-write permission.
- Official public OpenAPI `https://api.supabase.com/api/v1-json` documents GET/POST `/v1/projects/{ref}/restore`. POST declares no request body; the route requires Bearer authorization and projects-write/project-admin permission. Health GET requires a `services` query parameter. This is paused-project resume, not backup/PITR restoration.
- PR #133 is merged at `c3fafca8592e45c3fd6ca7e1a5c0a7adad260ca6`; `v0.3.1-beta.3` is a published prerelease.
- Actions run `35583806084` remains failed: tests/lint/build succeeded, production deployment job failed. URL: https://github.com/ferreyrajesus94-dot/carpinteroPro/actions/runs/35583806084.
- Beta.3 preview `https://carpintero-de2mphion-ferreyrajesus94-dots-projects.vercel.app` is `READY`, target `preview`, linked by listing to release commit `9e6a705800c8a4910b83622cc667ce4c8be559fb`.
- Production alias `https://carpintero-pro.vercel.app` resolves to `https://carpintero-59wtxn3l2-ferreyrajesus94-dots-projects.vercel.app`, `READY`/production at `7443d08d68ac1aafc80580faaf2c777b943530dc`, created 2026-09-15. Beta.3 is confirmed only on its separate `READY` preview. Read-only diagnosis found no `src/`/migration delta, but project-token compatibility and an applicable published fix remain unproven; no production readiness is inferred.
- Hosted portfolio journeys create synthetic Auth users and fixture rows with a privileged client. Browser base URL and backend credentials are independent configuration boundaries.
- Exactly one authorized paused-project restore was accepted HTTP 200; independent exact-project GET and Auth/DB health GET both returned 200/healthy, and literal read-only `SELECT 1 AS ready` returned 201/`ready=1`. No deployment, workflow rerun, migration, fixture/business-data write, engine/plan change, test suite/build, commit or push occurred.

## Progress and next step
T1 local closure is active, under the human's explicit two-commit documentation limit. T2 awaits a separate production scope decision; both read-only verifier tasks have finished. Preserve the current landing without redesign/replacement. Clarify whether the user also wants production left at its current deployment or wants a separate safe beta.3 publication path; do not interpret that choice as broad-token/deploy permission. Given no `src/`/migration delta and no verified minimum-permission CI fix, recommend keeping production unchanged for now rather than broadening credentials merely to chase a release label. A1/B1/T1 operational outcomes remain verified and local commit permission is granted; actual commit identity and closing evidence remain pending. NEVER repeat the single Supabase restore. T3 isolated-target/fixture/cleanup authorization remains unresolved; T4 depends on verified safe journeys. Native source-doc approval grants no production, fixture or Git delivery authority.

## Persistence
Repository document is authoritative alongside the full Engram mirror at topic `odd/beta3-hosted-validation/tasks`. Visible todo is only a projection. Update and read back both durable copies at each task transition or material plan change; preserve unverified/commit-pending checkboxes.
