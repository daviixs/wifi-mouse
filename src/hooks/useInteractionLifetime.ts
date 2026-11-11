import { useCallback, useEffect, useRef } from 'react';

/** RN-side guard for queued native callbacks. Never call this getter in a worklet/render. */
export function useInteractionLifetime(enabled: boolean): () => boolean {
  const live = useRef(false);
  useEffect(() => {
    live.current = enabled;
    return () => {
      live.current = false;
    };
  }, [enabled]);
  return useCallback(() => live.current, []);
}
