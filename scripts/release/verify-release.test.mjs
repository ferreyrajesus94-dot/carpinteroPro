#!/usr/bin/env node
// scripts/release/verify-release.test.mjs
// Pure-export + real-subprocess CLI tests vs isolated temp git remotes.
// Identity policy: same-repo push CI SHA + real matching version tag proves
// SHA eligibility, but does NOT prove the GitHub event was a tag push.
// Helper is head_sha-authoritative; cannot tell tag push from branch push
// of the same SHA. Job-level event == 'push' + SHA-from-CI gate identity.
// Untested hosted: helper uses `git ls-remote --tags <url>` against the
// URL from GITHUB_REPOSITORY. Private-repo auth requires ephemeral args
// (deferred to next workflow unit; production limited to public-tag releases).
import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseLsRemote, findTagForSha, checkTrustedRepo, checkRun,
  checkSecrets, verifyRelease } from './verify-release.mjs';

const SHA = (ch) => ch.repeat(40);
const A = SHA('a'), B = SHA('b'), C = SHA('c');
const lsLight = (sha, name) => `${sha}\trefs/tags/${name}`;
const lsAnnot = (t, c, n) => `${t}\trefs/tags/${n}\n${c}\trefs/tags/${n}^{}`;
const payload = (o = {}) => ({ repository: { full_name: 'owner/repo', fork: false },
  workflow_run: { conclusion: 'success', event: 'push', head_branch: 'v1.2.3', head_sha: A, ...o } });
const opts = (e) => ({ trustedRepo: 'owner/repo', requiredSecrets: ['VERCEL_TOKEN'],
  env: { VERCEL_TOKEN: 'fake-token' }, ...e });
const tmpDir = () => mkdtempSync(join(tmpdir(), 'vr-'));
const mkOut = (dir) => { const p = join(dir, 'out'); writeFileSync(p, ''); return p; };
const mustThrow = (p, ls, re) =>
  assert.throws(() => verifyRelease(payload(p), opts({ lsRemote: () => ls })), re);

describe('parseLsRemote', () => {
  it('lightweight tag yields tagSha === commitSha', () => {
    const m = parseLsRemote(lsLight(A, 'v1.2.3'));
    assert.equal(m.size, 1);
    assert.equal(m.get('v1.2.3').kind, 'lightweight');
    assert.equal(m.get('v1.2.3').commitSha, A);
  });
  it('annotated tag emits peeled commit and kind=annotated', () => {
    const m = parseLsRemote(lsAnnot(B, A, 'v2.0.0'));
    assert.equal(m.size, 1);
    assert.equal(m.get('v2.0.0').kind, 'annotated');
    assert.equal(m.get('v2.0.0').commitSha, A);
  });
  it('annotated tag with reversed line order peels and tag-object SHA is ineligible', () => {
    const m = parseLsRemote(`${A}\trefs/tags/v2.0.0^{}\n${B}\trefs/tags/v2.0.0`);
    assert.equal(m.get('v2.0.0').kind, 'annotated');
    assert.equal(m.get('v2.0.0').commitSha, A);
    assert.equal(m.get('v2.0.0').tagSha, B);
    assert.equal(findTagForSha(m, B), null);
  });
  it('empty/null stdout yields empty map', () => {
    assert.equal(parseLsRemote('').size, 0);
    assert.equal(parseLsRemote(null).size, 0);
  });
});

describe('findTagForSha', () => {
  it('matches lightweight tag by commit SHA', () =>
    assert.deepEqual(findTagForSha(parseLsRemote(lsLight(A, 'v1.2.3')), A), { name: 'v1.2.3', kind: 'lightweight' }));
  it('matches annotated tag by peeled commit SHA only, not tag object SHA', () => {
    const m = parseLsRemote(lsAnnot(B, A, 'v2.0.0'));
    assert.deepEqual(findTagForSha(m, A), { name: 'v2.0.0', kind: 'annotated' });
    assert.equal(findTagForSha(m, B), null);
  });
  it('returns null when no tag resolves to head SHA', () =>
    assert.equal(findTagForSha(parseLsRemote(lsLight(C, 'v9.9.9')), A), null));
});

