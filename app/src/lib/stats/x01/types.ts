import type { SeriesBucket } from "@lib/types";
import type {
  BustRateMetrics,
  CheckoutRateMetrics,
  LegStatsMetrics,
  ScoringTrendMetrics,
} from "@modules/types";

/** A bucketed series split at a period boundary. */
export type SplitPeriods<M> = {
  previous: SeriesBucket<M>[];
  current: SeriesBucket<M>[];
};

/** A count pair and its ratio; `rate` is `null` when the denominator is zero. */
export type Rate = {
  numerator: number;
  denominator: number;
  rate: number | null;
};

/** The four 501 overview reads, each split into the current and preceding period, with the names of the reads that failed. */
export type OverviewSections = {
  scoring: SplitPeriods<ScoringTrendMetrics>;
  checkout: SplitPeriods<CheckoutRateMetrics>;
  bust: SplitPeriods<BustRateMetrics>;
  legs: SplitPeriods<LegStatsMetrics>;
  hasPrevious: boolean;
  failed: string[];
};
