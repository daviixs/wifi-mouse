import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/constants/config.ts',
  'src/services/websocket/WebSocketClient.ts',
  'src/services/websocket/connectionAttempt.ts',
]);
const require = createRequire(import.meta.url);
const { WebSocketClient, CONNECTION_ERROR_MESSAGES } = require(
  `${outputRoot}/src/services/websocket/WebSocketClient.js`,
);
const { waitForConnectionOutcome } = require(
  `${outputRoot}/src/services/websocket/connectionAttempt.js`,
);
const { APP_CONFIG } = require(`${outputRoot}/src/constants/config.js`);

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static instances = [];
  readyState = MockWebSocket.CONNECTING;
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  sent = [];
  closed = false;
  constructor(url) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send(serialized) {
    this.sent.push(JSON.parse(serialized));
  }
  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
  fail() {
    this.onerror?.();
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
  close() {
    this.closed = true;
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

function setup(t) {
  const previous = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  MockWebSocket.instances = [];
  t.after(() => {
    globalThis.WebSocket = previous;
  });
  const client = new WebSocketClient();
  t.after(() => client.disconnect());
  return client;
}

test('resolves connected only after the real open event', async (t) => {
  const client = setup(t);
  client.connect('ws://10.0.0.1:8765');
  let settled = false;
  const outcome = waitForConnectionOutcome(client).then((value) => {
    settled = true;
    return value;
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(settled, false);
  assert.equal(client.status, 'connecting');
  MockWebSocket.instances[0].open();
  assert.deepEqual(await outcome, { kind: 'connected' });
});

test('fails without reconnecting when the first attempt errors', async (t) => {
  const client = setup(t);
  client.connect('ws://10.0.0.1:8765');
  const outcome = waitForConnectionOutcome(client);
  MockWebSocket.instances[0].fail();
  assert.deepEqual(await outcome, {
    kind: 'failed',
    error: CONNECTION_ERROR_MESSAGES.initialFailure,
  });
  assert.equal(client.status, 'error');
  await new Promise((r) => setTimeout(r, APP_CONFIG.reconnect.initialDelayMs + 50));
  assert.equal(MockWebSocket.instances.length, 1, 'must not retry a never-opened connection');
});

test('fails when the socket closes before opening', async (t) => {
  const client = setup(t);
  client.connect('ws://10.0.0.1:8765');
  const outcome = waitForConnectionOutcome(client);
  MockWebSocket.instances[0].onclose();
  assert.equal((await outcome).kind, 'failed');
});

test('times out a hanging first attempt', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const client = setup(t);
  client.connect('ws://10.0.0.1:8765');
  const outcome = waitForConnectionOutcome(client);
  t.mock.timers.tick(APP_CONFIG.connectTimeoutMs);
  assert.deepEqual(await outcome, { kind: 'failed', error: CONNECTION_ERROR_MESSAGES.timeout });
  assert.equal(MockWebSocket.instances[0].onopen, null, 'socket handlers are detached');
});

test('cancelling resolves as cancelled', async (t) => {
  const client = setup(t);
  client.connect('ws://10.0.0.1:8765');
  const outcome = waitForConnectionOutcome(client);
  client.disconnect();
  assert.deepEqual(await outcome, { kind: 'cancelled' });
  assert.equal(MockWebSocket.instances[0].closed, true);
});

test('reconnects with backoff after an established session drops', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const client = setup(t);
  const statuses = [];
  client.subscribe((status) => statuses.push(status));
  client.connect('ws://10.0.0.1:8765');
  MockWebSocket.instances[0].open();
  MockWebSocket.instances[0].fail();
  assert.equal(client.status, 'reconnecting');
  t.mock.timers.tick(APP_CONFIG.reconnect.initialDelayMs);
  assert.equal(MockWebSocket.instances.length, 2);
  MockWebSocket.instances[1].open();
  assert.equal(client.status, 'connected');
  assert.ok(statuses.includes('reconnecting'));
});

test.after(cleanupTestModules);
