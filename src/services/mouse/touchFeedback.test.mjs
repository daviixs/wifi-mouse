import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';
const root = transpileTestModules([
  'src/services/mouse/touchFeedback.ts',
  'src/hooks/useInteractionLifetime.ts',
]);
const { TOUCH_FEEDBACK: owners, updateTouchFeedback: update } = createRequire(import.meta.url)(
  `${root}/src/services/mouse/touchFeedback.js`,
);
test.after(cleanupTestModules);

test('Race loser finalize cannot turn off the active drag or two-finger scroll', () => {
  for (const winner of Object.values(owners)) {
    let mask = 0;
    for (const owner of Object.values(owners)) mask = update(mask, owner, 'begin');
    for (const loser of Object.values(owners).filter((owner) => owner !== winner)) {
      mask = update(mask, loser, 'finalize');
      assert.ok(mask & winner, 'winner stays highlighted');
    }
    assert.equal(mask, winner); // no timer/expiry; remains active for the whole gesture
    assert.equal(update(mask, winner, 'finalize'), 0);
  }
});
test('finalization is idempotent for END, FAILED and CANCELLED, even before activation', () => {
  for (const owner of Object.values(owners)) {
    let mask = update(0, owner, 'begin');
    mask = update(mask, owner, 'begin');
    assert.equal(mask, owner);
    mask = update(mask, owner, 'finalize');
    assert.equal(mask, 0);
    assert.equal(update(mask, owner, 'finalize'), 0);
  }
});
test('disable/disconnect/unmount reset all owners and a new interaction starts clean', () => {
  let mask = Object.values(owners).reduce((m, o) => update(m, o, 'begin'), 0);
  mask = update(mask, 0, 'reset');
  assert.equal(mask, 0);
  for (const owner of Object.values(owners)) mask = update(mask, owner, 'finalize');
  assert.equal(mask, 0);
  assert.equal(update(mask, owners.move, 'begin'), owners.move);
});
test('component wires owned finalize, lifecycle cleanup, online-only input and lighter feedback (structural only)', () => {
  const source = readFileSync(new URL('../../components/Touchpad.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../../app/touchpad.tsx', import.meta.url), 'utf8');
  for (const name of Object.keys(owners)) {
    assert.match(source, new RegExp(`TOUCH_FEEDBACK\\.${name}, 'begin'`));
    assert.match(source, new RegExp(`TOUCH_FEEDBACK\\.${name}, 'finalize'`));
  }
  assert.equal((source.match(/\.enabled\(enabled\)/g) || []).length, 4);
  const lifetime = readFileSync(
    new URL('../../hooks/useInteractionLifetime.ts', import.meta.url),
    'utf8',
  );
  assert.match(lifetime, /live.current = false/);
  assert.match(source, /if \(!isLive\(\)\) return/);
  assert.match(source, /if \(!enabled\) reset\(\)/);
  assert.match(source, /updateTouchFeedback\(activeGestures.get\(\), 0, 'reset'\)/);
  assert.match(source, /frameCallback.setActive\(false\)/);
  assert.match(source, /COLORS.surfaceActive/);
  assert.doesNotMatch(source, /setTimeout|withDelay/);
  assert.match(route, /enabled=\{status === 'connected'\}/);
  const tokens = readFileSync(new URL('../../theme/tokens.ts', import.meta.url), 'utf8');
  const rgb = (name) =>
    tokens
      .match(new RegExp(`${name}: '#([0-9A-Fa-f]{6})'`))[1]
      .match(/../g)
      .map((x) => parseInt(x, 16));
  const idle = rgb('surface'),
    active = rgb('surfaceActive');
  assert.ok(active.every((v, i) => v > idle[i]));
});

test('RN lifecycle getter drops queued callbacks after disable/unmount (React hook primitives mocked)', () => {
  let ref, pendingEffect;
  const module = { exports: {} };
  const react = {
    useRef: (initial) => (ref ??= { current: initial }),
    useCallback: (fn) => fn,
    useEffect: (effect) => {
      pendingEffect = effect;
    },
  };
  vm.runInNewContext(readFileSync(`${root}/src/hooks/useInteractionLifetime.js`, 'utf8'), {
    exports: module.exports,
    require: (name) => {
      assert.equal(name, 'react');
      return react;
    },
  });
  const render = module.exports.useInteractionLifetime;
  const isLive = render(true);
  let cleanup = pendingEffect();
  assert.equal(isLive(), true);
  cleanup();
  render(false);
  cleanup = pendingEffect();
  assert.equal(isLive(), false);
  cleanup();
  render(true);
  cleanup = pendingEffect();
  assert.equal(isLive(), true);
  cleanup();
  assert.equal(isLive(), false);
});