describe('checkTrustedRepo', () => {
  it('returns full_name on matching trusted repo', () =>
    assert.equal(checkTrustedRepo({ full_name: 'owner/repo', fork: false }, 'owner/repo'), 'owner/repo'));
  it('rejects fork even when names match', () =>
    assert.throws(() => checkTrustedRepo({ full_name: 'owner/repo', fork: true }, 'owner/repo'), /fork/i));
  it('rejects foreign repo', () =>
    assert.throws(() => checkTrustedRepo({ full_name: 'attacker/repo', fork: false }, 'owner/repo'), /repository does not match trusted repo/i));
});

describe('checkRun', () => {
  it('accepts success/push with valid SHA', () =>
    assert.equal(checkRun({ conclusion: 'success', event: 'push', head_sha: A }), A));
  it('rejects unsuccessful CI', () =>
    assert.throws(() => checkRun({ conclusion: 'failure', event: 'push', head_sha: A }), /did not succeed/i));
  it('rejects pull_request event', () =>
    assert.throws(() => checkRun({ conclusion: 'success', event: 'pull_request', head_sha: A }), /not push/i));
  it('rejects malformed head_sha (not 40 hex)', () => {
    for (const bad of ['not-a-sha', 'a'.repeat(39), 'g'.repeat(40), null, undefined, 42]) {
      assert.throws(() => checkRun({ conclusion: 'success', event: 'push', head_sha: bad }),
        /head_sha missing or malformed/i, `expected throw for ${JSON.stringify(bad)}`);
    }
  });
});

describe('checkSecrets', () => {
  it('passes when every required key is non-empty', () =>
    assert.doesNotThrow(() => checkSecrets(['A', 'B'], { A: 'x', B: 'y' })));
  it('throws listing the exact missing names', () => {
    try {
      checkSecrets(['VERCEL_TOKEN', 'VERCEL_ORG_ID'], { VERCEL_TOKEN: '' });
      assert.fail('expected throw');
    } catch (err) {
      assert.match(err.message, /secrets are not configured/i);
      assert.match(err.message, /VERCEL_TOKEN/);
      assert.match(err.message, /VERCEL_ORG_ID/);
    }
  });
});

