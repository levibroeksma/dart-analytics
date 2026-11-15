import type { SeriesBucket } from "@lib/types";

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
