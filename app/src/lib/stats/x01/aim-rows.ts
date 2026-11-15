import type { SeriesBucket } from "@lib/types";
import type { AimCountMetrics } from "@modules/types";
import { addFields } from "./aim-pool";
import type { AimRows } from "./types";

/** Field-wise sum of every bucket's rows. */
export function sumAimRows(
  buckets: readonly SeriesBucket<AimCountMetrics>[],
): AimRows {
  const total: AimRows = {};
  for (const bucket of buckets)
    for (const [key, fields] of Object.entries(bucket.metrics))
      addFields((total[key] ??= {}), fields);
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
