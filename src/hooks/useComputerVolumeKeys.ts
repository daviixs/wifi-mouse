import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { captureVolumeKeys } from '../../modules/volume-keys/src';
import { buildMediaKeyCommand, mediaKeyForHardwareVolume } from '../services/media/mediaKeys';
import { useConnectionStore } from '../stores/connection.store';
import { usePreferencesStore } from '../stores/preferences.store';

/**
 * While the calling screen is focused, connected and the preference is on, the
 * phone's physical volume buttons change the COMPUTER volume instead of the
 * phone's (Android: key events are consumed; iOS: best effort, see README).
 */
export function useComputerVolumeKeys() {
  const enabled = usePreferencesStore((state) => state.useVolumeKeys);
  const isConnected = useConnectionStore((state) => state.status === 'connected');
  const sendCommand = useConnectionStore((state) => state.sendCommand);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !isConnected) return undefined;
      return captureVolumeKeys(({ direction }) => {
        const key = mediaKeyForHardwareVolume(direction);
        const command = key && buildMediaKeyCommand(key);
        if (command) sendCommand(command);
      });
    }, [enabled, isConnected, sendCommand]),
  );
}
