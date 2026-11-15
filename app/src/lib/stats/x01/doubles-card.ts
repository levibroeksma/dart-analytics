import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, rateOf } from "./aim-rows";
import { sumBy } from "./aim-tally";
import { doublesCaption } from "./doubles-caption";
import { tallyDoubles } from "./doubles-tally";
import type { AimRows, DoublesCard } from "./types";

/** The doubles card over summed `double-accuracy` rows (every double and the inner bull). */
export function doublesCard(rows: AimRows): DoublesCard {
  const table = tallyDoubles(rows);
  for (const row of table)
    row.rate = row.darts < MIN_ROW_SAMPLE ? null : rateOf(row.hits, row.darts);
  const darts = sumBy(table, (row) => row.darts);
  const hits = sumBy(table, (row) => row.hits);
  return {
    headline: darts < MIN_TARGET_SAMPLE ? null : rateOf(hits, darts),
    caption: doublesCaption(table),
    darts,
    rows: table,
    ambiguous: ambiguousDarts(rows),
  };
}
