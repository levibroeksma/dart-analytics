import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { tallyDoublesTraining } from "@lib/stats/doubles/doubles-training-rows";
import type {
  DoublesTrainingInput,
  DoublesTrainingRow,
  TrackGamesCard,
} from "@lib/types";

const WEAKEST_COUNT = 3;

function lowestRateFirst(a: DoublesTrainingRow, b: DoublesTrainingRow): number {
  return a.hits * b.darts - b.hits * a.darts || b.darts - a.darts;
}

function highestRateFirst(
  a: DoublesTrainingRow,
  b: DoublesTrainingRow,
): number {
  return b.hits * a.darts - a.hits * b.darts || b.darts - a.darts;
}

/** The rows of `keys` over the page period's three sections, with the best, most failed and weakest three among rows of at least `MIN_TARGET_SAMPLE` darts; ties go to more darts, then the lower number. */
export function trackGamesCard(
  input: DoublesTrainingInput,
  keys: ReadonlySet<string>,
): TrackGamesCard {
  const rows = tallyDoublesTraining(input, keys);
  const qualifying = rows.filter((row) => row.darts >= MIN_TARGET_SAMPLE);
  const weakest = [...qualifying].sort(lowestRateFirst);
  return {
    best: [...qualifying].sort(highestRateFirst)[0] ?? null,
    worst: weakest[0] ?? null,
    weakest: weakest.slice(0, WEAKEST_COUNT),
    darts: rows.reduce((sum, row) => sum + row.darts, 0),
    rows,
  };
}
