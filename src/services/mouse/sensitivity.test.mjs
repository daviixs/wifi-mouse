import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/services/mouse/sensitivity.ts',
  'src/services/mouse/motion.ts',
]);
const require = createRequire(import.meta.url);
const { normalizeSensitivity } = require(`${outputRoot}/src/services/mouse/sensitivity.js`);
const { applyMotionSensitivity } = require(`${outputRoot}/src/services/mouse/motion.js`);

test('normalizes sensitivity to the supported range and tenth increments', () => {
  assert.equal(normalizeSensitivity(0.1), 0.5);
  assert.equal(normalizeSensitivity(1.26), 1.3);
  assert.equal(normalizeSensitivity(3.5), 3);
  assert.equal(normalizeSensitivity(Number.NaN), 1);
});

test('scales cursor movement by sensitivity', () => {
  assert.deepEqual(applyMotionSensitivity('mouse.move', 3.5, -4, 2), { dx: 7, dy: -8 });
  assert.deepEqual(applyMotionSensitivity('mouse.move', -4, 6, 0.5), { dx: -2, dy: 3 });
});

test('leaves scroll deltas unchanged by cursor sensitivity', () => {
  assert.deepEqual(applyMotionSensitivity('mouse.scroll', 3, -2, 2.5), { dx: 3, dy: -2 });
});

test.after(cleanupTestModules);
