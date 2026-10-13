import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules(['src/services/keyboard/textDiff.ts']);
const { diffKeyboardText, splitKeyboardText } = createRequire(import.meta.url)(
  `${outputRoot}/src/services/keyboard/textDiff.js`,
);

test('returns appended text without deleting existing characters', () => {
  assert.deepEqual(diffKeyboardText('Olá', 'Olá!'), { backspaces: 0, insertedText: '!' });
});

test('rebuilds a changed suffix when a character is edited in the middle', () => {
  assert.deepEqual(diffKeyboardText('hello', 'heXlo'), {
    backspaces: 3,
    insertedText: 'Xlo',
  });
});

test('counts Unicode code points when deleting emoji', () => {
  assert.deepEqual(diffKeyboardText('Olá 👋', 'Olá '), { backspaces: 1, insertedText: '' });
});

test('splits text on Unicode boundaries while respecting JSON frame size', () => {
  assert.deepEqual(splitKeyboardText('a🙂é', 64), ['a🙂', 'é']);

  const chunks = splitKeyboardText('"'.repeat(900));
  assert.ok(chunks.length > 1);
  for (const text of chunks) {
    const command = { version: 1, type: 'keyboard.text', payload: { text } };
    assert.ok(Buffer.byteLength(JSON.stringify(command), 'utf8') <= 1024);
  }
});

test.after(cleanupTestModules);
