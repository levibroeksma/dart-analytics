import { fetchStatisticsOverview } from "@client/api/statistics";
import { formatStatisticsOverview } from "@lib/stats/format-statistics-overview";

/**
 * Career-wide stat cards for the Statistics page. Every field starts blank
 * so a failed or slow load leaves the page's skeleton-vs-real toggle as the
 * only visible state, never a stale or wrong number.
 *
 * Registered through `Alpine.store("stats", statsStore())`, so Alpine calls
 * `init()` once its interceptors resolve — the sanctioned hydration hook,
 * `x-init` being forbidden repo-wide.
 */
export function statsStore() {
  return {
    totalGamesPlayed: "",
    totalPlayTimeSeconds: "",
    favoriteGameTypeKey: "",
    currentPlayStreakDays: "",
    longestStreakHint: "",
    totalDartsThrown: "",
    hundredPlusCount: "",
    oneTwentyPlusCount: "",
    oneFortyPlusCount: "",
    oneEightiesCount: "",
    medianVisitScore: "",
    highestGameAverage: "",
    firstNineCareerAverage: "",
    scoringAverageExcludingDoubles: "",
    bestLegDarts: "",
    averageDartsPerLeg: "",
    doubleAccuracy: "",
    highestCheckoutValue: "",
    highestCheckoutHint: "",
    loading: false,
    error: null as string | null,

    async init() {
      await this.load();
    },

    async load() {
      this.loading = true;
      this.error = null;
      try {
        const formatted = formatStatisticsOverview(
          await fetchStatisticsOverview(),
        );
        this.totalGamesPlayed = formatted.totalGamesPlayed;
        this.totalPlayTimeSeconds = formatted.totalPlayTimeSeconds;
        this.favoriteGameTypeKey = formatted.favoriteGameTypeKey;
        this.currentPlayStreakDays = formatted.currentPlayStreakDays;
        this.longestStreakHint = formatted.longestStreakHint;
        this.totalDartsThrown = formatted.totalDartsThrown;
        this.hundredPlusCount = formatted.hundredPlusCount;
        this.oneTwentyPlusCount = formatted.oneTwentyPlusCount;
        this.oneFortyPlusCount = formatted.oneFortyPlusCount;
        this.oneEightiesCount = formatted.oneEightiesCount;
        this.medianVisitScore = formatted.medianVisitScore;
        this.highestGameAverage = formatted.highestGameAverage;
        this.firstNineCareerAverage = formatted.firstNineCareerAverage;
        this.scoringAverageExcludingDoubles =
          formatted.scoringAverageExcludingDoubles;
        this.bestLegDarts = formatted.bestLegDarts;
        this.averageDartsPerLeg = formatted.averageDartsPerLeg;
        this.doubleAccuracy = formatted.doubleAccuracy;
        this.highestCheckoutValue = formatted.highestCheckoutValue;
        this.highestCheckoutHint = formatted.highestCheckoutHint;
      } catch (cause) {
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        this.loading = false;
      }
    },
  };
}
