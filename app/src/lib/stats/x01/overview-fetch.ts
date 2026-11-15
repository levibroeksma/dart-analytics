import { loadGameSection } from "@lib/stats/load-game-section";
import {
  personalBestWindow,
  trendWindow,
} from "@lib/stats/sections/score-trend-window";
import { variationParam } from "@lib/stats/variation";
import { splitByBoundary } from "./periods";
import { bestLegOf } from "./summaries";
import type { OverviewSections, SplitPeriods } from "./types";
import type { SectionId, SeriesBucket, TrendRangeKey } from "@lib/types";
import type {
  BestLeg,
  BustRateMetrics,
  CheckoutRateMetrics,
  LegStatsMetrics,
  ScoringTrendMetrics,
} from "@modules/types";

type Span = { from: string; to: string };

const SECTION_NAMES = [
  "averages",
  "checkout",
  "bust",
  "darts per leg",
] as const;

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function emptyPeriods<M>(): SplitPeriods<M> {
  return { current: [], previous: [] };
}

async function unbucketed<M>(
  id: SectionId,
  span: Span,
  tz: string,
  variation: number | undefined,
): Promise<SeriesBucket<M>[]> {
  const series = await loadGameSection<M>("501", id, {
    ...span,
    bucket: "none",
    tz,
    variation,
  });
  return series.buckets;
}

/** A server-computed section as two unbucketed reads, the current and the preceding window, so the cache chunks by month rather than by day. */
async function serverPeriods<M>(
  id: SectionId,
  current: Span,
  previous: Span | null,
  tz: string,
  variation: number | undefined,
): Promise<SplitPeriods<M>> {
  const [cur, prev] = await Promise.all([
    unbucketed<M>(id, current, tz, variation),
    previous === null ? [] : unbucketed<M>(id, previous, tz, variation),
  ]);
  return { current: cur, previous: prev };
}

function valueOf<M>(
  result: PromiseSettledResult<SplitPeriods<M>>,
): SplitPeriods<M> {
  return result.status === "fulfilled" ? result.value : emptyPeriods<M>();
}

/**
 * Reads the four 501 overview sections for `rangeKey` and `variation`:
 * `scoring-trend` as one bucketed request over the doubled `trendWindow`
 * split at its boundary, the three server-computed sections as two
 * unbucketed requests each. A rejected read is named in `failed` and left empty.
 */
export async function fetchOverviewSections(
  rangeKey: TrendRangeKey,
  selectedVariation: number,
  now: Date,
): Promise<OverviewSections> {
  const tz = localTz();
  const window = trendWindow(rangeKey, now, tz);
  const variation = variationParam("501", selectedVariation);
  const current = { from: window.boundary ?? window.from, to: window.to };
  const previous =
    window.boundary === null
      ? null
      : { from: window.from, to: window.boundary };
  const scoring = loadGameSection<ScoringTrendMetrics>("501", "scoring-trend", {
    from: window.from,
    to: window.to,
    bucket: window.bucket,
    tz,
    variation,
  }).then((series) => splitByBoundary(series.buckets, window.boundary));
  const results = await Promise.allSettled([
    scoring,
    serverPeriods<CheckoutRateMetrics>(
      "checkout-rate",
      current,
      previous,
      tz,
      variation,
    ),
    serverPeriods<BustRateMetrics>(
      "bust-rate",
      current,
      previous,
      tz,
      variation,
    ),
    serverPeriods<LegStatsMetrics>(
      "leg-stats",
      current,
      previous,
      tz,
      variation,
    ),
  ]);
  return {
    scoring: valueOf(results[0]),
    checkout: valueOf(results[1]),
    bust: valueOf(results[2]),
    legs: valueOf(results[3]),
    hasPrevious: window.boundary !== null,
    failed: SECTION_NAMES.filter((_, i) => results[i].status === "rejected"),
  };
}

/** The fewest-darts leg ever thrown for `selectedVariation`, from one all-time unbucketed `leg-stats` read; `null` with none. */
export async function fetchBestLeg(
  selectedVariation: number,
  now: Date,
): Promise<BestLeg | null> {
  const series = await loadGameSection<LegStatsMetrics>("501", "leg-stats", {
    ...personalBestWindow(now),
    variation: variationParam("501", selectedVariation),
  });
  return bestLegOf(series.buckets);
}
