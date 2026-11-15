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

/** Summed aim-section rows: row key to field counts. */
export type AimRows = Record<string, Record<string, number>>;

/** One treble aim's overlay row; shares are `null` under the row sample floor. */
export type TrebleRow = {
  aim: "TREBLE:20" | "TREBLE:19" | "TREBLE:18";
  darts: number;
  treble: number | null;
  single: number | null;
  left: number | null;
  right: number | null;
  other: number | null;
};

/** The treble accuracy card: T20 hit share as headline, the three trebles as overlay rows. */
export type TrebleCard = {
  headline: number | null;
  darts: number;
  rows: TrebleRow[];
  ambiguous: number;
};
