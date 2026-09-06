import type { PlayerLegFactRow } from "./types";

export function bestLegDarts(rows: readonly PlayerLegFactRow[]): number | null {
  if (rows.length === 0) return null;
  return Math.min(...rows.map((row) => row.totalDartsInLeg));
}

export function averageDartsPerLeg(
  rows: readonly PlayerLegFactRow[],
): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.totalDartsInLeg, 0);
  return total / rows.length;
}
