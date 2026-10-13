export const APP_CONFIG = {
  appName: 'Remote Mouse',
  agentPort: 8765,
  reconnect: {
    initialDelayMs: 800,
    maxDelayMs: 12_000,
    maxAttempts: 0,
  },
  commandFlushIntervalMs: 16,
  maxQueuedCommands: 120,
} as const;

export const COLORS = {
  background: '#101211',
  surface: '#191c1a',
  surfaceRaised: '#202421',
  border: '#2b302d',
  text: '#f2f4f0',
  muted: '#929b94',
  accent: '#d6fc72',
  accentDark: '#a2c94c',
  danger: '#ff7d70',
  success: '#d6fc72',
} as const;
