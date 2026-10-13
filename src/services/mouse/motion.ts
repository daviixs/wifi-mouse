import type { MouseCommand } from '../../types/protocol';

export type MotionKind = 'mouse.move' | 'mouse.scroll';

export function addMotionDelta(current: number, change: number): number {
  'worklet';
  return current + change;
}

export function createMotionCommand(kind: MotionKind, dx: number, dy: number): MouseCommand {
  'worklet';
  return { version: 1, type: kind, payload: { dx, dy } };
}

export function applyMotionSensitivity(
  kind: MotionKind,
  dx: number,
  dy: number,
  sensitivity: number,
): { dx: number; dy: number } {
  'worklet';
  if (kind !== 'mouse.move') return { dx, dy };
  return { dx: dx * sensitivity, dy: dy * sensitivity };
}
