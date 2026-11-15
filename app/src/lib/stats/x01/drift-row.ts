import { MIN_ROW_SAMPLE } from "@lib/stats/constants";
import { poolRows } from "./aim-pool";
import type { AimRows, DriftRow } from "./types";

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

export function keyOf(key: string): { basis: string; dart: string } {
  const [basis = "", , dart = ""] = key.split("|");
  return { basis, dart };
}

/** One dart number's pooled drift row, optionally limited to one basis. */
export function dartRow(rows: AimRows, dart: DriftRow["dart"], basis?: string) {
  const matches = (key: string) => {
    const k = keyOf(key);
    return (
      k.dart === String(dart) && (basis === undefined || k.basis === basis)
    );
  };
  return driftRow(dart, poolRows(rows, matches));
}

export const DARTS: DriftRow["dart"][] = [1, 2, 3];

/** Per-basis, per-dart rows with at least one sample, bases in name order. */
export function basisRows(rows: AimRows): (DriftRow & { basis: string })[] {
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
