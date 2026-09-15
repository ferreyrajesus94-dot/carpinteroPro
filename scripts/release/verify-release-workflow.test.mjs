#!/usr/bin/env node
// scripts/release/verify-release-workflow.test.mjs
// Static + emulator tests for .github/workflows/release.yml. The helper
// (verify-release.test.mjs) covers the Node side; this file covers the
// YAML wiring that the production deploy depends on.
//
// Scope: parses the workflow with the installed `js-yaml` package (no
// installs), inspects ordering, gating, env expansion paths and command
// bodies as text. Does NOT stand up a real Actions runner; the fake-vercel
// subprocess suite emulates the bash expansion that the runner would
// perform, locally. Public git ls-remote against
// https://github.com/${GITHUB_REPOSITORY}.git only; private-repo auth is
// intentionally out of scope (see verify-release.mjs).
//
// Identity policy: this suite proves the wiring required to deploy the
// helper-verified SHA; it does NOT prove the GitHub event was a tag push
// (the helper is head_sha-authoritative; see verify-release.test.mjs).

import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let loadYaml;
try { ({ load: loadYaml } = require('js-yaml')); }
catch (err) {
  // Fail loud: a homemade YAML parser would silently drift from the
  // installed js-yaml semantics and weaken the wire test.
  throw new Error(`verify-release-workflow.test.mjs requires the js-yaml package. ` +
    `Underlying error: ${err.message}`);
}

const WORKFLOW = resolve('.github/workflows/release.yml');
const HELPER = resolve('scripts/release/verify-release.mjs');
const GATED = "steps.gate.outputs.verified == 'true'";

function loadJob() {
  const doc = loadYaml(readFileSync(WORKFLOW, 'utf8'));
  const job = doc && doc.jobs && doc.jobs['deploy-production'];
  if (!job || !Array.isArray(job.steps)) throw new Error('release.yml missing jobs.deploy-production.steps');
  return { doc, job, steps: job.steps };
}
const findStep = (steps, re) => steps.find((s) => re.test(s.name));
const idxOf = (steps, re) => steps.findIndex((s) => re.test(s.name));

describe('release.yml: trigger + structural shape', () => {
  it('triggers on workflow_run from CI completion', () => {
    const { doc } = loadJob();
    const trigger = doc.on; // js-yaml 4.x is YAML 1.2; `on:` stays the literal string key (not coerced to boolean true as in YAML 1.1)
    assert.ok(trigger && trigger.workflow_run, 'expected workflow_run trigger');
    assert.deepEqual(trigger.workflow_run.workflows, ['CI']);
    assert.deepEqual(trigger.workflow_run.types, ['completed']);
  });
});

describe('release.yml: ordering invariants (fail closed)', () => {
  it('helper < node < gate < candidate (verified output gates the candidate)', () => {
    const { steps } = loadJob();
    const iHelper = idxOf(steps, /trusted helper/i);
    const iNode = idxOf(steps, /Setup Node/i);
    const iGate = idxOf(steps, /Verify release eligibility/i);
    const iCandidate = idxOf(steps, /Checkout deploy candidate/i);
    assert.ok([iHelper, iNode, iGate, iCandidate].every((i) => i >= 0), 'missing required step');
    assert.ok(iHelper < iNode && iNode < iGate && iGate < iCandidate,
      `ordering wrong: helper=${iHelper} node=${iNode} gate=${iGate} candidate=${iCandidate}`);
  });

  it('Setup Node has no npm cache referencing a not-yet-checked-out path', () => {
    const { steps } = loadJob();
    const node = findStep(steps, /Setup Node/i);
    const dep = node.with && node.with['cache-dependency-path'];
    if (node.with && node.with.cache) {
      assert.ok(!dep || !/app\//.test(dep),
        `cache-dependency-path="${dep}" references "app/" created AFTER Setup Node; drop or move it`);
    }
  });
});

describe('release.yml: gating on steps.gate.outputs.verified == \'true\'', () => {
  it('every step that touches app/ or runs vercel pull/deploy is gated', () => {
    const { steps } = loadJob();
    const touchesAppOrVercel = (s) =>
      /app\//.test(s['working-directory'] || '')
      || (s.with && s.with.path === 'app')
      || /vercel (pull|deploy)/.test(s.run || '');
    for (const step of steps) {
      if (!touchesAppOrVercel(step)) continue;
      assert.equal(step.if, GATED,
        `step "${step.name}" must be gated on steps.gate.outputs.verified == 'true' (got ${JSON.stringify(step.if)})`);
    }
  });

  it('summary step is gated on success() AND verified output', () => {
    const { steps } = loadJob();
    const summary = findStep(steps, /summary/i);
    assert.ok(summary, 'Summary step missing');
    assert.match(summary.if, /success\(\)/);
    assert.match(summary.if, /steps\.gate\.outputs\.verified == 'true'/);
  });
});

