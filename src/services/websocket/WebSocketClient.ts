import { APP_CONFIG } from '../../constants/config';
import type { MouseCommand } from '../../types/protocol';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type StatusListener = (status: SocketStatus, error?: string) => void;

export class WebSocketClient {
  private connection: WebSocket | null = null;
  private url: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = true;
  private currentStatus: SocketStatus = 'disconnected';
  private readonly listeners = new Set<StatusListener>();
  private readonly queue: MouseCommand[] = [];
  private diagnosticsStartedAt = 0;
  private diagnosticsLastSentAt = 0;
  private readonly diagnostics = {
    moves: 0,
    moveDx: 0,
    moveDy: 0,
    scrolls: 0,
    scrollDx: 0,
    scrollDy: 0,
    clicks: 0,
  };

  connect(url: string): void {
    this.disconnect();
    this.url = url;
    this.manuallyClosed = false;
    this.reconnectAttempts = 0;
    this.open();
  }

  disconnect(clearQueue = true): void {
    this.manuallyClosed = true;
    this.url = null;
    this.clearTimers();
    if (clearQueue) this.queue.length = 0;
    const connection = this.connection;
    this.connection = null;
    if (connection) {
      connection.onopen = null;
      connection.onmessage = null;
      connection.onerror = null;
      connection.onclose = null;
      connection.close();
    }
    this.setStatus('disconnected');
  }

  send(command: MouseCommand): boolean {
    if (this.manuallyClosed) return false;
    if (this.connection?.readyState === WebSocket.OPEN) {
      this.write(command, true);
      return true;
    }
    this.enqueue(command);
    return true;
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  private open(): void {
    if (!this.url || this.manuallyClosed) return;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const connection = new WebSocket(this.url);
      this.connection = connection;
      connection.onopen = () => {
        if (this.connection !== connection) return;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.flush();
      };
      connection.onerror = () => {
        if (this.connection === connection) this.setStatus('error', 'Falha na conexão WebSocket.');
      };
      connection.onclose = () => {
        if (this.connection !== connection) return;
        this.connection = null;
        this.scheduleReconnect();
      };
    } catch (error) {
      this.setStatus(
        'error',
        error instanceof Error ? error.message : 'Não foi possível conectar.',
      );
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.manuallyClosed || !this.url) return;
    const { initialDelayMs, maxDelayMs, maxAttempts } = APP_CONFIG.reconnect;
    if (maxAttempts > 0 && this.reconnectAttempts >= maxAttempts) {
      this.setStatus('error', 'Limite de tentativas de reconexão atingido.');
      return;
    }
    const delay = Math.min(initialDelayMs * 2 ** this.reconnectAttempts, maxDelayMs);
    this.reconnectAttempts += 1;
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private enqueue(command: MouseCommand): void {
    const previous = this.queue.at(-1);
    if (previous?.type === 'mouse.move' && command.type === 'mouse.move') {
      previous.payload.dx += command.payload.dx;
      previous.payload.dy += command.payload.dy;
      return;
    }
    if (previous?.type === 'mouse.scroll' && command.type === 'mouse.scroll') {
      previous.payload.dx += command.payload.dx;
      previous.payload.dy += command.payload.dy;
      return;
    }
    if (this.queue.length >= APP_CONFIG.maxQueuedCommands) this.queue.shift();
    this.queue.push(command);
  }

  private flush(): void {
    if (this.connection?.readyState !== WebSocket.OPEN || this.queue.length === 0) return;
    while (this.queue.length > 0) {
      const command = this.queue[0];
      if (!this.write(command)) return;
      this.queue.shift();
    }
  }

  private write(command: MouseCommand, enqueueOnFailure = false): boolean {
    const connection = this.connection;
    if (!connection || connection.readyState !== WebSocket.OPEN) return false;
    try {
      connection.send(JSON.stringify(command));
      this.recordSent(command);
      return true;
    } catch {
      if (enqueueOnFailure) this.enqueue(command);
      connection.close();
      return false;
    }
  }

  private recordSent(command: MouseCommand): void {
    const now = performance.now();
    if (
      this.diagnosticsStartedAt === 0 ||
      now - this.diagnosticsLastSentAt >= APP_CONFIG.diagnosticsIntervalMs
    ) {
      this.resetDiagnostics();
      this.diagnosticsStartedAt = now;
    }
    this.diagnosticsLastSentAt = now;

    switch (command.type) {
      case 'mouse.move':
        this.diagnostics.moves += 1;
        this.diagnostics.moveDx += command.payload.dx;
        this.diagnostics.moveDy += command.payload.dy;
        break;
      case 'mouse.scroll':
        this.diagnostics.scrolls += 1;
        this.diagnostics.scrollDx += command.payload.dx;
        this.diagnostics.scrollDy += command.payload.dy;
        break;
      case 'mouse.click':
        this.diagnostics.clicks += 1;
        break;
    }

    if (now - this.diagnosticsStartedAt < APP_CONFIG.diagnosticsIntervalMs) return;
    console.info('[RemoteMouse][diag][app]', {
      windowMs: Math.round(now - this.diagnosticsStartedAt),
      ...this.diagnostics,
    });
    this.diagnosticsStartedAt = now;
    this.resetDiagnostics();
  }

  private resetDiagnostics(): void {
    this.diagnostics.moves = 0;
    this.diagnostics.moveDx = 0;
    this.diagnostics.moveDy = 0;
    this.diagnostics.scrolls = 0;
    this.diagnostics.scrollDx = 0;
    this.diagnostics.scrollDy = 0;
    this.diagnostics.clicks = 0;
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private setStatus(status: SocketStatus, error?: string): void {
    this.currentStatus = status;
    this.listeners.forEach((listener) => listener(status, error));
  }
}

export const webSocketClient = new WebSocketClient();
