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
const CI = resolve('.github/workflows/ci.yml');
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
  it('triggers on workflow_call from CI tag-deploy job with required tag + head_sha inputs', () => {
    const { doc } = loadJob();
    const trigger = doc.on;
    assert.ok(trigger && trigger.workflow_call, 'expected workflow_call trigger (replaces workflow_run)');
    assert.ok(trigger.workflow_call.inputs, 'workflow_call must declare inputs');
    assert.equal(trigger.workflow_call.inputs.tag.required, true);
    assert.equal(trigger.workflow_call.inputs.tag.type, 'string');
    assert.equal(trigger.workflow_call.inputs.head_sha.required, true);
    assert.equal(trigger.workflow_call.inputs.head_sha.type, 'string');
  });
});

describe('ci.yml: tag-deploy job gating (single production route)', () => {
  function loadCiJob(name) {
    const doc = loadYaml(readFileSync(CI, 'utf8'));
    const job = doc && doc.jobs && doc.jobs[name];
    if (!job) throw new Error(`ci.yml missing jobs.${name}`);
    return { doc, job };
  }
  it('push trigger includes an explicit tags: filter so CI runs on tag pushes', () => {
    const push = loadYaml(readFileSync(CI, 'utf8')).on.push;
    assert.ok(push, 'expected on.push');
    assert.ok(Array.isArray(push.tags) && push.tags.length > 0,
      `on.push.tags MUST be specified; without it, GitHub does NOT trigger CI on tag pushes (got ${JSON.stringify(push.tags)})`);
  });
  it('declares a tag-deploy job that depends on the upstream verify job', () => {
    const { job } = loadCiJob('tag-deploy');
    assert.ok(job.needs && (job.needs === 'verify' || (Array.isArray(job.needs) && job.needs.includes('verify'))),
      `tag-deploy must depend on verify (got ${JSON.stringify(job.needs)})`);
  });
  it('tag-deploy only fires for tag pushes (not branch pushes)', () => {
    const { job } = loadCiJob('tag-deploy');
    assert.match(job.if, /github\.event_name\s*==\s*['"]push['"]/);
    assert.match(job.if, /startsWith\(github\.ref,\s*['"]refs\/tags\/['"]\)/);
    assert.doesNotMatch(job.if, /startsWith\(.*,\s*['"]v['"]\)/);
  });
  it('tag-deploy is a JOB-LEVEL reusable-workflow call (uses, no runs-on, no steps)', () => {
    const { job } = loadCiJob('tag-deploy');
    assert.match(job.uses || '', /^\.\/\.github\/workflows\/release\.yml$/,
      `tag-deploy must declare JOB-LEVEL uses: ./.github/workflows/release.yml (got ${JSON.stringify(job.uses)})`);
    assert.equal(job['runs-on'], undefined,
      `tag-deploy must NOT declare runs-on (job-level uses replaces it; got ${JSON.stringify(job['runs-on'])})`);
    assert.equal(job.steps, undefined,
      `tag-deploy must NOT declare steps (job-level uses replaces them; got ${JSON.stringify(job.steps)})`);
  });
  it('tag-deploy forwards tag + head_sha via job-level with: and secrets: inherit', () => {
    const { job } = loadCiJob('tag-deploy');
    assert.equal(job.with.tag, '${{ github.ref_name }}',
      'tag input must come from github.ref_name');
    assert.equal(job.with.head_sha, '${{ github.sha }}',
      'head_sha input must come from github.sha');
    assert.equal(job.secrets, 'inherit',
      `tag-deploy must forward secrets: inherit at the JOB level (not step level; got ${JSON.stringify(job.secrets)})`);
  });
  it('ci.yml has NO step-level uses of the reusable workflow (invalid GitHub schema)', () => {
    const doc = loadYaml(readFileSync(CI, 'utf8'));
    for (const [jobName, job] of Object.entries(doc.jobs || {})) {
      for (const step of (job.steps || [])) {
        assert.doesNotMatch(step.uses || '',
          /\.github\/workflows\/release\.yml/,
          `step-level uses of release.yml is invalid GitHub schema; found in job "${jobName}" step "${step.name || ''}"`);
      }
    }
  });
  it('ci.yml has NO inline vercel CLI calls anywhere (single production route)', () => {
    const src = readFileSync(CI, 'utf8');
    assert.doesNotMatch(src, /^\s*run:\s*.*vercel\s+(pull|deploy)/m,
      'ci.yml must not run `vercel pull` or `vercel deploy` inline; only release.yml owns the deploy');
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
  it('gate step forwards workflow_call tag + head_sha inputs to the helper env', () => {
    const { steps } = loadJob();
    const gate = findStep(steps, /Verify release eligibility/i);
    assert.match(gate.env.VERIFY_TAG || '', /inputs\.tag/,
      'gate must export VERIFY_TAG from inputs.tag');
    assert.match(gate.env.VERIFY_HEAD_SHA || '', /inputs\.head_sha/,
      'gate must export VERIFY_HEAD_SHA from inputs.head_sha');
  });
  it('deploy-production job refuses calls from non-CI workflows (malicious caller cannot skip verify)', () => {
    const { job } = loadJob();
    // Primary boundary: only CI's tag-deploy job (which itself depends on
    // verify) may invoke release.yml. Any other caller would skip the
    // lint+test+build gate; refuse it.
    assert.match(job.if || '', /github\.workflow\s*==\s*['"]CI['"]/,
      `release.yml deploy-production if must require github.workflow == 'CI' to refuse non-CI callers (got ${JSON.stringify(job.if)})`);
  });
  it('declares permissions and uses a minimal token scope (least privilege)', () => {
    const { doc, job } = loadJob();
    assert.ok(doc.permissions || job.permissions,
      'release.yml must declare permissions: at the workflow or job level (least privilege)');
    const perms = job.permissions || doc.permissions;
    assert.equal(perms.contents, 'read',
      `permissions.contents must be 'read' (least privilege for deploy; got ${JSON.stringify(perms)})`);
    assert.equal(perms.actions, undefined,
      'release.yml must NOT request actions: write (CI tag-deploy owns the call)');
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

  it('does NOT use ignoredBuild / vercel.json sentinel (single production route is the release workflow)', () => {
    // The release path is the ONLY production route. ignoredBuild / sentinel
    // patterns were considered and rejected because they are inverted /
    // unreliable for git-push deployments. This assertion locks that policy.
    const vercelJson = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));
    assert.ok(vercelJson.git && vercelJson.git.deploymentEnabled,
      'vercel.json must declare git.deploymentEnabled to disable main auto-deploy');
    assert.equal(vercelJson.git.deploymentEnabled.main, false,
      'main must be explicitly disabled (CLI deploy --prod is unaffected)');
    assert.doesNotMatch(JSON.stringify(vercelJson), /ignoredBuild/i,
      'vercel.json must not use the inverted ignoredBuild exitcode sentinel');
  });
});
