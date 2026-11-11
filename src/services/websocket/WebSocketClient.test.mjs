import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

import {
  cleanupTestModules,
  transpileTestModules,
} from '../../../scripts/transpile-test-modules.mjs';

const outputRoot = transpileTestModules([
  'src/services/websocket/serverUrl.ts',
  'src/services/keyboard/shortcuts.ts',
  'src/types/protocol.ts',
  'src/constants/config.ts',
  'src/services/websocket/WebSocketClient.ts',
]);
const { WebSocketClient } = createRequire(import.meta.url)(
  `${outputRoot}/src/services/websocket/WebSocketClient.js`,
);

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  readyState = MockWebSocket.CONNECTING;
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  sent = [];

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

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

test('sends a motion command immediately after the socket opens', () => {
  const previousWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  MockWebSocket.instances = [];

  try {
    const client = new WebSocketClient();
    client.connect('ws://127.0.0.1:8765');
    const socket = MockWebSocket.instances[0];
    socket.open();
    client.send({ version: 1, type: 'mouse.move', payload: { dx: 10, dy: -5 } });

    assert.deepEqual(socket.sent, [
      { version: 1, type: 'mouse.move', payload: { dx: 10, dy: -5 } },
    ]);
    client.disconnect();
  } finally {
    globalThis.WebSocket = previousWebSocket;
  }
});

test('preserves text and key command order while the socket is connecting', () => {
  const previousWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  MockWebSocket.instances = [];

  try {
    const client = new WebSocketClient();
    client.connect('ws://127.0.0.1:8765');
    client.send({ version: 1, type: 'keyboard.text', payload: { text: 'Olá 👋' } });
    client.send({ version: 1, type: 'keyboard.key', payload: { key: 'backspace' } });
    client.send({ version: 1, type: 'keyboard.key', payload: { key: 'enter' } });

    const socket = MockWebSocket.instances[0];
    socket.open();

    assert.deepEqual(socket.sent, [
      { version: 1, type: 'keyboard.text', payload: { text: 'Olá 👋' } },
      { version: 1, type: 'keyboard.key', payload: { key: 'backspace' } },
      { version: 1, type: 'keyboard.key', payload: { key: 'enter' } },
    ]);
    client.disconnect();
  } finally {
    globalThis.WebSocket = previousWebSocket;
  }
});

test('coalesces adjacent queued deltas while preserving click and gesture order', () => {
  const previousWebSocket = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  MockWebSocket.instances = [];

  try {
    const client = new WebSocketClient();
    client.connect('ws://127.0.0.1:8765');
    client.send({ version: 1, type: 'mouse.move', payload: { dx: 2, dy: -1 } });
    client.send({ version: 1, type: 'mouse.move', payload: { dx: 3, dy: -4 } });
    client.send({ version: 1, type: 'mouse.click', payload: { button: 'left' } });
    client.send({ version: 1, type: 'mouse.scroll', payload: { dx: -5, dy: 2 } });
    client.send({ version: 1, type: 'mouse.scroll', payload: { dx: -1, dy: 4 } });

    const socket = MockWebSocket.instances[0];
    socket.open();

    assert.deepEqual(socket.sent, [
      { version: 1, type: 'mouse.move', payload: { dx: 5, dy: -5 } },
      { version: 1, type: 'mouse.click', payload: { button: 'left' } },
      { version: 1, type: 'mouse.scroll', payload: { dx: -6, dy: 6 } },
    ]);
    client.disconnect();
  } finally {
    globalThis.WebSocket = previousWebSocket;
  }
});

test.after(cleanupTestModules);

test('server OS greeting updates platform, ignores malformed frames and detached old sockets', () => {
  const previous = globalThis.WebSocket;
  globalThis.WebSocket = MockWebSocket;
  MockWebSocket.instances = [];
  try {
    const client = new WebSocketClient(),
      platforms = [];
    client.subscribePlatform((os) => platforms.push(os));
    client.connect('ws://pc:8765');
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.onmessage({ data: 'garbage' });
    socket.onmessage({
      data: JSON.stringify({ version: 1, type: 'server.info', payload: { os: 'macos' } }),
    });
    assert.deepEqual(platforms, ['macos']);
    const oldHandler = socket.onmessage;
    client.connect('ws://other:8765');
    oldHandler({
      data: JSON.stringify({ version: 1, type: 'server.info', payload: { os: 'windows' } }),
    });
    assert.deepEqual(platforms, ['macos']);
    client.disconnect();
  } finally {
    globalThis.WebSocket = previous;
  }
});
