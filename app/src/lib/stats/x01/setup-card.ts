import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, rateOf } from "./aim-rows";
import { sumBy } from "./aim-tally";
import { tallySetup } from "./setup-tally";
import type { AimRows, SetupCard } from "./types";

/** The setup card over summed `setup-success` rows; `VISITS` carries the good-leave counts. */
export function setupCard(rows: AimRows): SetupCard {
  const groups = tallySetup(rows);
  for (const g of groups)
    g.rate = g.attempts < MIN_ROW_SAMPLE ? null : rateOf(g.hits, g.attempts);
  const attempts = sumBy(groups, (g) => g.attempts);
  const hits = sumBy(groups, (g) => g.hits);
  const visits = rows.VISITS?.visits ?? 0;
  return {
    headline: attempts < MIN_TARGET_SAMPLE ? null : rateOf(hits, attempts),
    attempts,
    goodLeave: rateOf(rows.VISITS?.goodLeaves ?? 0, visits),
    visits,
    groups,
    ambiguous: ambiguousDarts(rows),
  };
}
