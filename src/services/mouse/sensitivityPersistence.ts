import { DEFAULT_SENSITIVITY, normalizeSensitivity } from './sensitivity';

export const SENSITIVITY_STORAGE_KEY = 'remote-mouse:sensitivity';

export type SensitivityStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export async function loadSensitivity(storage: SensitivityStorage): Promise<number> {
  try {
    const storedValue = await storage.getItem(SENSITIVITY_STORAGE_KEY);
    return storedValue === null ? DEFAULT_SENSITIVITY : normalizeSensitivity(Number(storedValue));
  } catch {
    return DEFAULT_SENSITIVITY;
  }
}

export async function saveSensitivity(
  storage: SensitivityStorage,
  sensitivity: number,
): Promise<void> {
  try {
    await storage.setItem(SENSITIVITY_STORAGE_KEY, String(normalizeSensitivity(sensitivity)));
  } catch {
    // Keep the in-memory preference if persistent storage is temporarily unavailable.
  }
}
