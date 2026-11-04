import { useCallback, useEffect, useRef, useState } from 'react';

import { browseServices, isServiceDiscoveryAvailable } from '../../modules/service-discovery/src';
import {
  DISCOVERY_EMPTY_AFTER_MS,
  DISCOVERY_SERVICE_TYPE,
  parseDiscoveredService,
  removeComputer,
  upsertComputer,
  type DiscoveredComputer,
} from '../services/discovery/discoveredComputers';

export type DiscoveryStatus = 'searching' | 'done';

/** Browses `_remotemouse._tcp` while mounted; `refresh` restarts the search. */
export function useComputerDiscovery(enabled = true) {
  const [computers, setComputers] = useState<DiscoveredComputer[]>([]);
  const [status, setStatus] = useState<DiscoveryStatus>('searching');
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    timer.current = setTimeout(() => setStatus('done'), DISCOVERY_EMPTY_AFTER_MS);
    const stop = browseServices(DISCOVERY_SERVICE_TYPE, {
      onFound: (service) => {
        const computer = parseDiscoveredService(service);
        if (computer) setComputers((list) => upsertComputer(list, computer));
      },
      onLost: (name) => setComputers((list) => removeComputer(list, name)),
      onError: (message) => setError(message),
    });
    return () => {
      stop();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, round]);

  const refresh = useCallback(() => {
    setComputers([]);
    setError(null);
    setStatus('searching');
    setRound((value) => value + 1);
  }, []);

  return { computers, status, error, refresh, isAvailable: isServiceDiscoveryAvailable };
}
