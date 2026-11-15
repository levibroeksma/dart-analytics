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

/** Mean landing offset and spread of one dart number, in mm; stats are `null` under the row sample floor. */
export type DriftRow = {
  dart: 1 | 2 | 3;
  n: number;
  meanDx: number | null;
  meanDy: number | null;
  spread: number | null;
};

/** The aim drift card: dart-1 drift sentence as headline, per-dart and per-basis rows as overlay. */
export type DriftCard = {
  headline: string | null;
  n: number;
  byDart: DriftRow[];
  byBasis: (DriftRow & { basis: string })[];
  ambiguous: number;
};

/** One double's overlay row: hits, misses by distance band and by direction sector (0-7). */
export type DoubleRow = {
  aim: string;
  label: string;
  darts: number;
  hits: number;
  rate: number | null;
  inside: number;
  within: number;
  outside: number;
  sectors: number[];
};

/** The doubles card: overall hit share as headline, best and worst double as caption. */
export type DoublesCard = {
  headline: number | null;
  caption: string | null;
  darts: number;
  rows: DoubleRow[];
  ambiguous: number;
};

/** One double's left-and-split overlay row. */
export type PreferenceRow = {
  finish: string;
  label: string;
  left: number;
  splitAway: number;
  splitRate: number | null;
  attempts: number;
  hits: number;
};

/** The double preference card: the double most often left and how often its leave was split away. */
export type PreferenceCard = {
  headline: string | null;
  left: number;
  rows: PreferenceRow[];
  ambiguous: number;
};

/** One setup group: a basis and aim kind. */
export type SetupGroup = {
  basis: string;
  kind: string;
  attempts: number;
  hits: number;
  rate: number | null;
};

/** The setup card: setup-dart hit share as headline, good-leave share beside it. */
export type SetupCard = {
  headline: number | null;
  attempts: number;
  goodLeave: number | null;
  visits: number;
  groups: SetupGroup[];
  ambiguous: number;
};

/** One overlay table line: a label, its sample count and the formatted cells. */
export type AimTableRow = { label: string; count: number; cells: string[] };
