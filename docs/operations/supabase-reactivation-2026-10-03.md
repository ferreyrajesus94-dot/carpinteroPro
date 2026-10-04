# Supabase reactivation — 2026-10-03

## Target and authentication

- Project: `carpinteroPro` (`revbbzqjglqnphjrasvv`), organization `cwrryxgtooyrmxxatkga`, region `us-west-2`.
- Supabase CLI `2.113.0` current-profile system keyring / Linux Secret Service was verified and reused in process memory only. Official version-matched source: [CLI access_token.go](https://github.com/supabase/cli/blob/v2.113.0/apps/cli-go/internal/utils/access_token.go#L35-L54), [credentials/store.go](https://github.com/supabase/cli/blob/v2.113.0/apps/cli-go/internal/utils/credentials/store.go#L12-L32), and [go-keyring v0.2.8 keyring_unix.go](https://github.com/zalando/go-keyring/blob/v0.2.8/keyring_unix.go#L53-L67). No credential values, private auth-store paths/content, or raw API bodies were emitted or recorded.
- Initial T1 attempt at 17:00 UTC made zero API requests and zero restore submissions. A1 later verified project GET 200 / `INACTIVE` and restore-versions GET 200 with `supabase-postgres-17.6.1.104`; its restore submission count remained zero.

## Authorized resume and readiness observations

- Before resume: fresh CLI listing exited 0 and matched the exact target as `INACTIVE`; authenticated project metadata GET returned HTTP 200 and matched id/ref, name, organization, and region. Restore-versions GET returned HTTP 200 with `supabase-postgres-17.6.1.104` (GA, PostgreSQL 17).
- Public current OpenAPI confirmed `POST /v1/projects/{ref}/restore` (`v1-restore-a-project`) declares no body or query parameters. Exactly **one** bodyless POST was submitted to the authorized target. HTTP **200**, accepted. The exact submission instant was not timestamped separately; it occurred immediately before the readiness window beginning `2026-10-03T18:11:16Z`.
- Total restore POST submissions across all stages: **1**. No retry or replay occurred.
- Authenticated project status polls: 20, at 30-second intervals from `2026-10-03T18:11:17Z` through `2026-10-03T18:20:47Z`; every project GET returned HTTP 200 and exact identity. Statuses: polls 1–4 `COMING_UP`; 5–6 `RESTORING`; 7–20 `ACTIVE_HEALTHY`. The poll/deadline bound was reached.
- Initial Auth/DB health GETs returned HTTP 400; no service status was obtained within that observation window. A bounded diagnostic also returned `timeout_ms: Invalid input: expected number, received string`. Polling stopped at the observation bound. This request-validation failure did not establish unhealthy services; subsequent independent verification resolved it below.
- `SELECT 1` was not run during the initial observation window because service health was unestablished.

## Independent read-only follow-up

- Verifier `musq86vr-a-lzw3` freshly confirmed exact project identity and `ACTIVE_HEALTHY` through authenticated project GET, HTTP 200.
- Health GET used `services=auth%2Cdb`, omitted optional `timeout_ms`, and used a 15-second client timeout. HTTP **200**: Auth and DB both reported **`ACTIVE_HEALTHY`**, `healthy: true`. No retry was needed.
- Documented `/v1/projects/{ref}/database/query/read-only` request contained only `{"query":"SELECT 1 AS ready"}`. HTTP **201**, result exactly **`ready = 1`**. This transport uses POST but is a read-only query, not another restore or business-data mutation.
- No restore, source/index writes, credential output, or other state-changing operation occurred during independent verification. Follow-up request timestamps were not recorded in the handoff.
- Parent's subsequent CLI state spot check exited 0 and confirmed the exact project `ACTIVE_HEALTHY`. An initial local JSON parser expected an array and failed; a bounded typed-envelope parser corrected the check without changing remote state.

## Safety and next step

No backup/PITR, branch, reset, migration, schema/index change, engine/plan upgrade, fixture/customer-data operation, or deployment occurred. The only state-changing remote operation was the single authorized resume POST; total restore submissions remain **1**. The only SQL was the literal read-only readiness query above. Backend project, Auth, and DB readiness are verified, not frontend journeys or production deployment. Continue read-only Vercel/GitHub deployment verification; never repeat the restore. Commits, production delivery, and hosted fixture writes remain separately controlled.