describe('release.yml: trusted + candidate checkouts', () => {
  it('helper checkout uses default_branch into helper/, persist-credentials: false', () => {
    const { steps } = loadJob();
    const helper = findStep(steps, /trusted helper/i);
    assert.match(helper.with.ref, /github\.event\.repository\.default_branch/);
    assert.doesNotMatch(helper.with.ref, /head_sha/);
    assert.equal(helper.with.path, 'helper');
    assert.equal(helper.with['persist-credentials'], false);
  });

  it('candidate checkout uses steps.gate.outputs.head_sha into app/, persist-credentials: false', () => {
    const { steps } = loadJob();
    const cand = findStep(steps, /Checkout deploy candidate/i);
    assert.equal(cand.with.ref, '${{ steps.gate.outputs.head_sha }}');
    assert.equal(cand.with.path, 'app');
    assert.equal(cand.with['persist-credentials'], false);
  });
});

describe('release.yml: pull/deploy Vercel steps', () => {
  it('both declare VERCEL_TOKEN from secrets.VERCEL_TOKEN, run in app/, with safe env expansion', () => {
    const { steps } = loadJob();
    for (const step of [findStep(steps, /Pull Vercel/i), findStep(steps, /Deploy to production/i)]) {
      assert.ok(step && step.env && step.env.VERCEL_TOKEN, `${step.name}: missing env.VERCEL_TOKEN`);
      assert.equal(step.env.VERCEL_TOKEN, '${{ secrets.VERCEL_TOKEN }}');
      assert.equal(step['working-directory'], 'app');
      // Safe expansion: ${VERCEL_TOKEN} inside `run:` resolved from
      // step `env:`, not from a hardcoded value or workflow context.
      assert.match(step.run, /\$\{VERCEL_TOKEN\}/);
      assert.doesNotMatch(step.run, /secrets\.VERCEL_TOKEN/,
        `${step.name}: must not interpolate secrets.* inside run:`);
    }
  });
});

describe('release.yml: pull/deploy shell expansion emulator (bash + fake vercel)', () => {
  // Emulates the bash expansion that the hosted Actions runner performs.
  // Writes a fake `vercel` shell stub to a temp dir, prepends it to PATH,
  // runs `bash -c <run>` with a dummy VERCEL_TOKEN, and reads the stub's
  // argv/env dump to assert the token the step would have received.
  // The fake token is a fixed sentinel; no real secrets are used.
  const FAKE = 'dummy-vercel-token-for-workflow-test';
  function runWithFake(runCmd) {
    const dir = mkdtempSync(join(tmpdir(), 'vrwf-'));
    const binDir = join(dir, 'bin');
    const dump = join(dir, 'dump');
    mkdirSync(binDir, { recursive: true });
    writeFileSync(join(binDir, 'vercel'),
      '#!/usr/bin/env bash\nset -eu\n{ echo ARGV; for a in "$@"; do printf "%s\\n" "$a"; done; echo END; echo "TOKEN=${VERCEL_TOKEN:-}"; } > "$DUMP"\n',
      { mode: 0o755 });
    // Sanitize: drop any inherited secrets before re-injecting the dummy.
    const env = { PATH: `${binDir}:/usr/bin:/bin`, VERCEL_TOKEN: FAKE, DUMP: dump };
    const proc = spawnSync('bash', ['-c', runCmd], { env, encoding: 'utf8' });
    const out = readFileSync(dump, 'utf8');
    rmSync(dir, { recursive: true, force: true });
    return { status: proc.status, dump: out };
  }

  it('pull command forwards the dummy token via --token without a network call', () => {
    const pull = findStep(loadJob().steps, /Pull Vercel/i);
    const { status, dump } = runWithFake(pull.run);
    assert.equal(status, 0);
    assert.match(dump, /ARGV\npull\n--yes\n--token=dummy-vercel-token-for-workflow-test\nEND/);
    assert.match(dump, /TOKEN=dummy-vercel-token-for-workflow-test/);
  });

  it('deploy command forwards the dummy token with --prod without a network call', () => {
    const deploy = findStep(loadJob().steps, /Deploy to production/i);
    const { status, dump } = runWithFake(deploy.run);
    assert.equal(status, 0);
    assert.match(dump, /ARGV\ndeploy\n--prod\n--yes\n--token=dummy-vercel-token-for-workflow-test\nEND/);
  });
});

describe('release.yml: untested hosted limits (documented)', () => {
  it('helper uses PUBLIC git ls-remote derived from GITHUB_REPOSITORY context; no URL-embedded creds', () => {
    const helperSrc = readFileSync(HELPER, 'utf8');
    assert.match(helperSrc, /github\.com/, 'helper must build public github.com URL');
    assert.doesNotMatch(helperSrc, /\/\/[^/]*:[^/]*@/, 'helper must not embed credentials in URL');
    const wfSrc = readFileSync(WORKFLOW, 'utf8');
    // github.repository (YAML) === GITHUB_REPOSITORY (helper env). Either is fine.
    assert.match(wfSrc, /github\.repository|GITHUB_REPOSITORY/);
  });

  it('workflow_run may rerun; production is NOT exactly once per SHA (honest claim)', () => {
    // The hosted runner allows manual reruns of workflow_run from the UI;
    // the workflow does not enforce once-only delivery. This assertion
    // locks that policy in by failing if anyone reintroduces an
    // "exactly once" comment.
    const wfSrc = readFileSync(WORKFLOW, 'utf8');
    assert.doesNotMatch(wfSrc, /exactly once per workflow_run/i);
    assert.match(wfSrc, /rerun/i);
  });
});
