import { MEDIA_KEYS, type MediaKey, type MediaKeyCommand } from '../../types/protocol';

export function isMediaKey(key: unknown): key is MediaKey {
  return typeof key === 'string' && (MEDIA_KEYS as readonly string[]).includes(key);
}

/** Builds a versioned `media.key` command, or `null` for unknown keys. */
export function buildMediaKeyCommand(key: string): MediaKeyCommand | null {
  if (!isMediaKey(key)) return null;
  return { version: 1, type: 'media.key', payload: { key } };
}

export type HardwareVolumeDirection = 'up' | 'down';

/** Maps a phone hardware volume key to the computer volume key. */
export function mediaKeyForHardwareVolume(direction: string): MediaKey | null {
  if (direction === 'up') return 'volume_up';
  if (direction === 'down') return 'volume_down';
  return null;
}
