import type { SocketStatus } from './WebSocketClient';

type Subscribable = {
  subscribe: (listener: (status: SocketStatus, error?: string) => void) => () => void;
};

export type ConnectionOutcome =
  { kind: 'connected' } | { kind: 'failed'; error: string } | { kind: 'cancelled' };

const FALLBACK_ERROR = 'Não foi possível conectar ao computador.';

/**
 * Resolves once the initial attempt reaches a terminal state: the socket really opened,
 * the attempt failed (error, close before open, timeout) or it was cancelled/disconnected.
 * Must be called right after `connect()`, while the client reports `connecting`.
 */
export function waitForConnectionOutcome(client: Subscribable): Promise<ConnectionOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const settle = (outcome: ConnectionOutcome) => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      resolve(outcome);
    };
    unsubscribe = client.subscribe((status, error) => {
      if (status === 'connected') settle({ kind: 'connected' });
      else if (status === 'error') settle({ kind: 'failed', error: error ?? FALLBACK_ERROR });
      else if (status === 'disconnected') settle({ kind: 'cancelled' });
    });
    if (settled) unsubscribe();
  });
}
