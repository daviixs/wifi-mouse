import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/types/protocol.ts',
  'src/services/keyboard/shortcuts.ts',
]);
const { buildShortcutCommand, isValidShortcut, SHORTCUT_GROUPS } = createRequire(import.meta.url)(
  `${outputRoot}/src/services/keyboard/shortcuts.js`,
);
test.after(cleanupTestModules);

test('serializes Alt+Tab as a versioned keyboard.shortcut command', () => {
  const command = buildShortcutCommand(['alt'], 'tab');
  assert.equal(
    JSON.stringify(command),
    '{"version":1,"type":"keyboard.shortcut","payload":{"modifiers":["alt"],"key":"tab"}}',
  );
});

test('serializes Alt+F4 and Esc', () => {
  assert.deepEqual(buildShortcutCommand(['alt'], 'f4').payload, { modifiers: ['alt'], key: 'f4' });
  assert.deepEqual(buildShortcutCommand([], 'escape').payload, { modifiers: [], key: 'escape' });
});

test('rejects invalid shortcuts', () => {
  assert.equal(buildShortcutCommand(['alt', 'alt'], 'tab'), null);
  assert.equal(buildShortcutCommand(['hyper'], 'tab'), null);
  assert.equal(buildShortcutCommand(['ctrl'], 'f13'), null);
  assert.equal(isValidShortcut(['ctrl', 'alt', 'shift', 'meta', 'ctrl'], 'a'), false);
});

test('every predefined option is valid and includes Alt+Tab and Alt+F4', () => {
  const options = SHORTCUT_GROUPS.flatMap((group) => group.options);
  for (const option of options) assert.ok(isValidShortcut(option.modifiers, option.key), option.id);
  assert.ok(options.some((o) => o.id === 'alt-tab'));
  assert.ok(options.some((o) => o.id === 'alt-f4'));
  assert.equal(new Set(options.map((o) => o.id)).size, options.length);
});
