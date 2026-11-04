import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_SENSITIVITY, normalizeSensitivity } from '../services/mouse/sensitivity';
import { loadSensitivity, saveSensitivity } from '../services/mouse/sensitivityPersistence';
import {
  DEFAULT_USE_VOLUME_KEYS,
  loadUseVolumeKeys,
  saveUseVolumeKeys,
} from '../services/media/volumeKeysPreference';

type PreferencesState = {
  sensitivity: number;
  useVolumeKeys: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSensitivity: (sensitivity: number) => void;
  setUseVolumeKeys: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  sensitivity: DEFAULT_SENSITIVITY,
  useVolumeKeys: DEFAULT_USE_VOLUME_KEYS,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const [sensitivity, useVolumeKeys] = await Promise.all([
      loadSensitivity(AsyncStorage),
      loadUseVolumeKeys(AsyncStorage),
    ]);
    if (!get().hydrated) set({ sensitivity, useVolumeKeys, hydrated: true });
  },

  setSensitivity: (sensitivity) => {
    const normalized = normalizeSensitivity(sensitivity);
    set({ sensitivity: normalized, hydrated: true });
    void saveSensitivity(AsyncStorage, normalized);
  },

  setUseVolumeKeys: (value) => {
    set({ useVolumeKeys: value, hydrated: true });
    void saveUseVolumeKeys(AsyncStorage, value);
  },
}));
