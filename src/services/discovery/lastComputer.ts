import { parseServerAddress } from '../websocket/serverUrl';

export const LAST_COMPUTER_STORAGE_KEY = 'remote-mouse:last-computer';

export type LastComputer = { ip: string; port?: number; name: string | null; id: string | null };

export type LastComputerStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export async function loadLastComputer(storage: LastComputerStorage): Promise<LastComputer | null> {
  try {
    const stored = await storage.getItem(LAST_COMPUTER_STORAGE_KEY);
    if (!stored) return null;
    const value = JSON.parse(stored) as Partial<LastComputer> | null;
    if (!value || typeof value.ip !== 'string') return null;
    const endpoint = parseServerAddress(
      value.port === undefined ? value.ip : `${value.ip}:${value.port}`,
    );
    if (!endpoint) return null;
    return {
      ip: endpoint.host,
      ...(value.port === undefined ? {} : { port: endpoint.port }),
      name: typeof value.name === 'string' && value.name ? value.name : null,
      id: typeof value.id === 'string' && value.id ? value.id : null,
    };
  } catch {
    return null;
  }
}

export async function saveLastComputer(storage: LastComputerStorage, computer: LastComputer) {
  try {
    await storage.setItem(LAST_COMPUTER_STORAGE_KEY, JSON.stringify(computer));
  } catch {
    // Remembering the computer is a convenience; ignore storage failures.
  }
}
