/**
 * Last visit score for progress StatRows, or an em dash when the leg/session
 * has no turns yet.
 */
export function previousScoreDisplay(turns: { totalScore: number }[]): string {
  const last = turns.at(-1);
  return last ? String(last.totalScore) : "—";
}

/**
 * Darts thrown for display, counted as visits × max darts per turn (not
 * actual dart rows). Matches the live 501 / Score Training StatRow rule.
 */
export function dartsThrownCount(
  turnCount: number,
  maxDartsPerTurn: number,
): number {
  return turnCount * maxDartsPerTurn;
}

/**
 * Per-visit average as a one-decimal display string. Used by Score Training's
 * `threeDartAverage()` (full visits make this equal to 3-dart average).
 */
export function perVisitAverageDisplay(
  turns: { totalScore: number }[],
): string {
  if (turns.length === 0) return "0.0";
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return (total / turns.length).toFixed(1);
}

/**
 * Classic 3-dart average as a one-decimal display string, using turn×max
 * dart counting. Used by 501's `averageThisLeg()`.
 */
export function threeDartAverageDisplay(
  turns: { totalScore: number }[],
  maxDartsPerTurn: number,
): string {
  const dartsThrown = dartsThrownCount(turns.length, maxDartsPerTurn);
  if (dartsThrown === 0) return "0.0";
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return ((total / dartsThrown) * 3).toFixed(1);
}
