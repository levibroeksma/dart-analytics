import type { SeriesBucket } from "@lib/types";
import type { SplitPeriods } from "./types";

/**
 * Splits buckets at `boundary`: those ending at or before it are the previous
 * period, the rest the current one. A `null` boundary (All Time) has no
 * previous period.
 */
export function splitByBoundary<M>(
  buckets: readonly SeriesBucket<M>[],
  boundary: string | null,
): SplitPeriods<M> {
  if (boundary === null) return { previous: [], current: [...buckets] };
  const edge = Date.parse(boundary);
  return {
    previous: buckets.filter((b) => Date.parse(b.end) <= edge),
    current: buckets.filter((b) => Date.parse(b.end) > edge),
  };
}
