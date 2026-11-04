import { create } from 'zustand';

import { webSocketClient, type SocketStatus } from '../services/websocket/WebSocketClient';
import {
  waitForConnectionOutcome,
  type ConnectionOutcome,
} from '../services/websocket/connectionAttempt';
import { createServerUrl } from '../services/websocket/serverUrl';
import type { MouseCommand } from '../types/protocol';

export type ConnectionState = {
  connected: boolean;
  deviceId: string | null;
  deviceName: string | null;
  serverUrl: string | null;
  status: SocketStatus;
  error: string | null;
};

type ConnectionActions = {
  /** Starts a connection and resolves only after the socket opens, fails or is cancelled. */
  connectToServer: (address: string) => Promise<ConnectionOutcome>;
  /** Aborts an in-flight attempt (or a session) and clears any error. */
  cancelConnection: () => void;
  clearError: () => void;
  disconnect: () => void;
  sendCommand: (command: MouseCommand) => void;
};

export const useConnectionStore = create<ConnectionState & ConnectionActions>((set, get) => ({
  connected: false,
  deviceId: null,
  deviceName: null,
  serverUrl: null,
  status: 'disconnected',
  error: null,

  connectToServer: (address) => {
    webSocketClient.disconnect();
    const serverUrl = createServerUrl(address);
    set({
      connected: false,
      deviceId: address,
      deviceName: address,
      serverUrl,
      status: 'connecting',
      error: null,
    });
    webSocketClient.connect(serverUrl);
    return waitForConnectionOutcome(webSocketClient);
  },

  cancelConnection: () => {
    get().disconnect();
  },

  clearError: () => {
    if (get().status === 'error') set({ status: 'disconnected', error: null });
    else set({ error: null });
  },

  disconnect: () => {
    webSocketClient.disconnect();
    set({
      connected: false,
      deviceId: null,
      deviceName: null,
      serverUrl: null,
      status: 'disconnected',
      error: null,
    });
  },

  sendCommand: (command) => {
    if (get().connected) webSocketClient.send(command);
  },
}));

webSocketClient.subscribe((status, error) => {
  useConnectionStore.setState({
    status,
    connected: status === 'connected',
    error: error ?? null,
  });
});
