import {
  fetchStatisticsHome,
  fetchStatisticsOverview,
} from "@client/api/statistics";
import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { heatStamps } from "@modules/stats/sections/heatmap-density.module";
import type {
  StatisticsHomeResponseData,
  StatisticsOverviewResponseData,
} from "@routes/types";
import type {
  CareerTile,
  DailyAverage,
  DailyBar,
  HomeHero,
  HomeLanding,
  HomeSnapshotContext,
} from "@lib/types";

const BOARD_SPAN_MM = BOARD_RADII_MM.surroundOuter * 2;

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * The three career tiles. Titles are fixed; `null` (not loaded, or the load
 * failed) leaves every value a dash. A zero average means no games yet.
 */
export function careerTiles(
  overview: StatisticsOverviewResponseData | null,
): CareerTile[] {
  const average = overview?.highestGameAverage ?? 0;
  const checkout = overview?.highestCheckout ?? null;
  return [
    {
      key: "BEST AVG",
      value: average > 0 ? average.toFixed(1) : "—",
      hint: "Career",
    },
    {
      key: "TOP OUT",
      value: checkout === null ? "—" : String(checkout.value),
      hint: checkout === null ? "Career" : `Hit ${checkout.timesHit}×`,
    },
    {
      key: "DARTS",
      value:
        overview === null
          ? "—"
          : overview.totalDartsThrown.toLocaleString("en-US"),
      hint: "Career",
    },
  ];
}

/** The hero stat: first-9 average and its change over 30 days; a dash and no change line without data. */
export function heroFromStats(
  home: StatisticsHomeResponseData | null,
): HomeHero {
  const current = home?.firstNine.current ?? null;
  const delta = home?.firstNine.delta ?? null;
  const text = delta === null ? null : Math.abs(delta).toFixed(1);
  const shown = text !== null && text !== "0.0" ? text : null;
  return {
    label: "FIRST-9 AVERAGE",
    value: current === null ? "—" : current.toFixed(1),
    delta: shown ?? "",
    direction: delta !== null && delta < 0 ? "Down" : "Up",
    showDelta: shown !== null,
    window: "last 30 days",
  };
}

/** The seven daily averages labelled by weekday letter; empty without stats. */
export function dailyFromStats(
  home: StatisticsHomeResponseData | null,
): DailyAverage[] {
  if (home === null) return [];
  return home.daily.map((day) => ({
    day: WEEKDAY_LETTERS[day.weekday - 1] ?? "",
    value: day.value,
  }));
}

/** The landing card: the last 30 days' cells as heat stamps; none without cells. */
export function landingFromStats(
  home: StatisticsHomeResponseData | null,
): HomeLanding {
  const cells = home?.landing.cells ?? [];
  return {
    window: "LAST 30 DAYS",
    stamps:
      home === null || cells.length === 0
        ? []
        : heatStamps(
            { cellMm: home.landing.cellMm, target: null, cells },
            BOARD_SPAN_MM,
          ),
  };
}

function peakValue(days: DailyAverage[]): number | null {
  const values = days.flatMap((d) => (d.value === null ? [] : [d.value]));
  return values.length === 0 ? null : Math.max(...values);
}

/** The highest daily average to two decimals, or a dash with no measured days. */
export function dailyPeak(days: DailyAverage[]): string {
  const peak = peakValue(days);
  return peak === null ? "—" : peak.toFixed(2);
}

/** A bar's CSS height: `value` as a share of `peak`; an empty day, or no peak, is 0%. */
export function barHeight(value: number | null, peak: number | null): string {
  if (value === null || peak === null || peak <= 0) return "0%";
  return `${Math.round(Math.min(100, (value / peak) * 100) * 10) / 10}%`;
}

/** One bar per day, sized against the highest day; every measured day sharing the highest value is a peak. */
export function dailyBars(days: DailyAverage[]): DailyBar[] {
  const max = peakValue(days);
  return days.map((d) => ({
    day: d.day,
    height: barHeight(d.value, max),
    peak: d.value !== null && d.value === max,
  }));
}

/**
 * Homepage stat sections. `init()` reads `GET /api/statistics/overview` for
 * the career tiles and `GET /api/statistics/home` for the hero, daily bars
 * and landing heatmap; each stays empty if its own read fails.
 */
export function homeSnapshot(): HomeSnapshotContext {
  return {
    hero: heroFromStats(null),
    careerTiles: careerTiles(null),
    dailyAverage: dailyFromStats(null),
    peak: dailyPeak([]),
    bars: dailyBars([]),
    landing: landingFromStats(null),

    async init(this: HomeSnapshotContext) {
      const [overview, home] = await Promise.allSettled([
        fetchStatisticsOverview(),
        fetchStatisticsHome(Intl.DateTimeFormat().resolvedOptions().timeZone),
      ]);
      this.careerTiles = careerTiles(
        overview.status === "fulfilled" && overview.value
          ? overview.value
          : null,
      );
      const stats =
        home.status === "fulfilled" && home.value ? home.value : null;
      this.hero = heroFromStats(stats);
      this.dailyAverage = dailyFromStats(stats);
      this.peak = dailyPeak(this.dailyAverage);
      this.bars = dailyBars(this.dailyAverage);
      this.landing = landingFromStats(stats);
    },
  };
}
