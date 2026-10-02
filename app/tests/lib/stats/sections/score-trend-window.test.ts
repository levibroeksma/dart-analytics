import { describe, expect, it } from "vitest";
import {
  bestSessionAverage,
  formatShortDate,
  personalBestWindow,
} from "@lib/stats/sections/score-trend-window";
import {
  TREND_RANGE_OPTIONS,
  averageDeltaPercent,
  bucketLabel,
  foldAverages,
  heatmapWindow,
  splitPeriods,
  trendChart,
  trendWindow,
  weekFallbackWindow,
} from "@lib/stats/sections/score-trend-window";

const TZ = "Europe/Amsterdam";
const NOW = new Date("2026-10-01T10:00:00.000Z");
const DAY = 86_400_000;

function bucket(
  start: string,
  end: string,
  points: number,
  darts: number,
  firstNinePoints = 0,
  firstNineDarts = 0,
) {
  return {
    start,
    end,
    closed: true,
    sampleSize: darts > 0 ? 1 : 0,
    metrics: {
      points,
      darts,
      firstNinePoints,
      firstNineDarts,
      bands: { ton: 0, tonForty: 0, oneEighty: 0 },
    },
  };
}

describe("TREND_RANGE_OPTIONS", () => {
  it("lists the four ranges in order with their labels", () => {
    expect(TREND_RANGE_OPTIONS).toEqual([
      { value: "30d", label: "Last 30 Days" },
      { value: "90d", label: "Last 90 Days" },
      { value: "1y", label: "Last Year" },
      { value: "all", label: "All Time" },
    ]);
  });
});

describe("heatmapWindow", () => {
  it("30d spans the current 30 days only, with the trend's `to`", () => {
    const w = heatmapWindow("30d", NOW);
    expect(w.from).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
    expect(w.to).toBe(new Date(NOW.getTime() + 60_000).toISOString());
  });

  it("90d starts at the trend's 91-day boundary", () => {
    expect(heatmapWindow("90d", NOW).from).toBe(
      new Date(NOW.getTime() - 91 * DAY).toISOString(),
    );
  });

  it("1y starts 12 months back", () => {
    expect(heatmapWindow("1y", NOW).from).toBe("2025-10-01T10:00:00.000Z");
  });

  it("all starts where the all-time trend request starts", () => {
    expect(heatmapWindow("all", NOW).from).toBe(
      trendWindow("all", NOW, TZ).from,
    );
  });
});

describe("trendWindow", () => {
  it("30d reads 60 days of day buckets with the boundary 30 days back", () => {
    const w = trendWindow("30d", NOW, TZ);
    expect(w.bucket).toBe("day");
    expect(w.tz).toBe(TZ);
    expect(w.from).toBe(new Date(NOW.getTime() - 60 * DAY).toISOString());
    expect(w.boundary).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
    expect(w.to).toBe(new Date(NOW.getTime() + 60_000).toISOString());
  });

  it("90d reads 26 weeks of week buckets with the boundary 13 weeks back", () => {
    const w = trendWindow("90d", NOW, TZ);
    expect(w.bucket).toBe("week");
    expect(w.from).toBe(new Date(NOW.getTime() - 182 * DAY).toISOString());
    expect(w.boundary).toBe(new Date(NOW.getTime() - 91 * DAY).toISOString());
  });

  it("1y reads 24 months of month buckets with the boundary 12 months back", () => {
    const w = trendWindow("1y", NOW, TZ);
    expect(w.bucket).toBe("month");
    expect(w.from).toBe("2024-10-01T10:00:00.000Z");
    expect(w.boundary).toBe("2025-10-01T10:00:00.000Z");
  });

  it("all reads 119 months of month buckets with no previous period", () => {
    const w = trendWindow("all", NOW, TZ);
    expect(w.bucket).toBe("month");
    expect(w.from).toBe("2016-11-01T10:00:00.000Z");
    expect(w.boundary).toBeNull();
  });
});

