import { getDb } from "@db/client";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import { highestCheckout } from "@modules/game/highest-checkout.module";
import {
  currentPlayStreakDays,
  favoriteGameTypeKey,
  longestPlayStreakDays,
  totalGamesPlayed,
  totalPlayTimeSeconds,
} from "@modules/stats/career-summary.module";
import {
  averageDartsPerLeg,
  bestLegDarts,
} from "@modules/stats/leg-stats.module";
import { scoringAverageExcludingDoubles } from "@modules/stats/scoring-average.module";
import {
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import {
  findDoubleOutVisits,
  findLegFacts,
  findSessionSummaries,
  findVisitFacts,
} from "@repositories/statistics.repository";
import type { StatisticsOverview } from "./types";

/** Assembles the caller's career-wide stat overview from the 4 statistics views. */
export async function getStatisticsOverview(
  playerId: string,
): Promise<StatisticsOverview> {
  const db = getDb();
  const [sessions, visits, legs, doubleOutVisits] = await Promise.all([
    findSessionSummaries(db, playerId),
    findVisitFacts(db, playerId),
    findLegFacts(db, playerId),
    findDoubleOutVisits(db, playerId),
  ]);

  const bands = scoreBandCounts(visits);
  const { hits, misses } = classifyDoubleAttempts(doubleOutVisits);

  return {
    totalGamesPlayed: totalGamesPlayed(sessions),
    totalPlayTimeSeconds: totalPlayTimeSeconds(sessions),
    favoriteGameTypeKey: favoriteGameTypeKey(sessions),
    longestPlayStreakDays: longestPlayStreakDays(sessions),
    currentPlayStreakDays: currentPlayStreakDays(sessions),
    totalDartsThrown: totalDartsThrown(visits),
    hundredPlusCount: bands.hundredPlus,
    oneTwentyPlusCount: bands.oneTwentyPlus,
    oneFortyPlusCount: bands.oneFortyPlus,
    oneEightiesCount: bands.oneEighties,
    medianVisitScore: medianVisitScore(visits),
    highestGameAverage: highestGameAverage(visits),
    firstNineCareerAverage: firstNineCareerAverage(visits),
    scoringAverageExcludingDoubles: scoringAverageExcludingDoubles(
      visits,
      doubleOutVisits,
    ),
    bestLegDarts: bestLegDarts(legs),
    averageDartsPerLeg: averageDartsPerLeg(legs),
    doubleAccuracy: hits + misses === 0 ? null : hits / (hits + misses),
    highestCheckout: highestCheckout(doubleOutVisits),
  };
}
