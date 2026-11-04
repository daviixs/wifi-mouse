import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type EventSubscription = { remove: () => void };

export type VolumeKeyDirection = 'up' | 'down';
export type VolumeKeyEvent = { direction: VolumeKeyDirection };

type VolumeKeysNativeModule = {
  setEnabled: (enabled: boolean) => void;
  isEnabled: () => boolean;
  addListener: (
    eventName: 'onVolumeKey',
    listener: (event: VolumeKeyEvent) => void,
  ) => EventSubscription;
};

// Absent on web and in Expo Go; every API below becomes a no-op there.
const native =
  Platform.OS === 'web' ? null : requireOptionalNativeModule<VolumeKeysNativeModule>('VolumeKeys');

export const isVolumeKeysAvailable = native !== null;

/**
 * Starts forwarding the phone hardware volume keys to `listener` instead of
 * changing the phone volume. Returns a function that stops it.
 */
export function captureVolumeKeys(listener: (event: VolumeKeyEvent) => void): () => void {
  if (!native) return () => {};
  const subscription = native.addListener('onVolumeKey', listener);
  native.setEnabled(true);
  return () => {
    native.setEnabled(false);
    subscription.remove();
  };
}
