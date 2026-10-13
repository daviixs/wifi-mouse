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
