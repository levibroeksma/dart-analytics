import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, poolRows, rateOf } from "./aim-rows";
import type { AimRows, TrebleCard, TrebleRow } from "./types";

const AIMS: TrebleRow["aim"][] = ["TREBLE:20", "TREBLE:19", "TREBLE:18"];

function shares(
  fields: Record<string, number>,
  names: Record<string, string>,
  floor: number,
): Record<string, number | null> {
  const darts = fields.darts ?? 0;
  const out: Record<string, number | null> = {};
  for (const [key, field] of Object.entries(names))
    out[key] = darts < floor ? null : rateOf(fields[field] ?? 0, darts);
  return out;
}

function trebleRow(rows: AimRows, aim: TrebleRow["aim"]): TrebleRow {
  const fields = poolRows(rows, (key) => key.startsWith(`${aim}|`));
  const s = shares(
    fields,
    {
      treble: "trebles",
      single: "singles",
      left: "neighbourLeft",
      right: "neighbourRight",
      other: "other",
    },
    MIN_ROW_SAMPLE,
  );
  return {
    aim,
    darts: fields.darts ?? 0,
    treble: s.treble,
    single: s.single,
    left: s.left,
    right: s.right,
    other: s.other,
  };
}

/** The treble accuracy card over summed `large-target-accuracy` rows; both resolutions are pooled per aim. */
export function trebleCard(rows: AimRows): TrebleCard {
  const table = AIMS.map((aim) => trebleRow(rows, aim));
  const t20 = table[0];
  const headline = t20.darts < MIN_TARGET_SAMPLE ? null : t20.treble;
  return {
    headline,
    darts: t20.darts,
    rows: table,
    ambiguous: ambiguousDarts(rows),
  };
}
