import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/services/websocket/serverUrl.ts',
  'src/constants/config.ts',
  'src/services/keyboard/shortcuts.ts',
  'src/types/protocol.ts',
  'src/services/discovery/lastComputer.ts',
]);
const { loadLastComputer, saveLastComputer, LAST_COMPUTER_STORAGE_KEY } = createRequire(
  import.meta.url,
)(`${outputRoot}/src/services/discovery/lastComputer.js`);
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

test('round-trips the last connected computer', async () => {
  const storage = memoryStorage();
  await saveLastComputer(storage, { ip: '192.168.0.12', name: 'MacBook', id: 'mac' });
  assert.deepEqual(await loadLastComputer(storage), {
    ip: '192.168.0.12',
    name: 'MacBook',
    id: 'mac',
  });
});

test('ignores missing, corrupt or invalid values', async () => {
  assert.equal(await loadLastComputer(memoryStorage()), null);
  assert.equal(await loadLastComputer(memoryStorage({ [LAST_COMPUTER_STORAGE_KEY]: '{' })), null);
  assert.equal(
    await loadLastComputer(memoryStorage({ [LAST_COMPUTER_STORAGE_KEY]: '{"ip":"bad host"}' })),
    null,
  );
  assert.deepEqual(
    await loadLastComputer(memoryStorage({ [LAST_COMPUTER_STORAGE_KEY]: '{"ip":"10.0.0.2"}' })),
    { ip: '10.0.0.2', name: null, id: null },
  );
  const failing = {
    getItem: () => Promise.reject(new Error('x')),
    setItem: () => Promise.reject(new Error('x')),
  };
  assert.equal(await loadLastComputer(failing), null);
  await saveLastComputer(failing, { ip: '10.0.0.2', name: null, id: null });
});

test('remembers a DNS hostname and custom port without reverting to 8765', async () => {
  const computer = { ip: 'my-mac.local', port: 9000, name: 'Meu Mac', id: null };
  const storage = memoryStorage();
  await saveLastComputer(storage, computer);
  assert.deepEqual(await loadLastComputer(storage), computer);
});
