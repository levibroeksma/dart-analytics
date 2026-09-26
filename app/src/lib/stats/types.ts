import type { GameTypeKey, StatsTag } from "@lib/types";

/** Phase-1 insight sections (`10-Statistics/01-Section-Catalog.md` §1). */
export type SectionId = "completion" | "volume" | "session-result";

/** Where a section's numbers are computed (`00-Overview.md` §4). */
export type ComputeSite = "sql" | "server" | "client";

/** Bucket granularity for a time-series request (`00-Overview.md` §5). */
export type Bucket = "none" | "day" | "week" | "month" | "year";

/** `status` query value (`00-Overview.md` §5). */
export type StatusFilter = "completed" | "abandoned" | "all";

/** `context` query value (`00-Overview.md` §8). */
export type ContextFilter = "all" | "standalone" | "routine";

/** Whether a higher or lower `counted_score` is the better session result; `null` when the headline is not a pure function of the rule-free components (D367). */
export type ResultDirection = "higher" | "lower" | null;

/** One insight section's registry entry (`00-Overview.md` §2). */
export interface SectionMeta {
  id: SectionId;
  version: number;
  requires: readonly StatsTag[];
  computeSite: ComputeSite;
  bucketable: boolean;
  includesAbandoned: boolean;
  configSensitive: readonly string[];
}

/** One bucket of a `Series<M>` result (`00-Overview.md` §5.2). */
export interface SeriesBucket<M> {
  start: string;
  end: string;
  closed: boolean;
  sampleSize: number;
  metrics: M;
}

/** A bucketed section result (`00-Overview.md` §5.2, `range` per D367 decision 2). */
export interface Series<M> {
  sectionId: SectionId;
  sectionVersion: number;
  dataVersion: string;
  bucket: Bucket;
  tz: string | null;
  range: { from: string; to: string };
  buckets: SeriesBucket<M>[];
}

export interface FormattedStatisticsOverview {
  totalGamesPlayed: string;
  totalPlayTimeSeconds: string;
  favoriteGameTypeKey: string;
  currentPlayStreakDays: string;
  longestStreakHint: string;
  totalDartsThrown: string;
  hundredPlusCount: string;
  oneTwentyPlusCount: string;
  oneFortyPlusCount: string;
  oneEightiesCount: string;
  medianVisitScore: string;
  highestGameAverage: string;
  firstNineCareerAverage: string;
  scoringAverageExcludingDoubles: string;
  bestLegDarts: string;
  averageDartsPerLeg: string;
  checkoutPercentage: string;
  highestCheckoutValue: string;
  highestCheckoutHint: string;
}
