import { loadGameSection } from "@lib/stats/load-game-section";
import {
  averageDeltaPercent,
  bestSessionAverage,
  foldAverages,
  formatShortDate,
  personalBestWindow,
  splitPeriods,
  trendChart,
  trendWindow,
  weekFallbackWindow,
} from "@lib/stats/sections/score-trend-window";
import type {
  SeriesBucket,
  TrendAverages,
  TrendBucket,
  TrendPersonalBest,
  TrendRangeKey,
  TrendWindow,
} from "@lib/types";
import type {
  ChartSpec,
  ScoringTrendMetrics,
  SessionResultMetrics,
} from "@modules/types";

type TrendSeriesBucket = SeriesBucket<ScoringTrendMetrics>;

type PageScope = { $data: { rangeKey: TrendRangeKey } };

type WatchesRange = {
  $watch(key: "rangeKey", callback: () => void): void;
  load(): Promise<void>;
  loadPersonalBest(): Promise<void>;
};

function fetchTrend(window: TrendWindow) {
  return loadGameSection<ScoringTrendMetrics>(
    "SCORE_TRAINING",
    "scoring-trend",
    { from: window.from, to: window.to, bucket: window.bucket, tz: window.tz },
  );
}

function fetchPersonalBest(now: Date) {
  return loadGameSection<SessionResultMetrics>(
    "SCORE_TRAINING",
    "session-result",
    personalBestWindow(now),
  );
}

function localTz(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Score Training's score-trend section: fetches `scoring-trend` on mount and
 * on every change of the page-level `rangeKey` it inherits from the statistics
 * page scope, through the IndexedDB cache, and derives the period averages,
 * deltas and chart (`2026-10-01-score-training-trend-section-design.md`).
 * Beside it, one all-time un-bucketed `session-result` request on mount only
 * yields the personal best: the highest single-session 3-dart average and
 * its date. It never re-fetches on a range change and fails independently of
 * the trend.
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
    personalBest: null as TrendPersonalBest | null,
    personalBestLoading: true,

    get period(): TrendRangeKey {
      return (this as unknown as PageScope).$data.rangeKey;
    },

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      void this.load();
      void this.loadPersonalBest();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      const tz = localTz();
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

    async loadPersonalBest(now: Date = new Date()) {
      this.personalBestLoading = true;
      try {
        const series = await fetchPersonalBest(now);
        this.personalBest = bestSessionAverage(series.buckets);
      } catch {
        this.personalBest = null;
      } finally {
        this.personalBestLoading = false;
      }
    },

    get personalBestAverage(): number | null {
      return this.personalBest?.average ?? null;
    },

    get personalBestDate(): string | null {
      return this.personalBest === null
        ? null
        : formatShortDate(this.personalBest.completedAt, this.tz || localTz());
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
