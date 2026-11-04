import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/types/protocol.ts',
  'src/services/media/mediaKeys.ts',
]);
const require = createRequire(import.meta.url);
const { buildMediaKeyCommand, isMediaKey, mediaKeyForHardwareVolume } = require(
  `${outputRoot}/src/services/media/mediaKeys.js`,
);
const { MEDIA_KEYS } = require(`${outputRoot}/src/types/protocol.js`);
test.after(cleanupTestModules);

test('serializes volume up as a versioned media.key command', () => {
  assert.equal(
    JSON.stringify(buildMediaKeyCommand('volume_up')),
    '{"version":1,"type":"media.key","payload":{"key":"volume_up"}}',
  );
});

test('serializes every supported media key', () => {
  assert.deepEqual(
    [...MEDIA_KEYS],
    ['volume_up', 'volume_down', 'volume_mute', 'play_pause', 'next', 'previous', 'stop'],
  );
  for (const key of MEDIA_KEYS) {
    assert.deepEqual(JSON.parse(JSON.stringify(buildMediaKeyCommand(key))), {
      version: 1,
      type: 'media.key',
      payload: { key },
    });
  }
});

test('rejects unknown media keys', () => {
  for (const key of ['eject', 'VolumeUp', '', 'play', 'toString']) {
    assert.equal(buildMediaKeyCommand(key), null, key);
  }
  assert.equal(isMediaKey(undefined), false);
  assert.equal(isMediaKey(3), false);
});

test('maps phone hardware volume keys to computer volume keys', () => {
  assert.equal(mediaKeyForHardwareVolume('up'), 'volume_up');
  assert.equal(mediaKeyForHardwareVolume('down'), 'volume_down');
  assert.equal(mediaKeyForHardwareVolume('mute'), null);
});