describe("weekFallbackWindow", () => {
  const sep = bucket(
    "2026-08-31T22:00:00.000Z",
    "2026-09-30T22:00:00.000Z",
    300,
    9,
  );
  const aug = bucket(
    "2026-07-31T22:00:00.000Z",
    "2026-08-31T22:00:00.000Z",
    300,
    9,
  );
  const jul = bucket(
    "2026-06-30T22:00:00.000Z",
    "2026-07-31T22:00:00.000Z",
    300,
    9,
  );
  const emptyMay = bucket(
    "2026-04-30T22:00:00.000Z",
    "2026-05-31T22:00:00.000Z",
    0,
    0,
  );

  it("returns null when no bucket has darts", () => {
    expect(weekFallbackWindow([emptyMay], NOW, TZ)).toBeNull();
  });

  it("returns a week window from the first data month when the span is under 4 months", () => {
    expect(weekFallbackWindow([emptyMay, aug, sep], NOW, TZ)).toEqual({
      from: aug.start,
      to: new Date(NOW.getTime() + 60_000).toISOString(),
      bucket: "week",
      tz: TZ,
      boundary: null,
    });
  });

  it("returns null when the span reaches 4 months (Jul..Oct)", () => {
    expect(weekFallbackWindow([jul, sep], NOW, TZ)).toBeNull();
  });

  it("counts span in the zone, not UTC", () => {
    expect(weekFallbackWindow([aug], NOW, TZ)).not.toBeNull();
  });
});

describe("splitPeriods", () => {
  const a = bucket(
    "2026-08-01T00:00:00.000Z",
    "2026-08-02T00:00:00.000Z",
    60,
    3,
  );
  const b = bucket(
    "2026-09-01T00:00:00.000Z",
    "2026-09-02T00:00:00.000Z",
    90,
    3,
  );

  it("puts buckets ending after the boundary in current, the rest in previous", () => {
    expect(splitPeriods([a, b], "2026-08-15T00:00:00.000Z")).toEqual({
      previous: [a],
      current: [b],
    });
  });

  it("puts every bucket in current when there is no boundary", () => {
    expect(splitPeriods([a, b], null)).toEqual({
      previous: [],
      current: [a, b],
    });
  });
});

describe("foldAverages", () => {
  it("sums the additive parts before dividing", () => {
    const buckets = [
      bucket("a", "b", 180, 3, 180, 3),
      bucket("c", "d", 60, 6, 30, 3),
    ];
    expect(foldAverages(buckets)).toEqual({ threeDart: 80, firstNine: 105 });
  });

  it("is null when there are no darts", () => {
    expect(foldAverages([bucket("a", "b", 0, 0)])).toEqual({
      threeDart: null,
      firstNine: null,
    });
    expect(foldAverages([])).toEqual({ threeDart: null, firstNine: null });
  });
});

describe("averageDeltaPercent", () => {
  it("is the change relative to previous, in percent", () => {
    expect(averageDeltaPercent(52.5, 50)).toBeCloseTo(5);
    expect(averageDeltaPercent(40, 50)).toBeCloseTo(-20);
  });

  it("is null when previous is zero", () => {
    expect(averageDeltaPercent(10, 0)).toBeNull();
  });

  it("is null when either side is null", () => {
    expect(averageDeltaPercent(null, 50)).toBeNull();
    expect(averageDeltaPercent(50, null)).toBeNull();
  });
});

describe("bucketLabel", () => {
  it("labels a day bucket as day and short month in the zone", () => {
    expect(bucketLabel("2026-09-02T22:00:00.000Z", "day", TZ, "en-GB")).toBe(
      "3 Sept",
    );
  });

  it("labels a week bucket by its ISO week number in the zone", () => {
    expect(bucketLabel("2026-08-30T22:00:00.000Z", "week", TZ, "en-GB")).toBe(
      "w36",
    );
  });

  it("labels a month bucket in the zone", () => {
    expect(bucketLabel("2026-08-31T22:00:00.000Z", "month", TZ, "en-GB")).toBe(
      "Sept 26",
    );
  });
});

