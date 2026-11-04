import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules(['src/services/media/volumeKeysPreference.ts']);
const { loadUseVolumeKeys, saveUseVolumeKeys, VOLUME_KEYS_STORAGE_KEY } = createRequire(
  import.meta.url,
)(`${outputRoot}/src/services/media/volumeKeysPreference.js`);
test.after(cleanupTestModules);

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: async (key) => (key in data ? data[key] : null),
    setItem: async (key, value) => {
      data[key] = value;
    },
  };
}

test('defaults to using the phone volume buttons', async () => {
  assert.equal(await loadUseVolumeKeys(memoryStorage()), true);
  assert.equal(await loadUseVolumeKeys(memoryStorage({ [VOLUME_KEYS_STORAGE_KEY]: 'x' })), true);
  const failing = { getItem: async () => Promise.reject(new Error('x')), setItem: async () => {} };
  assert.equal(await loadUseVolumeKeys(failing), true);
});

test('persists the toggle', async () => {
  const storage = memoryStorage();
  await saveUseVolumeKeys(storage, false);
  assert.equal(storage.data[VOLUME_KEYS_STORAGE_KEY], 'false');
  assert.equal(await loadUseVolumeKeys(storage), false);
});
