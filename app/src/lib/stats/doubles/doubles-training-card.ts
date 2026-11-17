import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { rateOf } from "@lib/stats/x01/aim-rows";
import { tallyDoublesTraining } from "./doubles-training-rows";
import type {
  DoublesTrainingCard,
  DoublesTrainingInput,
  DoublesTrainingRow,
} from "./types";

function order(aim: string): number {
  return Number(aim.slice(aim.indexOf(":") + 1));
}

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
  const byAim = tallyDoublesTraining(input);
  const rows = [...byAim.values()].sort((a, b) => order(a.aim) - order(b.aim));
  for (const row of rows)
    row.rate = row.darts < MIN_ROW_SAMPLE ? null : rateOf(row.hits, row.darts);
  return {
    favourite: favouriteOf(rows),
    darts: rows.reduce((sum, row) => sum + row.darts, 0),
    rows,
  };
}
