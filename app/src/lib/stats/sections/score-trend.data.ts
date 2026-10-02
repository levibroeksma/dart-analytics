import { loadGameSection } from "@lib/stats/load-game-section";
import {
  averageDeltaPercent,
  foldAverages,
  splitPeriods,
  trendChart,
  trendWindow,
  weekFallbackWindow,
} from "@lib/stats/sections/score-trend-window";
import type {
  SeriesBucket,
  TrendAverages,
  TrendBucket,
  TrendRangeKey,
  TrendWindow,
} from "@lib/types";
import type { ChartSpec, ScoringTrendMetrics } from "@modules/types";

type TrendSeriesBucket = SeriesBucket<ScoringTrendMetrics>;

type PageScope = { $data: { rangeKey: TrendRangeKey } };

type WatchesRange = {
  $watch(key: "rangeKey", callback: () => void): void;
  load(): Promise<void>;
};

function fetchTrend(window: TrendWindow) {
  return loadGameSection<ScoringTrendMetrics>(
    "SCORE_TRAINING",
    "scoring-trend",
    { from: window.from, to: window.to, bucket: window.bucket, tz: window.tz },
  );
}

/**
 * Score Training's score-trend section: fetches `scoring-trend` on mount and
 * on every change of the page-level `rangeKey` it inherits from the statistics
 * page scope, through the IndexedDB cache, and derives the period averages,
 * deltas and chart (`2026-10-01-score-training-trend-section-design.md`).
 */
export function scoreTrendSection() {
  let ticket = 0;
  return {
    loading: true,
    error: null as string | null,
    bucket: "day" as TrendBucket,
    tz: "",
    current: [] as TrendSeriesBucket[],
    previous: [] as TrendSeriesBucket[],
    hasPrevious: false,

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      void this.load();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        let window = trendWindow(this.period, now, tz);
        let series = await fetchTrend(window);
        const fallback =
          window.bucket === "month"
            ? weekFallbackWindow(series.buckets, now, tz)
            : null;
        if (fallback !== null) {
          window = fallback;
          series = await fetchTrend(window);
        }
        if (mine !== ticket) return;
        const periods = splitPeriods(series.buckets, window.boundary);
        this.bucket = window.bucket;
        this.tz = tz;
        this.current = periods.current;
        this.previous = periods.previous;
        this.hasPrevious = window.boundary !== null;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },

    get averages(): TrendAverages {
      return foldAverages(this.current);
    },

    get previousAverages(): TrendAverages | null {
      return this.hasPrevious ? foldAverages(this.previous) : null;
    },

    get threeDartDeltaPercent(): number | null {
      return averageDeltaPercent(
        this.averages.threeDart,
        this.previousAverages?.threeDart ?? null,
      );
    },

    get firstNineDeltaPercent(): number | null {
      return averageDeltaPercent(
        this.averages.firstNine,
        this.previousAverages?.firstNine ?? null,
      );
    },

    get isEmpty(): boolean {
      return this.averages.threeDart === null;
    },

    get chart(): ChartSpec {
      return trendChart(this.current, this.bucket, this.tz);
    },
  };
}
