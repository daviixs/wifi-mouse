export const VOLUME_KEYS_STORAGE_KEY = 'remote-mouse:use-hardware-volume-keys';
export const DEFAULT_USE_VOLUME_KEYS = true;

export type PreferenceStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export async function loadUseVolumeKeys(storage: PreferenceStorage): Promise<boolean> {
  try {
    const stored = await storage.getItem(VOLUME_KEYS_STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return DEFAULT_USE_VOLUME_KEYS;
  } catch {
    return DEFAULT_USE_VOLUME_KEYS;
  }
}

export async function saveUseVolumeKeys(storage: PreferenceStorage, value: boolean) {
  try {
    await storage.setItem(VOLUME_KEYS_STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Keep the in-memory preference if persistent storage is unavailable.
  }
}
