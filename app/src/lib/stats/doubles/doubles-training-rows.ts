import { MIN_ROW_SAMPLE } from "@lib/stats/constants";
import { targetLabel } from "@lib/stats/target-key";
import type { SeriesBucket } from "@lib/types";
import type { DoublesTrainingInput, DoublesTrainingRow } from "./types";

const SECTOR_FIELD = [
  "high",
  "right",
  "right",
  "right",
  "low",
  "left",
  "left",
  "left",
] as const;
const RADIAL_FIELD = {
  INSIDE: "inside",
  WITHIN: "within",
  OUTSIDE: "outside",
} as const;

const DOUBLE_KEY = /^(DOUBLE:(?:[1-9]|1\d|20)|INNER_BULL:25)$/;

const ZERO_COUNTS = {
  darts: 0,
  hits: 0,
  rate: null,
  left: 0,
  right: 0,
  high: 0,
  low: 0,
  inside: 0,
  within: 0,
  outside: 0,
  nearMiss: 0,
  loose: 0,
};

function blank(aim: string): DoublesTrainingRow {
  return { aim, label: targetLabel(aim), ...ZERO_COUNTS };
}

function foldKnownRows<M>(
  rows: Map<string, DoublesTrainingRow>,
  buckets: readonly SeriesBucket<Record<string, M>>[],
  visit: (row: DoublesTrainingRow, value: M) => void,
): void {
  for (const { metrics } of buckets)
    for (const [key, value] of Object.entries(metrics)) {
      const row = rows.get(key);
      if (row !== undefined) visit(row, value);
    }
}

function sumAccuracy(
  rows: Map<string, DoublesTrainingRow>,
  input: DoublesTrainingInput,
): void {
  for (const { metrics } of input.accuracy)
    for (const [key, { attempts, hits }] of Object.entries(metrics)) {
      if (!DOUBLE_KEY.test(key)) continue;
      const row = rows.get(key) ?? blank(key);
      row.darts += attempts;
      row.hits += hits;
      rows.set(key, row);
    }
}

function order(aim: string): number {
  return Number(aim.slice(aim.indexOf(":") + 1));
}

/** The input's three sections summed into one row per double with darts, in number order with the bull last. */
export function tallyDoublesTraining(
  input: DoublesTrainingInput,
): DoublesTrainingRow[] {
  const byAim = new Map<string, DoublesTrainingRow>();
  sumAccuracy(byAim, input);
  foldKnownRows(byAim, input.misses, (row, entries) => {
    for (const { sector, radial, darts } of entries) {
      row[SECTOR_FIELD[sector]] += darts;
      row[RADIAL_FIELD[radial]] += darts;
    }
  });
  foldKnownRows(byAim, input.loose, (row, { nearMiss, loose }) => {
    row.nearMiss += nearMiss;
    row.loose += loose;
  });
  const rows = [...byAim.values()].sort((a, b) => order(a.aim) - order(b.aim));
  for (const row of rows)
    row.rate = row.darts < MIN_ROW_SAMPLE ? null : row.hits / row.darts;
  return rows;
}
