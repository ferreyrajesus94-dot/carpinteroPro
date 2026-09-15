#!/usr/bin/env node
// scripts/release/verify-release.mjs
// Release-gate helper. Runs BEFORE candidate checkout and vercel pull/deploy,
// so a forged or stray candidate never receives deployment credentials or
// code execution context. Fails closed: any failure exits non-zero.
//
// Contract (all must pass for exit 0):
//   1. repository.full_name === trusted repo, repository.fork === false
//   2. workflow_run.event === 'push'  (excludes PR runs)
//   3. workflow_run.conclusion === 'success'  (upstream CI passed)
//   4. workflow_run.head_sha is a 40-char hex SHA
//   5. At least one refs/tags/<name> peels to head_sha via git ls-remote
//      (handles lightweight and annotated tags)
//   6. Every required deploy secret is present and non-empty in env
//
// Event identity relies ONLY on workflow_run.head_sha. head_branch is
// non-authoritative for tag push triggers -- a branch named v1.2.3 with
// no real tag MUST NOT deploy.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const EVENT_PATH = process.env.VERIFY_EVENT_PATH || process.env.GITHUB_EVENT_PATH || '';
const TRUSTED_REPO = process.env.VERIFY_TRUSTED_REPO || process.env.GITHUB_REPOSITORY || '';
const REMOTE_URL = process.env.VERIFY_REMOTE_URL
  || (TRUSTED_REPO ? `https://github.com/${TRUSTED_REPO}.git` : '');
const REQUIRED_SECRETS = (process.env.VERIFY_REQUIRED_SECRETS
  || 'VERCEL_TOKEN,VERCEL_ORG_ID,VERCEL_PROJECT_ID')
  .split(',').map((s) => s.trim()).filter(Boolean);

class GateError extends Error {
  constructor(title, detail) { super(title); this.name = 'GateError'; this.detail = detail; }
}
function fail(title, detail) {
  const payload = detail !== undefined ? (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '';
  console.error(payload ? `::error::${title}\n${payload}` : `::error::${title}`);
  throw new GateError(title, detail);
}

export function parseLsRemote(stdout) {
  const out = new Map();
  for (const raw of String(stdout ?? '').split('\n')) {
    if (!raw) continue;
    const tab = raw.indexOf('\t');
    if (tab < 0) continue;
    const sha = raw.slice(0, tab).toLowerCase();
    const ref = raw.slice(tab + 1);
    const peel = ref.match(/^refs\/tags\/(.+?)\^\{\}$/);
    if (peel) {
      const e = out.get(peel[1]) || { kind: 'lightweight' };
      e.commitSha = sha; e.kind = 'annotated';
      out.set(peel[1], e); continue;
    }
    const m = ref.match(/^refs\/tags\/(.+)$/);
    if (m) {
      const e = out.get(m[1]) || { kind: 'lightweight' };
      e.tagSha = sha; if (!e.commitSha) e.commitSha = sha;
      out.set(m[1], e);
    }
  }
  return out;
}

export function findTagForSha(tagMap, headSha) {
  if (typeof headSha !== 'string') return null;
  const target = headSha.toLowerCase();
  for (const [name, entry] of tagMap.entries()) {
    if (entry && entry.commitSha === target) return { name, kind: entry.kind || 'lightweight' };
  }
  return null;
}

export function checkTrustedRepo(repository, trusted) {
  if (!repository || typeof repository !== 'object') fail('event missing repository object');
  if (repository.fork === true) fail('workflow_run originated from a fork', { repository: repository.full_name });
  if (trusted && repository.full_name !== trusted) {
    fail('repository does not match trusted repo', { expected: trusted, got: repository.full_name });
  }
  return repository.full_name;
}

export function checkRun(workflowRun) {
  if (!workflowRun || typeof workflowRun !== 'object') fail('event missing workflow_run object');
  if (workflowRun.conclusion !== 'success') fail('upstream CI did not succeed', { conclusion: workflowRun.conclusion });
  if (workflowRun.event !== 'push') fail('upstream event is not push', { event: workflowRun.event });
  const sha = workflowRun.head_sha;
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) {
    fail('workflow_run.head_sha missing or malformed', { head_sha: sha });
  }
  return sha;
}

export function checkSecrets(required, env) {
  const missing = required.filter((k) => !env[k] || env[k].length === 0);
  if (missing.length) fail(`required secrets are not configured: ${missing.join(', ')}`, { missing });
}

export function emitOutputs(outPath, values) {
  if (!outPath) return;
  let buf = '';
  for (const [k, v] of Object.entries(values)) {
    buf += `${k}=${String(v).replace(/\n/g, '%0A')}\n`;
  }
  appendFileSync(outPath, buf);
}

// Sync-blocking sleep for backoff between ls-remote attempts. The CLI holds
// the main thread via execFileSync, so blocking here is acceptable; tests
// inject a no-op sleep to keep wall-clock deterministic.
function syncSleep(ms) {
  if (ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Bounded retry on the read-only `git ls-remote` subprocess only. Payload,
// secret, and tag-peel checks run BEFORE this and never re-enter on retry.
// Args/URL are intentionally NOT echoed in the wrapped error so transient
// failures do not leak command-line surface; secrets are not in the args.
export function runLsRemoteWithRetry(remoteUrl, options = {}) {
  const exec = options.exec || execFileSync;
  const sleepFn = options.sleep || syncSleep;
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const backoffMs = options.backoffMs ?? 250;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return exec('git', ['ls-remote', '--tags', remoteUrl], { encoding: 'utf8', timeout: timeoutMs });
    } catch (err) {
      lastErr = err;
      if (i === attempts - 1) break;
      sleepFn(backoffMs * (i + 1));
    }
  }
  throw new Error(`git remote lookup failed after ${attempts} attempts`);
}

export function verifyRelease(payload, options = {}) {
  const trusted = options.trustedRepo !== undefined ? options.trustedRepo : TRUSTED_REPO;
  const required = options.requiredSecrets || REQUIRED_SECRETS;
  const env = options.env || process.env;
  const remoteUrl = options.remoteUrl || REMOTE_URL;
  const lsRemote = options.lsRemote || (() => {
    if (!remoteUrl) fail('no remote URL configured for tag lookup');
    return runLsRemoteWithRetry(remoteUrl, {
      exec: options.exec,
      sleep: options.sleep,
      attempts: options.lsRemoteAttempts,
      timeoutMs: options.lsRemoteTimeoutMs,
      backoffMs: options.lsRemoteBackoffMs,
    });
  });
  const repoName = checkTrustedRepo(payload.repository, trusted);
  const headSha = checkRun(payload.workflow_run);
  checkSecrets(required, env);
  const match = findTagForSha(parseLsRemote(lsRemote()), headSha);
  if (!match) fail('no Git tag peels to workflow_run.head_sha',
    { head_sha: headSha, head_branch: payload.workflow_run.head_branch });
  if (options.outputPath !== undefined) {
    emitOutputs(options.outputPath, { tag: match.name, tag_kind: match.kind, head_sha: headSha, verified: 'true' });
  }
  return { tag: match.name, kind: match.kind, head_sha: headSha, repository: repoName };
}

function readPayload(path) {
  if (!path || !existsSync(path)) fail('event payload not readable', { path });
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (err) { fail('event payload is not valid JSON', { message: err.message }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { verifyRelease(readPayload(EVENT_PATH), { outputPath: process.env.GITHUB_OUTPUT }); }
  catch (err) {
    if (!(err instanceof GateError)) console.error(`::error::${err && err.message ? err.message : String(err)}`);
    process.exit(1);
  }
}