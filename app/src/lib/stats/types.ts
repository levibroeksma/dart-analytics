import type {
  BustRateMetrics,
  CheckoutPathMetrics,
  CheckoutRateMetrics,
  DoublePerformanceMetrics,
  LadderProgressMetrics,
  LegStatsMetrics,
} from "@modules/types";
import type { StatsTag } from "@lib/types";

/** Phase-1, phase-2 and phase-3 insight sections (`10-Statistics/01-Section-Catalog.md` §1). */
export type SectionId =
  | "completion"
  | "volume"
  | "session-result"
  | "heatmap"
  | "target-accuracy"
  | "confusion"
  | "grouping"
  | "miss-direction"
  | "loose-darts"
  | "scoring-trend"
  | "ladder-progress"
  | "checkout-rate"
  | "double-performance"
  | "checkout-path"
  | "bust-rate"
  | "leg-stats"
  | "treble-rate";

/** The declared-intent zones a target key can name (`01-Section-Catalog.md` §1.1). */
export type IntentZoneKey =
  | "DOUBLE"
  | "TREBLE"
  | "INNER_SINGLE"
  | "OUTER_SINGLE"
  | "INNER_BULL"
  | "OUTER_BULL";

/** `<ZONE_KEY>:<number>` — the record key for every intent-cell metric (00-Overview.md §5, phase-2 decision 5). */
export type TargetKey = `${IntentZoneKey}:${number}`;

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
  /** Optional query parameters this section accepts beyond the shared ones (phase-2 decision 5); `[]` for every section that accepts none. */
  params: readonly "target"[];
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

/** The section ids whose metrics fold checkout visits server-side (`00-Overview.md` §4, phase-3 decision 1). */
export type ServerSectionId =
  | "ladder-progress"
  | "checkout-rate"
  | "double-performance"
  | "checkout-path"
  | "bust-rate"
  | "leg-stats";

/** Each server section's own metrics shape, keyed by its id — what `mergeMetrics` (`lib/stats/merge-metrics.ts`) folds over. */
export type ServerSectionMetrics = {
  "ladder-progress": LadderProgressMetrics;
  "checkout-rate": CheckoutRateMetrics;
  "double-performance": DoublePerformanceMetrics;
  "checkout-path": CheckoutPathMetrics;
  "bust-rate": BustRateMetrics;
  "leg-stats": LegStatsMetrics;
};

/** One chunked request's span (`00-Overview.md` §4, phase-3 decision 2). */
export type ChunkWindow = { from: string; to: string };

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
