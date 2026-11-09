// Absolute cursor gain: 3 remains the previous 3×, not a renumbered level.
// Existing persisted gains stay unchanged; new users get 3× with room up to 6×.
export const SENSITIVITY_MIN = 0.5;
export const SENSITIVITY_MAX = 6;
export const SENSITIVITY_STEP = 0.1;
export const DEFAULT_SENSITIVITY = 3;

export function normalizeSensitivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SENSITIVITY;
  const clamped = Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, value));
  return Math.round(clamped * 10) / 10;
}
