type VisitLike = {
  totalScore: number;
  completedAt?: string | null;
  darts?: unknown[];
};

/**
 * The visits that have actually resolved. A board session leaves the visit
 * being thrown open (`completedAt === null`) until its third dart, and a turn
 * that is still open carries a running total, not a result — folding it into a
 * completed-visit statistic reports the middle of a visit as though it were the
 * end of one. A quick-score turn is stamped complete when it is written, so
 * this filter never removes anything from a quick-score session.
 */
function completedVisits<T extends VisitLike>(turns: T[]): T[] {
  return turns.filter((turn) => turn.completedAt !== null);
}

/** The visit still being thrown, or null when the last one resolved. */
function openVisit<T extends VisitLike>(turns: T[]): T | null {
  const last = turns.at(-1);
  return last && last.completedAt === null ? last : null;
}

/**
 * Last *completed* visit score for progress StatRows, or an em dash when the
 * leg/session has none yet. Deliberately not the open visit's running total,
 * which would label the current visit as the previous one.
 */
export function previousScoreDisplay(turns: VisitLike[]): string {
  const last = completedVisits(turns).at(-1);
  return last ? String(last.totalScore) : "—";
}

/**
 * Darts thrown for display: each resolved visit's own dart rows when it has
 * any, `maxDartsPerTurn` when it has none, plus the darts actually thrown so
 * far in the visit still open. A board visit that resolves early — a checkout
 * or a bust confirmed on its first or second dart — really did cost fewer than
 * `maxDartsPerTurn`, so charging it the full visit overstates the leg. A
 * quick-score turn carries no darts of its own and still counts a full
 * `maxDartsPerTurn`, which is the original rule: the count only becomes
 * finer-grained when the session captures darts individually and the number is
 * genuinely known. The open visit is counted by its darts alone — it has not
 * resolved, so the fallback must not apply to it.
 */
export function dartsThrownCount(
  turns: VisitLike[],
  maxDartsPerTurn: number,
): number {
  const open = openVisit(turns);
  const completed = completedVisits(turns).reduce(
    (sum, turn) =>
      sum + (turn.darts?.length ? turn.darts.length : maxDartsPerTurn),
    0,
  );
  return completed + (open?.darts?.length ?? 0);
}

/**
 * Per-visit average as a one-decimal display string. Used by Score Training's
 * `threeDartAverage()` (full visits make this equal to 3-dart average).
 */
export function perVisitAverageDisplay(turns: VisitLike[]): string {
  const completed = completedVisits(turns);
  if (completed.length === 0) return "0.0";
  const total = completed.reduce((sum, turn) => sum + turn.totalScore, 0);
  return (total / completed.length).toFixed(1);
}

/**
 * Classic 3-dart average as a one-decimal display string, over resolved visits
 * only. An open visit contributes neither its running total nor its darts:
 * counting a 60 thrown with one dart against a whole visit's worth of darts
 * reports a third of the real average.
 */
export function threeDartAverageDisplay(
  turns: VisitLike[],
  maxDartsPerTurn: number,
): string {
  const completed = completedVisits(turns);
  const dartsThrown = completed.length * maxDartsPerTurn;
  if (dartsThrown === 0) return "0.0";
  const total = completed.reduce((sum, turn) => sum + turn.totalScore, 0);
  return ((total / dartsThrown) * 3).toFixed(1);
}

/**
 * `hits`/`darts` as a percentage, formatted to exactly 2 decimal places;
 * `"0.00%"` before any dart is thrown. The single shared implementation
 * for every ruleset's hit-rate percentage (Pattern 20,
 * `04-Architecture-patterns.md`) — never reimplement with a local
 * `Math.round`/`toFixed` calculation.
 */
export function accuracyDisplay(hits: number, darts: number): string {
  if (darts === 0) return "0.00%";
  return `${((hits / darts) * 100).toFixed(2)}%`;
}

/**
 * A checkout rate for display: an em dash when no dart was ever thrown at a
 * double, since a rate over no attempts is nothing to report rather than a
 * failed one. `accuracyDisplay`'s `0.00%` stays as it is -- Bob's 27 and
 * Doubles Training count every dart as an attempt, so zero attempts there
 * means zero darts thrown, which genuinely is 0%.
 */
export function checkoutPercentageDisplay(
  hits: number,
  attempts: number,
): string {
  if (attempts === 0) return "—";
  return accuracyDisplay(hits, attempts);
}

/**
 * Average of the first 3 completed visits' totals, one-decimal display
 * string — the classic "first 9" darts stat. Fewer than 3 completed visits
 * averages over however many exist; "0.0" before any visit completes, same
 * convention as `perVisitAverageDisplay`.
 */
export function firstNineAverageDisplay(turns: VisitLike[]): string {
  const first = completedVisits(turns).slice(0, 3);
  if (first.length === 0) return "0.0";
  const total = first.reduce((sum, turn) => sum + turn.totalScore, 0);
  return (total / first.length).toFixed(1);
}

/** Highest single completed-visit total; 0 if none completed. */
export function highestVisitScore(turns: VisitLike[]): number {
  const completed = completedVisits(turns);
  if (completed.length === 0) return 0;
  return Math.max(...completed.map((turn) => turn.totalScore));
}

/** Sum of every completed visit's total; 0 if none completed. Excludes an open visit's running score — matches `perVisitAverageDisplay`/`highestVisitScore`/`visitScoreBandCounts`'s own filter, so a results summary's `total` never contradicts its other stats. */
export function completedVisitsTotal(turns: VisitLike[]): number {
  return completedVisits(turns).reduce((sum, turn) => sum + turn.totalScore, 0);
}

/**
 * Tallies completed visits into exactly one of four score bands — whichever
 * is the *highest* threshold that visit's total meets, never more than one
 * (D238/D242, Pattern 21). A 125 counts only as `oneTwentyPlus`, not also
 * `sixtyPlus`/`hundredPlus`; a 65 counts only as `sixtyPlus`; a 180 counts
 * only as `oneEighties`, not also `oneFortyPlus`/`oneTwentyPlus`/
 * `hundredPlus`/`sixtyPlus`.
 */
export function visitScoreBandCounts(turns: VisitLike[]): {
  sixtyPlus: number;
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
} {
  const counts = {
    sixtyPlus: 0,
    hundredPlus: 0,
    oneTwentyPlus: 0,
    oneFortyPlus: 0,
    oneEighties: 0,
  };
  for (const turn of completedVisits(turns)) {
    const score = turn.totalScore;
    if (score >= 180) counts.oneEighties += 1;
    else if (score >= 140) counts.oneFortyPlus += 1;
    else if (score >= 120) counts.oneTwentyPlus += 1;
    else if (score >= 100) counts.hundredPlus += 1;
    else if (score >= 60) counts.sixtyPlus += 1;
  }
  return counts;
}

/**
 * Darts `seatRef` still has in its own open visit — the full `maxDartsPerTurn`
 * budget whenever the trailing visit is closed, belongs to another seat, or
 * does not exist, which covers every quick-score visit (a whole visit lands in
 * one call and never leaves one open).
 */
export function dartsLeftForSeat(
  turns: readonly (VisitLike & { participantRef?: string })[],
  seatRef: string,
  maxDartsPerTurn: number,
): number {
  const last = turns.at(-1);
  if (!last || last.completedAt !== null || last.participantRef !== seatRef) {
    return maxDartsPerTurn;
  }
  return maxDartsPerTurn - (last.darts?.length ?? 0);
}
