import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules(['src/services/discovery/discoveredComputers.ts']);
const {
  parseDiscoveredService,
  pickIpv4Address,
  parseOs,
  upsertComputer,
  removeComputer,
  withLastComputerFirst,
} = createRequire(import.meta.url)(`${outputRoot}/src/services/discovery/discoveredComputers.js`);
test.after(cleanupTestModules);

const raw = (overrides = {}) => ({
  name: 'MacBook-Carlos',
  host: 'macbook-carlos.local.',
  port: 8765,
  addresses: ['fe80::1', '192.168.0.12'],
  txt: { version: '1', os: 'macos', name: 'MacBook de Carlos' },
  ...overrides,
});

test('prefers a usable IPv4 address', () => {
  assert.equal(pickIpv4Address(['fe80::1', '127.0.0.1', '169.254.1.1', '10.0.0.5']), '10.0.0.5');
  assert.equal(pickIpv4Address(['/192.168.1.7']), '192.168.1.7');
  assert.equal(pickIpv4Address(['::ffff:192.168.1.8']), '192.168.1.8');
  assert.equal(pickIpv4Address(['fe80::1', '300.1.1.1', null]), null);
});

test('parses a resolved service using TXT records', () => {
  assert.deepEqual(parseDiscoveredService(raw()), {
    id: 'MacBook-Carlos',
    name: 'MacBook de Carlos',
    ip: '192.168.0.12',
    port: 8765,
    os: 'macos',
    version: '1',
  });
});

test('falls back to the instance name, default port and unknown OS', () => {
  const computer = parseDiscoveredService(raw({ txt: null, port: 0 }));
  assert.equal(computer.name, 'MacBook-Carlos');
  assert.equal(computer.port, 8765);
  assert.equal(computer.os, 'unknown');
  assert.equal(computer.version, null);
});

test('drops services without name or IPv4', () => {
  assert.equal(parseDiscoveredService(raw({ name: '' })), null);
  assert.equal(parseDiscoveredService(raw({ addresses: ['fe80::1'], host: 'x.local.' })), null);
  assert.equal(
    parseDiscoveredService(raw({ addresses: [], host: '192.168.0.40' })).ip,
    '192.168.0.40',
  );
});

test('parses OS names', () => {
  assert.equal(parseOs('Windows'), 'windows');
  assert.equal(parseOs('darwin'), 'macos');
  assert.equal(parseOs('linux'), 'linux');
  assert.equal(parseOs('beos'), 'unknown');
  assert.equal(parseOs(undefined), 'unknown');
});

test('dedups by instance name and by IP, sorted by name', () => {
  const a = parseDiscoveredService(raw());
  const b = parseDiscoveredService(
    raw({
      name: 'DESKTOP-1',
      addresses: ['192.168.0.20'],
      txt: { os: 'windows', name: 'Area de trabalho' },
    }),
  );
  let list = upsertComputer([], a);
  list = upsertComputer(list, b);
  list = upsertComputer(list, { ...a, ip: '192.168.0.13' });
  assert.deepEqual(
    list.map((item) => [item.id, item.ip]),
    [
      ['DESKTOP-1', '192.168.0.20'],
      ['MacBook-Carlos', '192.168.0.13'],
    ],
  );
  // Same IP under a new instance name replaces the stale entry.
  list = upsertComputer(list, { ...b, id: 'DESKTOP-1 (2)' });
  assert.equal(list.length, 2);
  assert.deepEqual(
    removeComputer(list, 'MacBook-Carlos').map((item) => item.id),
    ['DESKTOP-1 (2)'],
  );
});

test('moves the last connected computer to the top', () => {
  const list = [
    { id: 'a', name: 'A', ip: '10.0.0.1', port: 8765, os: 'linux', version: '1' },
    { id: 'b', name: 'B', ip: '10.0.0.2', port: 8765, os: 'linux', version: '1' },
  ];
  assert.deepEqual(
    withLastComputerFirst(list, { id: 'b', ip: 'x' }).map((c) => c.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    withLastComputerFirst(list, { ip: '10.0.0.2' }).map((c) => c.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    withLastComputerFirst(list, null).map((c) => c.id),
    ['a', 'b'],
  );
});

test('upsertComputer keeps the same list when a repeated resolve changes nothing', () => {
  const a = parseDiscoveredService(raw());
  const list = upsertComputer([], a);
  assert.equal(upsertComputer(list, { ...a }), list);
  assert.notEqual(upsertComputer(list, { ...a, port: 9000 }), list);
});
