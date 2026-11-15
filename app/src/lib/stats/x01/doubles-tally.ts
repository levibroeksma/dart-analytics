import { aimLabel } from "./aim-label";
import { tallyRows } from "./aim-tally";
import type { AimRows, DoubleRow } from "./types";

const BANDS = {
  INSIDE: "inside",
  WITHIN: "within",
  OUTSIDE: "outside",
} as const;

function blank(aim: string): DoubleRow {
  return {
    aim,
    label: aimLabel(aim),
    darts: 0,
    hits: 0,
    rate: null,
    inside: 0,
    within: 0,
    outside: 0,
    sectors: Array<number>(8).fill(0),
  };
}

function order(aim: string): number {
  return aim.startsWith("DOUBLE:") ? Number(aim.slice(7)) : Infinity;
}

/** Every double (and the inner bull) of `double-accuracy` rows with hits, misses by band and sector, sorted by number with the bull last. */
export function tallyDoubles(rows: AimRows): DoubleRow[] {
  return tallyRows(
    rows,
    ([aim, , outcome]) => (outcome === undefined ? null : aim),
    blank,
    (row, [, , outcome, band, sector], fields) => {
      const darts = fields.darts ?? 0;
      row.darts += darts;
      if (outcome === "HIT") row.hits += darts;
      else {
        row[BANDS[band as keyof typeof BANDS]] += darts;
        row.sectors[Number(sector)] += darts;
      }
    },
  ).sort((a, b) => order(a.aim) - order(b.aim));
}
