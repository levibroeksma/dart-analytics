import type { SeriesBucket } from "@lib/types";
import type { AimCountMetrics } from "@modules/types";
import type { AimRows } from "./types";

/** Field-wise sum of every bucket's rows. */
export function sumAimRows(
  buckets: readonly SeriesBucket<AimCountMetrics>[],
): AimRows {
  const total: AimRows = {};
  for (const bucket of buckets)
    for (const [key, fields] of Object.entries(bucket.metrics)) {
      const row = (total[key] ??= {});
      for (const [field, value] of Object.entries(fields))
        row[field] = (row[field] ?? 0) + value;
    }
  return total;
}

/** `numerator / denominator`, `null` when the denominator is zero. */
export function rateOf(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

/** Darts the section could not attribute to an aim. */
export function ambiguousDarts(rows: AimRows): number {
  return rows.AMBIGUOUS?.darts ?? 0;
}

/** Rows whose key starts with `prefix`, summed field-wise into one row. */
export function poolRows(
  rows: AimRows,
  matches: (key: string) => boolean,
): Record<string, number> {
  const pooled: Record<string, number> = {};
  for (const [key, fields] of Object.entries(rows))
    if (matches(key))
      for (const [field, value] of Object.entries(fields))
        pooled[field] = (pooled[field] ?? 0) + value;
  return pooled;
}
