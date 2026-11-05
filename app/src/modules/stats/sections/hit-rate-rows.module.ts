import type { CachedSeries } from "@client/types";
import type { HitRateRow, HitRateTotals } from "@modules/types";

/**
 * Client-side folds over a loaded section series for the game stats store:
 * per-target hit-rate rows, the best/worst qualifying row, band sums keyed by
 * remaining score, and the union of metric keys. Pure; no I/O.
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

/** The row `better` prefers among those with at least `minAttempts`; ties keep the first; `null` when none qualify. */
function pickRate(
  rows: readonly HitRateRow[],
  minAttempts: number,
  better: (candidate: number, current: number) => boolean,
): HitRateRow | null {
  const qualifying = rows.filter((r) => r.attempts >= minAttempts);
  if (qualifying.length === 0) return null;
  return qualifying.reduce((kept, r) => (better(r.rate, kept.rate) ? r : kept));
}

/** The highest-rate row with at least `minAttempts`; ties keep the first; `null` when none qualify. */
export function bestRate(
  rows: readonly HitRateRow[],
  minAttempts: number,
): HitRateRow | null {
  return pickRate(
    rows,
    minAttempts,
    (candidate, current) => candidate > current,
  );
}

/** The lowest-rate row with at least `minAttempts`; ties keep the first; `null` when none qualify. */
export function worstRate(
  rows: readonly HitRateRow[],
  minAttempts: number,
): HitRateRow | null {
  return pickRate(
    rows,
    minAttempts,
    (candidate, current) => candidate < current,
  );
}

/**
 * Sums each `pick`ed field over every metric, in every bucket, whose key as a
 * number lies within `[low, high]`. The result grows to the picked width as
 * metrics are found, so it is `[]` when none fall in the band (or the series
 * is undefined) — destructure with `= 0` defaults to read zeros.
 */
export function sumInBand<M>(
  series: CachedSeries<Record<string, M>> | undefined,
  band: { low: number; high: number },
  pick: (m: M) => readonly number[],
): number[] {
  const sums: number[] = [];
  for (const b of series?.buckets ?? []) {
    for (const [key, m] of Object.entries(b.metrics)) {
      const remaining = Number(key);
      if (remaining < band.low || remaining > band.high) continue;
      pick(m).forEach((value, i) => {
        sums[i] = (sums[i] ?? 0) + value;
      });
    }
  }
  return sums;
}

/** The sorted union of metric keys across every bucket; `[]` for an undefined series. */
export function seriesKeys(
  series: CachedSeries<Record<string, unknown>> | undefined,
): string[] {
  const keys = new Set<string>();
  for (const b of series?.buckets ?? []) {
    for (const key of Object.keys(b.metrics)) keys.add(key);
  }
  return Array.from(keys).sort();
}