describe("trendChart", () => {
  it("drops buckets with no darts and plots both averages", () => {
    const spec = trendChart(
      [
        bucket(
          "2026-09-01T22:00:00.000Z",
          "2026-09-02T22:00:00.000Z",
          150,
          9,
          150,
          9,
        ),
        bucket("2026-09-02T22:00:00.000Z", "2026-09-03T22:00:00.000Z", 0, 0),
        bucket(
          "2026-09-03T22:00:00.000Z",
          "2026-09-04T22:00:00.000Z",
          120,
          6,
          60,
          3,
        ),
      ],
      "day",
      TZ,
      "en-GB",
    );
    expect(spec.kind).toBe("line");
    expect(spec.labels).toEqual(["2 Sept", "4 Sept"]);
    expect(spec.series).toEqual([
      {
        key: "three-dart-average",
        label: "3-dart average",
        data: [50, 60],
        color: "sky",
      },
      {
        key: "first-nine-average",
        label: "First nine",
        data: [50, 60],
        color: "orange",
      },
    ]);
    expect(spec.ariaLabel).toBe("3-dart average trend");
  });

  it("omits the first-nine series when no bucket has first-nine darts", () => {
    const spec = trendChart(
      [bucket("2026-09-01T22:00:00.000Z", "2026-09-02T22:00:00.000Z", 150, 9)],
      "day",
      TZ,
      "en-GB",
    );
    expect(spec.series.map((s) => s.key)).toEqual(["three-dart-average"]);
  });
});

describe("personalBestWindow", () => {
  it("spans all time, un-bucketed, up to now", () => {
    const window = personalBestWindow(NOW);
    expect(window.from).toBe("2016-11-01T10:00:00.000Z");
    expect(window.to).toBe("2026-10-01T10:01:00.000Z");
    expect(window.bucket).toBe("none");
  });
});

describe("formatShortDate", () => {
  it("renders day, lowercase short month with a dot and a two-digit year in the zone", () => {
    expect(formatShortDate("2026-09-29T23:30:00.000Z", TZ)).toBe(
      "30 sept. '26",
    );
    expect(formatShortDate("2024-01-01T10:00:00.000Z", TZ)).toBe("1 jan. '24");
  });

  it("uses sept. for September and three letters otherwise", () => {
    expect(formatShortDate("2025-05-04T10:00:00.000Z", TZ)).toBe("4 may '25");
    expect(formatShortDate("2025-12-24T10:00:00.000Z", TZ)).toBe("24 dec. '25");
  });
});

describe("bestSessionAverage", () => {
  const best = (sessionId: string, points: number, darts: number) => ({
    sessionId,
    points,
    darts,
    completedAt: `2026-01-0${sessionId.length}T10:00:00.000Z`,
  });
  const srBucket = (
    slices: Record<string, ReturnType<typeof best> | null>,
  ) => ({
    start: "2026-01-01T00:00:00.000Z",
    end: "2026-02-01T00:00:00.000Z",
    closed: true,
    sampleSize: 1,
    metrics: Object.fromEntries(
      Object.entries(slices).map(([key, bestAverage]) => [
        key,
        {
          sessions: 1,
          countedScoreSum: 0,
          dartSum: 0,
          turnSum: 0,
          countedScoreMin: 0,
          countedScoreMax: 0,
          bestLowSessionId: "x",
          bestHighSessionId: "x",
          bestAverage,
        },
      ]),
    ),
  });

  it("picks the highest 3-dart average across buckets and ruleset slices", () => {
    const result = bestSessionAverage([
      srBucket({ ST_V1: best("a", 540, 27), ST_V2: best("bb", 300, 12) }),
      srBucket({ ST_V1: best("ccc", 1200, 60) }),
    ]);
    expect(result).toEqual({
      average: 75,
      completedAt: "2026-01-02T10:00:00.000Z",
    });
  });

  it("is null when no slice carries a best average", () => {
    expect(bestSessionAverage([srBucket({ ST_V1: null })])).toBeNull();
    expect(bestSessionAverage([])).toBeNull();
  });
});
