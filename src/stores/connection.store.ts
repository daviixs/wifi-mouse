import { create } from 'zustand';

import { webSocketClient, type SocketStatus } from '../services/websocket/WebSocketClient';
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
  connectToServer: (address: string) => void;
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
