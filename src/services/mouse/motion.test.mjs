import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules(['src/services/mouse/motion.ts']);
const { addMotionDelta } = createRequire(import.meta.url)(
  `${outputRoot}/src/services/mouse/motion.js`,
);

test('accumulates every sampled delta without losing the final movement', () => {
  const samples = [
    { dx: 0.2, dy: -0.4 },
    { dx: 1.1, dy: 0.3 },
    { dx: -0.5, dy: 0.8 },
  ];
  const total = samples.reduce(
    (delta, sample) => ({
      dx: addMotionDelta(delta.dx, sample.dx),
      dy: addMotionDelta(delta.dy, sample.dy),
    }),
    { dx: 0, dy: 0 },
  );

  assert.deepEqual(total, { dx: 0.8, dy: 0.7 });
});

test.after(cleanupTestModules);