describe('verifyRelease orchestrator', () => {
  it('lightweight tag match succeeds and writes outputs', () => {
    const dir = tmpDir(); const out = mkOut(dir);
    const result = verifyRelease(payload({ head_branch: 'v1.2.3' }),
      { ...opts({ lsRemote: () => lsLight(A, 'v1.2.3'), outputPath: out }) });
    assert.deepEqual(result, { tag: 'v1.2.3', kind: 'lightweight', head_sha: A, repository: 'owner/repo' });
    const content = readFileSync(out, 'utf8');
    for (const n of ['tag=v1.2.3\n', 'tag_kind=lightweight\n', 'verified=true\n', 'head_sha=']) assert.ok(content.includes(n), `missing ${n} in ${JSON.stringify(content)}`);
    rmSync(dir, { recursive: true, force: true });
  });
  it('annotated tag match succeeds (peeled commit SHA matches)', () => {
    const dir = tmpDir(); const out = mkOut(dir);
    const result = verifyRelease(payload({ head_branch: 'v2.0.0' }),
      { ...opts({ lsRemote: () => lsAnnot(B, A, 'v2.0.0'), outputPath: out }) });
    assert.equal(result.kind, 'annotated');
    assert.ok(readFileSync(out, 'utf8').includes('tag_kind=annotated\n'));
    rmSync(dir, { recursive: true, force: true });
  });
  it('version-like branch with NO tag is rejected (name is not evidence)', () =>
    mustThrow({ head_branch: 'v1.2.3', head_sha: B }, lsLight(C, 'v9.9.9'), /no Git tag peels/i));
  it('tag pointing to a different SHA than head_sha is rejected', () =>
    mustThrow({ head_sha: A }, lsLight(C, 'v1.2.3'), /no Git tag peels/i));
  it('pull_request event is rejected', () =>
    mustThrow({ event: 'pull_request' }, lsLight(A, 'v1.2.3'), /not push/i));
  it('unsuccessful CI is rejected', () =>
    mustThrow({ conclusion: 'failure' }, lsLight(A, 'v1.2.3'), /did not succeed/i));
  it('foreign repo is rejected', () =>
    assert.throws(() => verifyRelease({
      repository: { full_name: 'attacker/repo', fork: false },
      workflow_run: { conclusion: 'success', event: 'push', head_sha: A },
    }, { ...opts({ lsRemote: () => lsLight(A, 'v1.2.3') }) }), /repository does not match trusted repo/i));
  it('forked repo is rejected even with matching name', () =>
    assert.throws(() => verifyRelease({
      repository: { full_name: 'owner/repo', fork: true },
      workflow_run: { conclusion: 'success', event: 'push', head_sha: A },
    }, { ...opts({ lsRemote: () => lsLight(A, 'v1.2.3') }) }), /fork/i));
  it('missing secrets abort before any tag query', () => {
    let queried = false;
    assert.throws(() => verifyRelease(payload(), {
      trustedRepo: 'owner/repo', requiredSecrets: ['VERCEL_TOKEN'], env: {},
      lsRemote: () => { queried = true; return ''; },
    }), /secrets are not configured/i);
    assert.equal(queried, false, 'must not query remote before secret check');
  });
  it('malformed head_sha is rejected', () =>
    mustThrow({ head_sha: 'g'.repeat(40) }, lsLight(A, 'v1.2.3'), /head_sha missing or malformed/i));
  // R4 bounded retry: read-only `git ls-remote` subprocess failures are
  // retried; the per-attempt timeout is preserved; payload/secret/tag checks
  // never trigger the retry path because they run BEFORE ls-remote.
  it('ls-remote transient subprocess failures are retried and then succeed', () => {
    let calls = 0;
    const fakeExec = () => {
      calls++;
      if (calls < 3) throw new Error('ECONNRESET');
      return lsLight(A, 'v1.2.3');
    };
    const result = verifyRelease(payload(),
      { trustedRepo: 'owner/repo', requiredSecrets: ['VERCEL_TOKEN'],
        env: { VERCEL_TOKEN: 'fake-token' },
        exec: fakeExec, sleep: () => {},
        lsRemoteAttempts: 3,
        remoteUrl: 'https://example.com/owner/repo.git' });
    assert.equal(calls, 3, `expected 3 attempts before success, got ${calls}`);
    assert.equal(result.tag, 'v1.2.3');
  });
  it('ls-remote exhaustion fails closed and never emits verified=true', () => {
    const dir = tmpDir(); const out = mkOut(dir);
    const fakeExec = () => { throw new Error('persistent network error'); };
    assert.throws(() => verifyRelease(payload(),
      { trustedRepo: 'owner/repo', requiredSecrets: ['VERCEL_TOKEN'],
        env: { VERCEL_TOKEN: 'fake-token' },
        exec: fakeExec, sleep: () => {},
        lsRemoteAttempts: 3,
        remoteUrl: 'https://example.com/owner/repo.git',
        outputPath: out }),
      /lookup failed/i);
    const content = readFileSync(out, 'utf8');
    assert.ok(!content.includes('verified=true'),
      `must NOT emit verified=true on exhaustion, got ${JSON.stringify(content)}`);
    rmSync(dir, { recursive: true, force: true });
  });
  it('ls-remote exhaustion error does not leak remote URL or git args', () => {
    const fakeExec = () => {
      const e = new Error('ECONNRESET github.com/owner/secret-repo.git ls-remote');
      throw e;
    };
    const remoteUrl = 'https://github.com/owner/secret-repo.git';
    try {
      verifyRelease(payload(),
        { trustedRepo: 'owner/repo', requiredSecrets: ['VERCEL_TOKEN'],
          env: { VERCEL_TOKEN: 'fake-token' },
          exec: fakeExec, sleep: () => {},
          lsRemoteAttempts: 2,
          remoteUrl });
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(!err.message.includes('github.com'),
        `error must not leak remote URL: ${err.message}`);
      assert.ok(!err.message.includes('ls-remote'),
        `error must not leak command args: ${err.message}`);
    }
  });
});

