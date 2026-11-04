import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

type EventSubscription = { remove: () => void };

export type ResolvedService = {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  txt: Record<string, string>;
};

export type DiscoveryListener = {
  onFound: (service: ResolvedService) => void;
  onLost: (name: string) => void;
  onError?: (message: string) => void;
};

type ServiceDiscoveryNativeModule = {
  start: (type: string) => void;
  stop: () => void;
  addListener(
    eventName: 'onServiceFound',
    listener: (e: ResolvedService) => void,
  ): EventSubscription;
  addListener(
    eventName: 'onServiceLost',
    listener: (e: { name: string }) => void,
  ): EventSubscription;
  addListener(eventName: 'onError', listener: (e: { message: string }) => void): EventSubscription;
};

// Absent on web and in Expo Go; browsing becomes a no-op there.
const native =
  Platform.OS === 'web'
    ? null
    : requireOptionalNativeModule<ServiceDiscoveryNativeModule>('ServiceDiscovery');

export const isServiceDiscoveryAvailable = native !== null;

/** Browses `type` (e.g. `_remotemouse._tcp`) until the returned function is called. */
export function browseServices(type: string, listener: DiscoveryListener): () => void {
  if (!native) return () => {};
  const subscriptions = [
    native.addListener('onServiceFound', listener.onFound),
    native.addListener('onServiceLost', (event) => listener.onLost(event.name)),
    native.addListener('onError', (event) => listener.onError?.(event.message)),
  ];
  native.start(type);
  return () => {
    native.stop();
    subscriptions.forEach((subscription) => subscription.remove());
  };
}
