import { APP_CONFIG } from '../../constants/config';
import type { MouseCommand } from '../../types/protocol';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

type StatusListener = (status: SocketStatus, error?: string) => void;

export class WebSocketClient {
  private connection: WebSocket | null = null;
  private url: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = true;
  private currentStatus: SocketStatus = 'disconnected';
  private readonly listeners = new Set<StatusListener>();
  private readonly queue: MouseCommand[] = [];

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
    if (this.queue.length >= APP_CONFIG.maxQueuedCommands) this.queue.shift();
    this.queue.push(command);
    this.scheduleFlush();
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
        this.scheduleFlush();
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

  private scheduleFlush(): void {
    if (this.flushTimer || this.queue.length === 0) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, APP_CONFIG.commandFlushIntervalMs);
  }

  private flush(): void {
    if (this.connection?.readyState !== WebSocket.OPEN || this.queue.length === 0) return;
    const commands = this.queue.splice(0);
    try {
      for (const command of commands) this.connection.send(JSON.stringify(command));
    } catch {
      this.queue.unshift(...commands);
      this.connection.close();
    }
    if (this.queue.length) this.scheduleFlush();
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.reconnectTimer = null;
    this.flushTimer = null;
  }

  private setStatus(status: SocketStatus, error?: string): void {
    this.currentStatus = status;
    this.listeners.forEach((listener) => listener(status, error));
  }
}

export const webSocketClient = new WebSocketClient();
