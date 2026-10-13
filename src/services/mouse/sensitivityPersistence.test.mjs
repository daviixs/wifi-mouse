import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/services/mouse/sensitivity.ts',
  'src/services/mouse/sensitivityPersistence.ts',
]);
const { loadSensitivity, saveSensitivity, SENSITIVITY_STORAGE_KEY } = createRequire(
  import.meta.url,
)(`${outputRoot}/src/services/mouse/sensitivityPersistence.js`);

class MemoryStorage {
  values = new Map();

  async getItem(key) {
    return this.values.get(key) ?? null;
  }

  async setItem(key, value) {
    this.values.set(key, value);
  }
}

test('restores the saved sensitivity in a new app session', async () => {
  const storage = new MemoryStorage();
  await saveSensitivity(storage, 2.4);

  assert.equal(await loadSensitivity(storage), 2.4);
  assert.equal(storage.values.get(SENSITIVITY_STORAGE_KEY), '2.4');
});

test('uses the default when stored sensitivity is invalid', async () => {
  const storage = new MemoryStorage();
  storage.values.set(SENSITIVITY_STORAGE_KEY, 'not-a-number');

  assert.equal(await loadSensitivity(storage), 1);
});

test.after(cleanupTestModules);
