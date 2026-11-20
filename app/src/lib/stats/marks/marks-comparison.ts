import {
  addMarksMetrics,
  emptyMarksMetrics,
} from "@modules/stats/sections/marks.module";
import type { MarksComparison, Ratio, SeriesBucket } from "@lib/types";
import type { MarksMetrics } from "@modules/types";

const ROUND = 3;

/** Every bucket's metrics summed into one, objectives by key. */
export function sumMarks(
  buckets: readonly SeriesBucket<MarksMetrics>[],
): MarksMetrics {
  return buckets.reduce(
    (sum, bucket) => addMarksMetrics(sum, bucket.metrics),
    emptyMarksMetrics(),
  );
}

const MEASURES: Record<keyof MarksComparison, (m: MarksMetrics) => Ratio> = {
  mpr: (m) => ({ part: m.marks * ROUND, whole: m.darts }),
  close: (m) => ({ part: m.closeOuts.darts, whole: m.closeOuts.games }),
  wasted: (m) => ({ part: m.wasted, whole: m.darts }),
  wins: (m) => ({ part: m.duel.wins, whole: m.duel.games }),
  ppr: (m) => ({ part: m.duel.points * ROUND, whole: m.duel.darts }),
};

/** The five Marks measures of `current` against `previous`; every `previous` is `null` with no preceding period. */
export function marksComparison(
  current: MarksMetrics,
  previous: MarksMetrics | null,
): MarksComparison {
  const measure = (read: (m: MarksMetrics) => Ratio) => ({
    current: read(current),
    previous: previous === null ? null : read(previous),
  });
  return {
    mpr: measure(MEASURES.mpr),
    close: measure(MEASURES.close),
    wasted: measure(MEASURES.wasted),
    wins: measure(MEASURES.wins),
    ppr: measure(MEASURES.ppr),
  };
}
