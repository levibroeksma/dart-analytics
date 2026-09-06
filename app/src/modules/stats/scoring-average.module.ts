import { classifyDart } from "@modules/game/double-attempt.module";
import type { CheckoutVisitDarts } from "@modules/types";
import { effectiveDartsForVisit } from "./visit-stats.module";
import type { PlayerVisitFactRow } from "./types";

function attemptDartsTotals(visits: readonly CheckoutVisitDarts[]): {
  score: number;
  count: number;
} {
  let score = 0;
  let count = 0;
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (classifyDart(remaining, dart) !== "NOT_ATTEMPT") {
        score += dart.score;
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
  doubleOutVisits: readonly CheckoutVisitDarts[] = [],
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
