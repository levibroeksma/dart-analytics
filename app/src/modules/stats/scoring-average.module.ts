import { classifyDart } from "@modules/game/double-attempt.module";
import type { CheckoutVisitTotals } from "@modules/types";
import { effectiveDartsForVisit } from "./visit-stats.module";
import type { PlayerVisitFactRow } from "./types";

/**
 * How much of the career total, and how many of the career darts, belong to
 * double-out attempts rather than scoring.
 *
 * The score side reads the visit's *counted* total, not its darts. A visit
 * whose engine recorded 0 -- a busted 501 or 121 visit, or any failed TUOD
 * attempt -- contributed nothing to the numerator this is subtracted from,
 * which is built out of `turns.total_score`, while its darts kept their real
 * board scores. Subtracting such a dart would charge the player points no
 * total ever held. The dart still leaves the denominator: it was thrown, and
 * it was not a scoring dart.
 */
function attemptDartsTotals(visits: readonly CheckoutVisitTotals[]): {
  score: number;
  count: number;
} {
  let score = 0;
  let count = 0;
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (classifyDart(remaining, dart) !== "NOT_ATTEMPT") {
        if (visit.countedTotal !== 0) score += dart.score;
        count += 1;
      }
      remaining -= dart.score;
    }
  }
  return { score, count };
}

/**
 * Career 3-dart average, excluding darts classified as double-out attempts
 * wherever that classification is available (X01 sessions with dart-level
 * capture). Sessions or darts without that data pass through unrefined --
 * every dart counts as scoring, since there's no basis to say otherwise.
 */
export function scoringAverageExcludingDoubles(
  visitRows: readonly PlayerVisitFactRow[],
  doubleOutVisits: readonly CheckoutVisitTotals[] = [],
): number {
  const totalScore = visitRows.reduce((sum, row) => sum + row.totalScore, 0);
  const totalDarts = visitRows.reduce(
    (sum, row) => sum + effectiveDartsForVisit(row),
    0,
  );
  const attempts = attemptDartsTotals(doubleOutVisits);
  const scoringScore = totalScore - attempts.score;
  const scoringDarts = totalDarts - attempts.count;
  return scoringDarts <= 0 ? 0 : (scoringScore / scoringDarts) * 3;
}
