import type { SeriesBucket } from "@lib/types";
import type {
  BestLeg,
  BustRateMetrics,
  CheckoutRateMetrics,
  LegStatsMetrics,
} from "@modules/types";
import type { Rate } from "./types";

function toRate(numerator: number, denominator: number): Rate {
  return {
    numerator,
    denominator,
    rate: denominator === 0 ? null : numerator / denominator,
  };
}

/** Finished over chances, summed over every remaining-score key and bucket. */
export function checkoutRate(
  buckets: readonly SeriesBucket<CheckoutRateMetrics>[],
): Rate {
  let finished = 0;
  let chances = 0;
  for (const bucket of buckets)
    for (const row of Object.values(bucket.metrics)) {
      finished += row.finished;
      chances += row.chances;
    }
  return toRate(finished, chances);
}

/** Busts over visits, summed over every remaining-score key and bucket. */
export function bustRate(
  buckets: readonly SeriesBucket<BustRateMetrics>[],
): Rate {
  let busts = 0;
  let visits = 0;
  for (const bucket of buckets)
    for (const row of Object.values(bucket.metrics)) {
      busts += row.busts;
      visits += row.visits;
    }
  return toRate(busts, visits);
}

/** Mean darts per finished leg from the darts-per-leg histograms; `null` with no legs. */
export function dartsPerLeg(
  buckets: readonly SeriesBucket<LegStatsMetrics>[],
): number | null {
  let darts = 0;
  let legs = 0;
  for (const bucket of buckets)
    for (const [dartCount, count] of Object.entries(bucket.metrics.legs)) {
      darts += Number(dartCount) * count;
      legs += count;
    }
  return legs === 0 ? null : darts / legs;
}

/** The fewest-darts leg across buckets; the first of a tie; `null` with none. */
export function bestLegOf(
  buckets: readonly SeriesBucket<LegStatsMetrics>[],
): BestLeg | null {
  let best: BestLeg | null = null;
  for (const bucket of buckets) {
    const candidate = bucket.metrics.bestLeg;
    if (candidate !== null && (best === null || candidate.darts < best.darts))
      best = candidate;
  }
  return best;
}

/** Change in percentage points from `previous` to `current`; `null` when either rate is missing. */
export function pointDelta(
  current: Rate,
  previous: Rate | null,
): number | null {
  if (current.rate === null || previous === null || previous.rate === null)
    return null;
  return (current.rate - previous.rate) * 100;
}
