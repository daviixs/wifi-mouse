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

  assert.equal(await loadSensitivity(storage), 3);
});

test.after(cleanupTestModules);

test('missing, empty or failed storage uses 3x without writing a migration', async () => {
  for (const stored of [null, '', '  ', 'NaN', 'Infinity']) {
    const storage = new MemoryStorage();
    if (stored !== null) storage.values.set(SENSITIVITY_STORAGE_KEY, stored);
    let writes = 0;
    storage.setItem = async () => {
      writes++;
    };
    assert.equal(await loadSensitivity(storage), 3);
    assert.equal(writes, 0);
  }
  assert.equal(
    await loadSensitivity({
      getItem: async () => {
        throw Error('offline');
      },
    }),
    3,
  );
});
test('explicit legacy preferences including the old default are never raised to the new default', async () => {
  for (const saved of [0.5, 1, 1.7, 2.4, 3, 4.6, 6]) {
    const storage = new MemoryStorage();
    await saveSensitivity(storage, saved);
    assert.equal(await loadSensitivity(storage), saved);
    assert.equal(storage.values.get(SENSITIVITY_STORAGE_KEY), String(saved));
  }
});