// CLI integration: real git + node subprocess against isolated temp remotes.
// VERIFY_TRUSTED_REPO + VERIFY_REMOTE_URL are test-only overrides; production
// derives URL from GITHUB_REPOSITORY in the trusted runner env.
const HELPER = resolve('scripts/release/verify-release.mjs');
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@e', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@e' };
const git = (cwd, ...args) => spawnSync('git', args, { cwd, env: GIT_ENV, encoding: 'utf8' });
function makeRemote(tags = []) {
  const remote = mkdtempSync(join(tmpdir(), 'vr-remote-'));
  git(remote, 'init', '-q', '--bare');
  const src = mkdtempSync(join(tmpdir(), 'vr-src-'));
  git(src, 'init', '-q');
  writeFileSync(join(src, 'f'), 'x');
  git(src, 'add', 'f');
  git(src, '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '-m', 'first');
  const sha = git(src, 'rev-parse', 'HEAD').stdout.trim();
  git(src, 'push', '-q', remote, 'HEAD:refs/heads/main');
  for (const t of tags) {
    if (t.kind === 'annotated') git(src, 'tag', '-a', t.name, '-m', `tag ${t.name}`);
    else git(src, 'tag', t.name);
    git(src, 'push', '-q', remote, `refs/tags/${t.name}`);
  }
  return { remote, src, sha };
}
const SECRETS = { VERCEL_TOKEN: 't', VERCEL_ORG_ID: 'o', VERCEL_PROJECT_ID: 'p' };
const SCRUB_KEYS = 'GITHUB_REPOSITORY,GITHUB_EVENT_PATH,GITHUB_OUTPUT,VERIFY_TRUSTED_REPO,VERIFY_REMOTE_URL,VERIFY_EVENT_PATH,VERIFY_REQUIRED_SECRETS,VERCEL_TOKEN,VERCEL_ORG_ID,VERCEL_PROJECT_ID'.split(',');
function runCli(payloadObj, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vr-cli-'));
  const eventPath = join(dir, 'event.json');
  const outPath = join(dir, 'gh-output');
  writeFileSync(eventPath, JSON.stringify(payloadObj));
  writeFileSync(outPath, '');
  const baseEnv = { ...process.env };
  for (const k of SCRUB_KEYS) delete baseEnv[k];
  const proc = spawnSync('node', [HELPER], { env: { ...baseEnv, ...env, VERIFY_EVENT_PATH: eventPath, GITHUB_OUTPUT: outPath }, encoding: 'utf8', timeout: 30000 });
  const output = readFileSync(outPath, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return { status: proc.status, output, stderr: proc.stderr };
}

describe('CLI integration (real git, isolated temp remotes)', () => {
  it('lightweight tag push with matching SHA exits 0 and writes outputs', () => {
    const { remote, sha } = makeRemote([{ name: 'v1.2.3', kind: 'lightweight' }]);
    const { status, output } = runCli(payload({ head_sha: sha }), {
      VERIFY_TRUSTED_REPO: 'owner/repo', VERIFY_REMOTE_URL: remote, ...SECRETS,
    });
    assert.equal(status, 0);
    for (const n of [`tag=v1.2.3\n`, `tag_kind=lightweight\n`, `verified=true\n`, `head_sha=${sha}\n`]) assert.ok(output.includes(n), `missing ${n}`);
  });
  it('annotated tag push with matching peeled SHA exits 0', () => {
    const { remote, sha } = makeRemote([{ name: 'v2.0.0', kind: 'annotated' }]);
    const { status, output } = runCli(payload({ head_sha: sha }), {
      VERIFY_TRUSTED_REPO: 'owner/repo', VERIFY_REMOTE_URL: remote, ...SECRETS,
    });
    assert.equal(status, 0);
    for (const n of [`tag=v2.0.0\n`, `tag_kind=annotated\n`, `verified=true\n`, `head_sha=${sha}\n`]) assert.ok(output.includes(n), `missing ${n}`);
  });
  it('no tags in remote exits 1 (mismatch)', () => {
    const { remote, sha } = makeRemote([]);
    const { status } = runCli(payload({ head_sha: sha }), {
      VERIFY_TRUSTED_REPO: 'owner/repo', VERIFY_REMOTE_URL: remote, ...SECRETS,
    });
    assert.equal(status, 1);
  });
  // Branch with matching real tag: helper is head_sha-authoritative; cannot tell tag push from branch push.
  it('branch v1.2.3 with matching real tag v1.2.3 still proves SHA eligibility', () => {
    const { remote, src, sha } = makeRemote([{ name: 'v1.2.3', kind: 'lightweight' }]);
    git(src, 'checkout', '-q', '-b', 'v1.2.3', sha);
    git(src, 'push', '-q', remote, 'v1.2.3');
    const { status, output } = runCli({
      repository: { full_name: 'owner/repo', fork: false },
      workflow_run: { conclusion: 'success', event: 'push', head_branch: 'v1.2.3', head_sha: sha },
    }, { VERIFY_TRUSTED_REPO: 'owner/repo', VERIFY_REMOTE_URL: remote, ...SECRETS });
    assert.equal(status, 0);
    assert.ok(output.includes('tag=v1.2.3\n'));
  });
  it('foreign repo / pull_request / unsuccessful CI / missing secrets exit 1', () => {
    const { remote, sha } = makeRemote([{ name: 'v1.2.3', kind: 'lightweight' }]);
    const base = { VERIFY_TRUSTED_REPO: 'owner/repo', VERIFY_REMOTE_URL: remote, ...SECRETS };
    const cases = [
      ['foreign', { repository: { full_name: 'attacker/repo', fork: false }, workflow_run: { conclusion: 'success', event: 'push', head_sha: SHA('a') } }, base],
      ['pull_request', payload({ head_sha: sha, event: 'pull_request' }), base],
      ['failure', payload({ head_sha: sha, conclusion: 'failure' }), base],
      ['missing_secrets', payload({ head_sha: sha }), { VERIFY_TRUSTED_REPO: 'owner/repo' }],
    ];
    for (const [name, p, env] of cases) assert.equal(runCli(p, env).status, 1, `expected exit 1 for ${name}`);
  });
  it('no remote URL configured exits 1', () => {
    const { sha } = makeRemote([{ name: 'v1.2.3', kind: 'lightweight' }]);
    const { status } = runCli(payload({ head_sha: sha }), { ...SECRETS });
    assert.equal(status, 1);
  });
  // R2 pathToFileURL regression: Node percent-encodes spaces/#/% in
  // import.meta.url but leaves argv[1] raw, so the current
  // `import.meta.url === file://${process.argv[1]}` check silently
  // skips the CLI body (exit 0) for paths containing those chars.
  // With the fix, the body runs and fails closed on missing remote URL.
  it('CLI body runs when invoked from a path containing spaces/#/% (pathToFileURL regression)', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'vr-cli-special-'));
    const dir = join(tmpRoot, 'path with #chars%here');
    mkdirSync(dir);
    const helperDest = join(dir, 'verify-release.mjs');
    writeFileSync(helperDest, readFileSync(HELPER, 'utf8'));
    const eventPath = join(dir, 'event.json');
    writeFileSync(eventPath, JSON.stringify(payload()));
    const outPath = join(dir, 'gh-output');
    writeFileSync(outPath, '');
    const baseEnv = { ...process.env };
    for (const k of SCRUB_KEYS) delete baseEnv[k];
    const proc = spawnSync('node', [helperDest], {
      env: { ...baseEnv, VERIFY_EVENT_PATH: eventPath, GITHUB_OUTPUT: outPath },
      encoding: 'utf8', timeout: 30000,
    });
    rmSync(tmpRoot, { recursive: true, force: true });
    assert.notEqual(proc.status, 0,
      `CLI body was skipped silently: status=${proc.status}, stderr=${proc.stderr}`);
  });
});
