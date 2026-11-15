import type { AimTableRow, DriftRow } from "./types";

const DASH = "—";

function mm(value: number | null): string {
  return value === null ? DASH : `${value.toFixed(1)} mm`;
}

/** One overlay line: label, sample count and mean offsets and spread in mm. */
export function driftLine(row: DriftRow, label: string): AimTableRow {
  return {
    label,
    count: row.n,
    cells: [mm(row.meanDx), mm(row.meanDy), mm(row.spread)],
  };
}
