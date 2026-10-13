import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_SENSITIVITY, normalizeSensitivity } from '../services/mouse/sensitivity';
import { loadSensitivity, saveSensitivity } from '../services/mouse/sensitivityPersistence';

type PreferencesState = {
  sensitivity: number;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSensitivity: (sensitivity: number) => void;
};

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  sensitivity: DEFAULT_SENSITIVITY,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const sensitivity = await loadSensitivity(AsyncStorage);
    if (!get().hydrated) set({ sensitivity, hydrated: true });
  },

  setSensitivity: (sensitivity) => {
    const normalized = normalizeSensitivity(sensitivity);
    set({ sensitivity: normalized, hydrated: true });
    void saveSensitivity(AsyncStorage, normalized);
  },
}));
