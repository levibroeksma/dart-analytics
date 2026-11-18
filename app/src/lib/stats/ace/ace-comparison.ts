import { tallyDoublesTraining } from "@lib/stats/doubles/doubles-training-rows";
import type {
  AceComparison,
  DoublesTrainingInput,
  DoublesTrainingRow,
  DriftDirection,
  Ratio,
} from "@lib/types";

type Totals = {
  darts: number;
  hits: number;
  nearMiss: number;
  loose: number;
  directions: Record<DriftDirection, number>;
};

const DIRECTIONS: readonly DriftDirection[] = ["Left", "Right", "High", "Low"];

function totalsOf(rows: readonly DoublesTrainingRow[]): Totals {
  const sum = (pick: (row: DoublesTrainingRow) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);
  return {
    darts: sum((row) => row.darts),
    hits: sum((row) => row.hits),
    nearMiss: sum((row) => row.nearMiss),
    loose: sum((row) => row.loose),
    directions: {
      Left: sum((row) => row.left),
      Right: sum((row) => row.right),
      High: sum((row) => row.high),
      Low: sum((row) => row.low),
    },
  };
}

function directionalMisses(totals: Totals): number {
  return DIRECTIONS.reduce((sum, d) => sum + totals.directions[d], 0);
}

function largestDirection(totals: Totals): DriftDirection | null {
  if (directionalMisses(totals) === 0) return null;
  return DIRECTIONS.reduce((best, d) =>
    totals.directions[d] > totals.directions[best] ? d : best,
  );
}

function driftRatio(totals: Totals, direction: DriftDirection | null): Ratio {
  return {
    part: direction === null ? 0 : totals.directions[direction],
    whole: directionalMisses(totals),
  };
}

/** Target hit rate, the largest miss direction's share and the near miss share of `current` against `previous` (`null` without a preceding period), over the rows of `keys` (D563). */
export function aceComparison(
  current: DoublesTrainingInput,
  previous: DoublesTrainingInput | null,
  keys: ReadonlySet<string>,
): AceComparison {
  const now = totalsOf(tallyDoublesTraining(current, keys));
  const before =
    previous === null ? null : totalsOf(tallyDoublesTraining(previous, keys));
  const direction = largestDirection(now);
  const hitOf = (t: Totals): Ratio => ({ part: t.hits, whole: t.darts });
  const nearOf = (t: Totals): Ratio => ({
    part: t.nearMiss,
    whole: t.nearMiss + t.loose,
  });
  return {
    hit: { current: hitOf(now), previous: before && hitOf(before) },
    drift: {
      direction,
      current: driftRatio(now, direction),
      previous: before && driftRatio(before, direction),
    },
    near: { current: nearOf(now), previous: before && nearOf(before) },
  };
}
