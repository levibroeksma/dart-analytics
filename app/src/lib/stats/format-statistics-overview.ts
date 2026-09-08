import type { StatisticsOverviewResponseData } from "@routes/types";
import type { FormattedStatisticsOverview } from "./types";

const GAME_TYPE_TITLES: Record<string, string> = {
  "501": "501",
  "121": "121",
  TUOD: "Ten Up One Down",
  SINGLES_TRAINING: "Singles training",
  SCORE_TRAINING: "Score training",
  BOBS27: "Bob's 27",
  DOUBLES_TRAINING: "Doubles training",
  SHANGHAI: "Shanghai",
  AROUND_THE_CLOCK: "Around the Clock",
};

function formatPlayTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDays(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * Turns the raw statistics overview DTO into display-ready strings for
 * StatCard. Every field is computed once per load — nothing here needs to
 * re-run reactively, so the store just copies these strings onto itself.
 */
export function formatStatisticsOverview(
  data: StatisticsOverviewResponseData,
): FormattedStatisticsOverview {
  return {
    totalGamesPlayed: String(data.totalGamesPlayed),
    totalPlayTimeSeconds: formatPlayTime(data.totalPlayTimeSeconds),
    favoriteGameTypeKey:
      GAME_TYPE_TITLES[data.favoriteGameTypeKey ?? ""] ?? "—",
    currentPlayStreakDays: formatDays(data.currentPlayStreakDays),
    longestStreakHint: `Longest: ${formatDays(data.longestPlayStreakDays)}`,
    totalDartsThrown: String(data.totalDartsThrown),
    hundredPlusCount: String(data.hundredPlusCount),
    oneTwentyPlusCount: String(data.oneTwentyPlusCount),
    oneFortyPlusCount: String(data.oneFortyPlusCount),
    oneEightiesCount: String(data.oneEightiesCount),
    medianVisitScore: data.medianVisitScore.toFixed(1),
    highestGameAverage: data.highestGameAverage.toFixed(1),
    firstNineCareerAverage: data.firstNineCareerAverage.toFixed(1),
    scoringAverageExcludingDoubles:
      data.scoringAverageExcludingDoubles.toFixed(1),
    bestLegDarts:
      data.bestLegDarts === null ? "—" : `${data.bestLegDarts} darts`,
    averageDartsPerLeg:
      data.averageDartsPerLeg === null
        ? "—"
        : data.averageDartsPerLeg.toFixed(1),
    doubleAccuracy:
      data.doubleAccuracy === null
        ? "—"
        : `${Math.round(data.doubleAccuracy * 100)}%`,
    highestCheckoutValue:
      data.highestCheckout === null ? "—" : String(data.highestCheckout.value),
    highestCheckoutHint:
      data.highestCheckout === null
        ? ""
        : `Hit ${data.highestCheckout.timesHit}×`,
  };
}
