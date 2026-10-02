import type {
  ChartSeries,
  ChartSpec,
  ScoringTrendMetrics,
  SessionResultMetrics,
} from "@modules/types";
import type {
  SeriesBucket,
  TrendAverages,
  TrendBucket,
  TrendPeriods,
  TrendPersonalBest,
  TrendRangeKey,
  TrendWindow,
} from "@lib/types";

type TrendSeriesBucket = SeriesBucket<ScoringTrendMetrics>;
type SessionResultBucket = SeriesBucket<SessionResultMetrics>;

export const TREND_RANGE_OPTIONS: readonly {
  value: TrendRangeKey;
  label: string;
}[] = [
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "1y", label: "Last Year" },
  { value: "all", label: "All Time" },
];

const DAY_MS = 86_400_000;
const ALL_TIME_MONTHS = 119;
const MIN_MONTH_SPAN = 4;

function daysBack(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

function monthsBack(now: Date, months: number): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

function upTo(now: Date): string {
  return new Date(now.getTime() + 60_000).toISOString();
}

/** The doubled request window per range (current + previous period), bucketed per the spec's range table. */
export function trendWindow(
  key: TrendRangeKey,
  now: Date,
  tz: string,
): TrendWindow {
  const to = upTo(now);
  switch (key) {
    case "30d":
      return {
        from: daysBack(now, 60),
        to,
        bucket: "day",
        tz,
        boundary: daysBack(now, 30),
      };
    case "90d":
      return {
        from: daysBack(now, 182),
        to,
        bucket: "week",
        tz,
        boundary: daysBack(now, 91),
      };
    case "1y":
      return {
        from: monthsBack(now, 24),
        to,
        bucket: "month",
        tz,
        boundary: monthsBack(now, 12),
      };
    case "all":
      return {
        from: monthsBack(now, ALL_TIME_MONTHS),
        to,
        bucket: "month",
        tz,
        boundary: null,
      };
  }
}

/**
 * The heatmap's request window: the score trend's *current* period only —
 * from the range's boundary (its full span for all time) up to now. Not
 * bucketed; `heatmap` is not bucketable.
 */
export function heatmapWindow(
  key: TrendRangeKey,
  now: Date,
): { from: string; to: string } {
  const to = upTo(now);
  switch (key) {
    case "30d":
      return { from: daysBack(now, 30), to };
    case "90d":
      return { from: daysBack(now, 91), to };
    case "1y":
      return { from: monthsBack(now, 12), to };
    case "all":
      return { from: monthsBack(now, ALL_TIME_MONTHS), to };
  }
}

/**
 * The personal-best request window: all time (the all-time trend request's
 * start) up to now, un-bucketed — one `session-result` row set whose
 * `bestAverage` picks the client reduces to a single maximum.
 */
export function personalBestWindow(now: Date): {
  from: string;
  to: string;
  bucket: "none";
} {
  return {
    from: monthsBack(now, ALL_TIME_MONTHS),
    to: upTo(now),
    bucket: "none",
  };
}

const SHORT_MONTHS = [
  "jan.",
  "feb.",
  "mar.",
  "apr.",
  "may",
  "jun.",
  "jul.",
  "aug.",
  "sept.",
  "oct.",
  "nov.",
  "dec.",
];

/** A session date as `30 sept. '26` in the zone: day, lowercase short month (dotted when abbreviated), two-digit year. */
export function formatShortDate(iso: string, tz: string): string {
  const { year, month, day } = zonedParts(iso, tz);
  const yy = String(year % 100).padStart(2, "0");
  return `${day} ${SHORT_MONTHS[month - 1]} '${yy}`;
}

function zonedParts(
  iso: string,
  tz: string,
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/**
 * A week window from the first month bucket with darts when the data spans
 * fewer than four calendar months in `tz`; `null` when month buckets suffice
 * or there is no data.
 */
export function weekFallbackWindow(
  buckets: readonly TrendSeriesBucket[],
  now: Date,
  tz: string,
): TrendWindow | null {
  const first = buckets.find((b) => b.metrics.darts > 0);
  if (first === undefined) return null;
  const start = zonedParts(first.start, tz);
  const end = zonedParts(now.toISOString(), tz);
  const span = end.year * 12 + end.month - (start.year * 12 + start.month) + 1;
  if (span >= MIN_MONTH_SPAN) return null;
  return {
    from: first.start,
    to: upTo(now),
    bucket: "week",
    tz,
    boundary: null,
  };
}

/** Buckets ending after `boundary` are current; with no boundary every bucket is current. */
export function splitPeriods(
  buckets: readonly TrendSeriesBucket[],
  boundary: string | null,
): TrendPeriods {
  if (boundary === null) return { previous: [], current: [...buckets] };
  const edge = Date.parse(boundary);
  return {
    previous: buckets.filter((b) => Date.parse(b.end) <= edge),
    current: buckets.filter((b) => Date.parse(b.end) > edge),
  };
}

function threeDartAverage(points: number, darts: number): number | null {
  return darts === 0 ? null : (points / darts) * 3;
}

/** 3-dart and first-nine averages from the summed additive components. */
export function foldAverages(
  buckets: readonly TrendSeriesBucket[],
): TrendAverages {
  const sum = buckets.reduce(
    (acc, b) => ({
      points: acc.points + b.metrics.points,
      darts: acc.darts + b.metrics.darts,
      firstNinePoints: acc.firstNinePoints + b.metrics.firstNinePoints,
      firstNineDarts: acc.firstNineDarts + b.metrics.firstNineDarts,
    }),
    { points: 0, darts: 0, firstNinePoints: 0, firstNineDarts: 0 },
  );
  return {
    threeDart: threeDartAverage(sum.points, sum.darts),
    firstNine: threeDartAverage(sum.firstNinePoints, sum.firstNineDarts),
  };
}

/**
 * The highest per-session 3-dart average across every `session-result`
 * bucket and ruleset slice, with that session's date; `null` when no slice
 * carries a `bestAverage`. A max of per-slice maxima is exact, so the
 * buckets can be read in any order.
 */
export function bestSessionAverage(
  buckets: readonly SessionResultBucket[],
): TrendPersonalBest | null {
  let best: TrendPersonalBest | null = null;
  for (const bucket of buckets) {
    for (const slice of Object.values(bucket.metrics)) {
      const candidate = slice.bestAverage;
      if (candidate === null) continue;
      const average = threeDartAverage(candidate.points, candidate.darts);
      if (average === null) continue;
      if (best === null || average > best.average) {
        best = { average, completedAt: candidate.completedAt };
      }
    }
  }
  return best;
}

/** Change from `previous` to `current` as a percent of `previous`; `null` when either is missing or `previous` is zero. */
export function averageDeltaPercent(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function isoWeek(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / DAY_MS -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

/** Axis label for a bucket start in `tz`: `3 Sep`, `w36`, or `Sep 26`. */
export function bucketLabel(
  start: string,
  bucket: TrendBucket,
  tz: string,
  locale?: string,
): string {
  if (bucket === "week") {
    const { year, month, day } = zonedParts(start, tz);
    return `w${isoWeek(year, month, day)}`;
  }
  const options: Intl.DateTimeFormatOptions =
    bucket === "day"
      ? { day: "numeric", month: "short", timeZone: tz }
      : { month: "short", year: "2-digit", timeZone: tz };
  return new Date(start).toLocaleDateString(locale, options);
}

/** Line chart of the 3-dart and first-nine averages per bucket, skipping buckets with no darts. */
export function trendChart(
  buckets: readonly TrendSeriesBucket[],
  bucket: TrendBucket,
  tz: string,
  locale?: string,
): ChartSpec {
  const thrown = buckets.filter((b) => b.metrics.darts > 0);
  const firstNine = thrown.map((b) =>
    threeDartAverage(b.metrics.firstNinePoints, b.metrics.firstNineDarts),
  );
  const series: ChartSeries[] = [
    {
      key: "three-dart-average",
      label: "3-dart average",
      data: thrown.map((b) =>
        threeDartAverage(b.metrics.points, b.metrics.darts),
      ),
      color: "sky",
    },
  ];
  if (firstNine.some((value) => value !== null)) {
    series.push({
      key: "first-nine-average",
      label: "First nine",
      data: firstNine,
      color: "orange",
    });
  }
  return {
    kind: "line",
    labels: thrown.map((b) => bucketLabel(b.start, bucket, tz, locale)),
    series,
    ariaLabel: "3-dart average trend",
  };
}
