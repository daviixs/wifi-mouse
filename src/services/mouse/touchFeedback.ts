/** Each competing recognizer owns one bit; a Race loser cannot clear its winner. */
export const TOUCH_FEEDBACK = { tap: 1, longPress: 2, move: 4, scroll: 8 } as const;
export type TouchFeedbackPhase = 'begin' | 'finalize' | 'reset';
export function updateTouchFeedback(
  mask: number,
  owner: number,
  phase: TouchFeedbackPhase,
): number {
  'worklet';
  if (phase === 'reset') return 0;
  return phase === 'begin' ? mask | owner : mask & ~owner;
}
