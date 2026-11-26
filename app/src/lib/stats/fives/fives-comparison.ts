import { compareMeasures } from "@lib/stats/sections/comparison-tile";
import {
  addFivesMetrics,
  emptyFivesMetrics,
} from "@modules/stats/sections/fives.module";
import type { FivesComparison, Ratio, SeriesBucket } from "@lib/types";
import type { FivesMetrics } from "@modules/types";

/** Every bucket's metrics summed into one. */
export function sumFives(
  buckets: readonly SeriesBucket<FivesMetrics>[],
): FivesMetrics {
  return buckets.reduce(
    (sum, bucket) => addFivesMetrics(sum, bucket.metrics),
    emptyFivesMetrics(),
  );
}

const MEASURES: Record<keyof FivesComparison, (m: FivesMetrics) => Ratio> = {
  wins: (m) => ({ part: m.wins, whole: m.finished }),
  scoringRate: (m) => ({ part: m.scoringVisits, whole: m.visits }),
  pointsPerVisit: (m) => ({ part: m.points, whole: m.visits }),
  visitsPerWin: (m) => ({ part: m.winVisits, whole: m.wins }),
};

/** Every Fives measure of `current` against `previous`; every `previous` is `null` with no preceding period. */
export function fivesComparison(
  current: FivesMetrics,
  previous: FivesMetrics | null,
): FivesComparison {
  return compareMeasures(MEASURES, current, previous);
}
