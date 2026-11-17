import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { tallyDoublesTraining } from "./doubles-training-rows";
import type {
  DoublesTrainingCard,
  DoublesTrainingInput,
  DoublesTrainingRow,
} from "./types";

/** The first row, in number order, with the best hit rate among rows of at least `MIN_TARGET_SAMPLE` darts, ties to more darts. */
function favouriteOf(rows: DoublesTrainingRow[]): DoublesTrainingRow | null {
  const [best] = rows
    .filter((row) => row.darts >= MIN_TARGET_SAMPLE)
    .sort((a, b) => b.hits * a.darts - a.hits * b.darts || b.darts - a.darts);
  return best ?? null;
}

/** The Doubles Training card over the page period's `target-accuracy`, `miss-direction` and `loose-darts` buckets, joined by target key. */
export function doublesTrainingCard(
  input: DoublesTrainingInput,
): DoublesTrainingCard {
  const rows = tallyDoublesTraining(input);
  return {
    favourite: favouriteOf(rows),
    darts: rows.reduce((sum, row) => sum + row.darts, 0),
    rows,
  };
}
