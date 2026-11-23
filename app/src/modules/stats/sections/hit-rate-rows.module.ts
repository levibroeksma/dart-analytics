import type { CachedSeries } from "@client/types";
import type { HitRateRow, HitRateTotals } from "@modules/types";

/**
 * Client-side folds over a loaded section series: per-target hit-rate rows.
 * Pure; no I/O.
 */

/**
 * Folds every bucket's keyed metrics into one entry per key, in first-seen
 * order: a key's first metric is copied by `init`, each later one is passed
 * to `merge` with that entry. An empty map for an undefined series.
 */
export function foldSeriesByKey<M>(
  series: CachedSeries<Record<string, M>> | undefined,
  init: (m: M) => M,
  merge: (into: M, m: M) => void,
): Map<string, M> {
  const totals = new Map<string, M>();
  for (const b of series?.buckets ?? []) {
    for (const [key, m] of Object.entries(b.metrics)) {
      const existing = totals.get(key);
      if (existing) merge(existing, m);
      else totals.set(key, init(m));
    }
  }
  return totals;
}

/** Sums attempts and hits per target across every bucket; ascending by rate, stable; `[]` for an undefined series. */
export function hitRateRows(
  series: CachedSeries<Record<string, HitRateTotals>> | undefined,
): HitRateRow[] {
  if (!series) return [];

  const totals = foldSeriesByKey(
    series,
    (m) => ({ attempts: m.attempts, hits: m.hits }),
    (into, m) => {
      into.attempts += m.attempts;
      into.hits += m.hits;
    },
  );

  return Array.from(totals.entries())
    .map(([targetKey, t]) => ({
      targetKey,
      attempts: t.attempts,
      hits: t.hits,
      rate: t.attempts === 0 ? 0 : t.hits / t.attempts,
    }))
    .sort((a, b) => a.rate - b.rate);
}
