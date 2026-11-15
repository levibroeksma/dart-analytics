import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, poolRows, rateOf } from "./aim-rows";
import type { AimRows, TrebleCard, TrebleRow } from "./types";

const AIMS: TrebleRow["aim"][] = ["TREBLE:20", "TREBLE:19", "TREBLE:18"];

function trebleRow(rows: AimRows, aim: TrebleRow["aim"]): TrebleRow {
  const f = poolRows(rows, (key) => key.startsWith(`${aim}|`));
  const darts = f.darts ?? 0;
  const share = (field: string) =>
    darts < MIN_ROW_SAMPLE ? null : rateOf(f[field] ?? 0, darts);
  return {
    aim,
    darts,
    treble: share("trebles"),
    single: share("singles"),
    left: share("neighbourLeft"),
    right: share("neighbourRight"),
    other: share("other"),
  };
}

/** The treble accuracy card over summed `large-target-accuracy` rows; both resolutions are pooled per aim. */
export function trebleCard(rows: AimRows): TrebleCard {
  const table = AIMS.map((aim) => trebleRow(rows, aim));
  const [t20] = table;
  return {
    headline: t20.darts < MIN_TARGET_SAMPLE ? null : t20.treble,
    darts: t20.darts,
    rows: table,
    ambiguous: ambiguousDarts(rows),
  };
}
