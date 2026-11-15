const DASH = "—";

function signed(value: number, suffix: string): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}${suffix}`;
}

/** A 0–1 ratio as a one-decimal percent; a dash for `null`. */
export function formatRate(rate: number | null): string {
  return rate === null ? DASH : `${(rate * 100).toFixed(1)}%`;
}

/** A change in percentage points with its sign; empty for `null`. */
export function formatPointDelta(points: number | null): string {
  return points === null ? "" : signed(points, " pp");
}

/** A percent change with its sign; empty for `null`. */
export function formatDelta(percent: number | null): string {
  return percent === null ? "" : signed(percent, "%");
}
