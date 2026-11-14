import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';
const root = transpileTestModules([
  'src/constants/config.ts',
  'src/services/websocket/serverUrl.ts',
  'src/services/websocket/addressInput.ts',
]);
const { parseServerAddress, createServerUrl } = createRequire(import.meta.url)(
  `${root}/src/services/websocket/serverUrl.js`,
);
const { focusedAddressScrollOffset } = createRequire(import.meta.url)(
  `${root}/src/services/websocket/addressInput.js`,
);
test.after(cleanupTestModules);
test('accepts copied host:port, IPv4, DNS and legacy ws URLs without losing the port', () => {
  for (const [input, expected] of [
    ['192.168.1.10', 'ws://192.168.1.10:8765'],
    ['192.168.1.10:9000', 'ws://192.168.1.10:9000'],
    [' My-Mac.local:8765 ', 'ws://my-mac.local:8765'],
    ['ws://192.168.1.10:8080/', 'ws://192.168.1.10:8080'],
  ])
    assert.equal(createServerUrl(input), expected);
  assert.equal(parseServerAddress('192.168.1.10:8765').address, '192.168.1.10:8765');
});
test('rejects invalid ports, credentials, paths and unsupported IPv6 instead of silently rewriting them', () => {
  for (const input of [
    '',
    '999.1.1.1',
    '192.168.1.2:0',
    'pc:65536',
    'pc:',
    'pc:-2',
    'bad host:8765',
    'https://pc',
    'user@pc',
    'pc/path',
    'pc?x=1',
    'pc#x',
    '[::1]:8765',
    '-pc.local',
    'pc..local',
  ])
    assert.equal(parseServerAddress(input), null, input);
});

test('focus scroll offset uses measured input geometry and clamps at zero', () => {
  assert.equal(focusedAddressScrollOffset(70, 400, 120, 16), 574);
  assert.equal(focusedAddressScrollOffset(0, 0, 0, 16), 0);
  assert.equal(focusedAddressScrollOffset(70, 200, 120, 16), 374); // reflow changes position
  assert.equal(focusedAddressScrollOffset(NaN, 0, 0, 16), 0);
});
test('declares URL keyboard, Android resize and coherent single card surface (structural, not native rendering)', () => {
  const home = readFileSync(new URL('../../app/index.tsx', import.meta.url), 'utf8');
  const config = JSON.parse(readFileSync(new URL('../../../app.json', import.meta.url), 'utf8'));
  const card = readFileSync(new URL('../../components/ui/GlassCard.tsx', import.meta.url), 'utf8');
  assert.match(home, /keyboardType="url"/);
  assert.match(home, /behavior="padding"/);
  assert.match(home, /autoCapitalize="none"/);
  assert.match(home, /autoCorrect=\{false\}/);
  assert.equal(config.expo.android.softwareKeyboardLayoutMode, 'resize');
  assert.doesNotMatch(home, /keyboardType="decimal-pad"/);
  assert.doesNotMatch(card, /LinearGradient/);
  assert.match(card, /backgroundColor: COLORS.surface/);
});

test('Android surfaces use no elevation, no blurred boxShadow and an opaque border (structural, not native rendering)', () => {
  const tokens = readFileSync(new URL('../../theme/tokens.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(tokens, /return \{ elevation/);
  assert.match(tokens, /border: Platform\.OS === 'android' \? '#[0-9A-F]{6}'/);
  assert.match(tokens, /boxShadow: `0px \$\{offsetY\}px/);
  // Android blurred boxShadow (OutsetBoxShadowDrawable) lagged/crashed the app: flat there.
  assert.equal(tokens.match(/if \(Platform\.OS === 'android'\) return \{\};/g)?.length, 2);
  assert.doesNotMatch(tokens, /elevation:/);
});
