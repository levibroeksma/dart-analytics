import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, rateOf } from "./aim-rows";
import { sumBy } from "./aim-tally";
import { tallyPreference } from "./preference-tally";
import type { AimRows, PreferenceCard } from "./types";

/** The double preference card over summed `double-preference` rows. */
export function preferenceCard(rows: AimRows): PreferenceCard {
  const table = tallyPreference(rows);
  for (const row of table) row.splitRate = rateOf(row.splitAway, row.left);
  const left = sumBy(table, (row) => row.left);
  const [top] = [...table].sort((a, b) => b.left - a.left);
  const percent = Math.round((top?.splitRate ?? 0) * 100);
  return {
    headline:
      left < MIN_TARGET_SAMPLE
        ? null
        : `${top.label} left most · split away ${percent}%`,
    left,
    rows: table,
    ambiguous: ambiguousDarts(rows),
  };
}
