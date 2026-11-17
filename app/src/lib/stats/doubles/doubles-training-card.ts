import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { parseTargetKey, targetLabel } from "@lib/stats/target-key";
import { rateOf } from "@lib/stats/x01/aim-rows";
import type {
  DoublesTrainingCard,
  DoublesTrainingInput,
  DoublesTrainingRow,
} from "./types";

const LEFT_SECTORS: ReadonlySet<number> = new Set([5, 6, 7]);
const RIGHT_SECTORS: ReadonlySet<number> = new Set([1, 2, 3]);
const HIGH_SECTOR = 0;
const LOW_SECTOR = 4;

function isDoubleTarget(key: string): boolean {
  const parsed = parseTargetKey(key);
  return parsed?.zone === "DOUBLE" || parsed?.zone === "INNER_BULL";
}

function order(aim: string): number {
  return aim.startsWith("DOUBLE:") ? Number(aim.slice(7)) : Infinity;
}

function blank(aim: string): DoublesTrainingRow {
  return {
    aim,
    label: targetLabel(aim),
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
}

function addMiss(
  row: DoublesTrainingRow,
  sector: number,
  radial: "INSIDE" | "WITHIN" | "OUTSIDE",
  darts: number,
): void {
  if (LEFT_SECTORS.has(sector)) row.left += darts;
  else if (RIGHT_SECTORS.has(sector)) row.right += darts;
  else if (sector === HIGH_SECTOR) row.high += darts;
  else if (sector === LOW_SECTOR) row.low += darts;
  if (radial === "INSIDE") row.inside += darts;
  else if (radial === "WITHIN") row.within += darts;
  else row.outside += darts;
}

function sumAccuracy(
  rows: Map<string, DoublesTrainingRow>,
  input: DoublesTrainingInput,
): void {
  for (const { metrics } of input.accuracy)
    for (const [key, { attempts, hits }] of Object.entries(metrics)) {
      if (!isDoubleTarget(key)) continue;
      const row = rows.get(key) ?? blank(key);
      row.darts += attempts;
      row.hits += hits;
      rows.set(key, row);
    }
}

function sumMissesAndLoose(
  rows: Map<string, DoublesTrainingRow>,
  input: DoublesTrainingInput,
): void {
  for (const { metrics } of input.misses)
    for (const [key, entries] of Object.entries(metrics)) {
      const row = rows.get(key);
      if (row === undefined) continue;
      for (const { sector, radial, darts } of entries)
        addMiss(row, sector, radial, darts);
    }
  for (const { metrics } of input.loose)
    for (const [key, counts] of Object.entries(metrics)) {
      const row = rows.get(key);
      if (row === undefined) continue;
      row.nearMiss += counts.nearMiss;
      row.loose += counts.loose;
    }
}

function favouriteOf(rows: DoublesTrainingRow[]): DoublesTrainingRow | null {
  const eligible = rows.filter(
    (row) => row.rate !== null && row.darts >= MIN_TARGET_SAMPLE,
  );
  eligible.sort(
    (a, b) =>
      (b.rate ?? 0) - (a.rate ?? 0) ||
      b.darts - a.darts ||
      order(a.aim) - order(b.aim),
  );
  return eligible[0] ?? null;
}

/** The Doubles Training card over the page period's `target-accuracy`, `miss-direction` and `loose-darts` buckets, joined by target key. */
export function doublesTrainingCard(
  input: DoublesTrainingInput,
): DoublesTrainingCard {
  const byAim = new Map<string, DoublesTrainingRow>();
  sumAccuracy(byAim, input);
  sumMissesAndLoose(byAim, input);
  const rows = [...byAim.values()]
    .filter((row) => row.darts > 0)
    .sort((a, b) => order(a.aim) - order(b.aim));
  for (const row of rows)
    row.rate = row.darts < MIN_ROW_SAMPLE ? null : rateOf(row.hits, row.darts);
  return {
    favourite: favouriteOf(rows),
    darts: rows.reduce((sum, row) => sum + row.darts, 0),
    rows,
  };
}
