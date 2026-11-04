export const APP_CONFIG = {
  appName: 'Remote Mouse',
  agentPort: 8765,
  connectTimeoutMs: 6_000,
  reconnect: {
    initialDelayMs: 800,
    maxDelayMs: 12_000,
    maxAttempts: 0,
  },
  diagnosticsIntervalMs: 5_000,
  maxQueuedCommands: 120,
} as const;
