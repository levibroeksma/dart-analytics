import { MIN_ROW_SAMPLE, MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts, poolRows } from "./aim-rows";
import { describeDrift } from "./drift-describe";
import type { AimRows, DriftCard, DriftRow } from "./types";

const DARTS: DriftRow["dart"][] = [1, 2, 3];

function variance(sumSquares: number, mean: number, n: number): number {
  return Math.max(0, sumSquares / n - mean ** 2);
}

function driftRow(dart: DriftRow["dart"], f: Record<string, number>): DriftRow {
  const n = f.n ?? 0;
  if (n < MIN_ROW_SAMPLE)
    return { dart, n, meanDx: null, meanDy: null, spread: null };
  const meanDx = f.sumDx / n;
  const meanDy = f.sumDy / n;
  const spread = Math.sqrt(
    variance(f.sumDxDx, meanDx, n) + variance(f.sumDyDy, meanDy, n),
  );
  return { dart, n, meanDx, meanDy, spread };
}

function keyOf(key: string): { basis: string; dart: string } {
  const [basis = "", , dart = ""] = key.split("|");
  return { basis, dart };
}

function dartRow(rows: AimRows, dart: DriftRow["dart"], basis?: string) {
  const matches = (key: string) => {
    const k = keyOf(key);
    return (
      k.dart === String(dart) && (basis === undefined || k.basis === basis)
    );
  };
  return driftRow(dart, poolRows(rows, matches));
}

function basisRows(rows: AimRows): (DriftRow & { basis: string })[] {
  const bases = new Set(Object.keys(rows).map((key) => keyOf(key).basis));
  bases.delete("AMBIGUOUS");
  return [...bases]
    .sort()
    .flatMap((basis) =>
      DARTS.map((dart) => ({ basis, ...dartRow(rows, dart, basis) })).filter(
        (row) => row.n > 0,
      ),
    );
}

/** The aim drift card over summed `aim-drift` rows, pooled over aim and resolution. */
export function driftCard(rows: AimRows): DriftCard {
  const byDart = DARTS.map((dart) => dartRow(rows, dart));
  const [first] = byDart;
  const sentence =
    first.meanDx === null || first.meanDy === null
      ? null
      : describeDrift(first.meanDx, first.meanDy);
  return {
    headline: first.n < MIN_TARGET_SAMPLE ? null : sentence,
    n: first.n,
    byDart,
    byBasis: basisRows(rows),
    ambiguous: ambiguousDarts(rows),
  };
}
