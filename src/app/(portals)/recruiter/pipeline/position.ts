/** Sparse-float ordering for kanban cards: a value strictly between the new neighbours. */
export const POSITION_GAP = 1024;

export function positionBetween(prev: number | undefined, next: number | undefined): number {
  if (prev == null && next == null) return POSITION_GAP;
  if (prev == null) return next! - POSITION_GAP;
  if (next == null) return prev + POSITION_GAP;
  return prev + (next - prev) / 2;
}
