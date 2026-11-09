/** Measured offsets in the scroll content, not an assumed keyboard height. */
export function focusedAddressScrollOffset(
  main: number,
  card: number,
  input: number,
  gap: number,
): number {
  if (![main, card, input, gap].every(Number.isFinite)) return 0;
  return Math.max(0, main + card + input - gap);
}
