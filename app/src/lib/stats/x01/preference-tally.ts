import { aimLabel } from "./aim-label";
import { tallyRows } from "./aim-tally";
import type { AimRows, PreferenceRow } from "./types";

function blank(finish: string): PreferenceRow {
  return {
    finish,
    label: aimLabel(finish),
    left: 0,
    splitAway: 0,
    splitRate: null,
    attempts: 0,
    hits: 0,
  };
}

/** Per-double left, split-away, attempt and hit counts from `double-preference` rows. */
export function tallyPreference(rows: AimRows): PreferenceRow[] {
  return tallyRows(
    rows,
    ([finish, kind]) => (kind === undefined ? null : finish),
    blank,
    (row, [, kind], fields) => {
      if (kind === "STATE") {
        row.left += fields.left ?? 0;
        row.splitAway += fields.splitAway ?? 0;
      } else {
        row.attempts += fields.attempts ?? 0;
        row.hits += fields.hits ?? 0;
      }
    },
  );
}
