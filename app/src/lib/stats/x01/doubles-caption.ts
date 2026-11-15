import type { DoubleRow } from "./types";

function pick(rows: DoubleRow[], direction: 1 | -1): DoubleRow {
  return [...rows].sort(
    (a, b) => direction * ((b.rate ?? 0) - (a.rate ?? 0)) || b.darts - a.darts,
  )[0];
}

/** "Best D16 · worst D3" among rated doubles (ties: more darts); `null` unless two doubles are rated. */
export function doublesCaption(rows: DoubleRow[]): string | null {
  const rated = rows.filter((row) => row.rate !== null);
  if (rated.length < 2) return null;
  return `Best ${pick(rated, 1).label} · worst ${pick(rated, -1).label}`;
}
