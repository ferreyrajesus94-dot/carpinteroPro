import { describe, it } from 'vitest';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import postcss from 'postcss';

const require = createRequire(import.meta.url);

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const entriesFor = (name) => Object.entries(lock.packages)
  .filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))
  .map(([path, pkg]) => ({ path, ...pkg }));

const atLeast = (version, floor) => {
  const current = version.split('.').map(Number);
  const minimum = floor.split('.').map(Number);
  for (let index = 0; index < minimum.length; index++) {
    if (current[index] !== minimum[index]) return current[index] > minimum[index];
  }
  return true;
};

describe('Tailwind toolchain security graph', () => {
  it('contains no vulnerable braces and resolves patched high-severity floors', () => {
    const braces = entriesFor('braces');
    assert.ok(braces.every(({ version }) => atLeast(version, '3.0.4')),
      `vulnerable braces owner remains: ${braces.map(({ path, version }) => `${path}@${version}`).join(', ')}`);

    for (const [major, floor] of [[1, '1.1.21'], [2, '2.1.7'], [5, '5.0.12']]) {
      const entries = entriesFor('brace-expansion').filter(({ version }) => Number(version.split('.')[0]) === major);
      assert.ok(entries.length > 0, `expected brace-expansion@${major} resolution`);
      assert.ok(entries.every(({ version }) => atLeast(version, floor)),
        `brace-expansion@${major} below ${floor}: ${entries.map(({ path, version }) => `${path}@${version}`).join(', ')}`);
    }

    const undici = entriesFor('undici');
    assert.ok(undici.length > 0, 'expected jsdom-owned undici resolution');
    assert.ok(undici.every(({ version }) => atLeast(version, '7.29.1')),
      `undici below 7.29.1: ${undici.map(({ path, version }) => `${path}@${version}`).join(', ')}`);
  });
});

describe('Tailwind CSS compatibility', () => {
  it('compiles incumbent tokens, utilities and responsive landing classes', async () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    const major = Number(manifest.devDependencies.tailwindcss.match(/^\D*(\d+)/)?.[1]);
    const tailwind = major === 4
      ? require('@tailwindcss/postcss')
      : require('tailwindcss');
    const css = readFileSync('src/index.css', 'utf8');
    const result = await postcss([tailwind()]).process(css, { from: 'src/index.css' });
    let smallShadow;
    result.root.walkRules('.shadow-sm', (rule) => {
      const shadow = rule.nodes.find((node) => node.type === 'decl' && node.prop === '--tw-shadow');
      if (shadow) smallShadow = shadow.value;
    });
    assert.equal(smallShadow, '0 1px 2px 0 var(--tw-shadow-color, rgb(0 0 0 / 0.05))',
      'shadow-sm should retain Tailwind 3’s incumbent small-shadow value');

    for (const expected of [
      '.bg-cp-bg',
      'background: var(--bg);',
      'font-family:',
      'Fraunces',
      'grid-template-columns: 1.1fr 0.9fr;',
      'border-radius: calc(var(--radius) - 2px);',
      '.animate-in',
      ':is(.dark *)',
    ]) {
      assert.ok(result.css.includes(expected), `compiled CSS lost incumbent compatibility marker: ${expected}`);
    }
    assert.ok(css.includes('--bg:         oklch(95% 0.012 80);'), 'source lost the incumbent linen token');
    assert.ok(css.includes('--cp-accent:  oklch(35% 0.04 50);'), 'source lost the incumbent walnut token');
    assert.ok(css.includes('--default-ring-width: 3px;'), 'source lost the legacy 3px ring width');
    assert.ok(css.includes('--default-ring-color: hsl(var(--ring));'), 'source lost the themed ring color');
    assert.ok(css.includes('button:not(:disabled)'), 'source lost the legacy enabled-button cursor affordance');
  });
});
