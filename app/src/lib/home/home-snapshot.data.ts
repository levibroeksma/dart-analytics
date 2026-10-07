import { BOARD_RADII_MM } from "@lib/game/board/board-geometry.module";
import { heatStamps } from "@modules/stats/sections/heatmap-density.module";
import type { HeatmapMetrics } from "@modules/types";
import type {
  CareerTile,
  DailyAverage,
  DailyBar,
  HomeSnapshotContext,
} from "@lib/types";

const BOARD_SPAN_MM = BOARD_RADII_MM.surroundOuter * 2;

const BAR_FLOOR = 50;
const BAR_RANGE = 25;

const DAILY: DailyAverage[] = [
  { day: "M", value: 61.2 },
  { day: "T", value: 66.8 },
  { day: "W", value: 58.4 },
  { day: "T", value: 70.3 },
  { day: "F", value: 74.1 },
  { day: "S", value: 68.9 },
  { day: "S", value: 71.5 },
];

const CAREER: CareerTile[] = [
  { key: "BEST AVG", value: "84.6", hint: "501 · Sep 12" },
  { key: "TOP OUT", value: "121", hint: "Hit 1×" },
  { key: "DARTS", value: "18,342", hint: "Career" },
];

/** Fixture landing cells (4 mm grid, mm from the bull): T20 heaviest, then S20, S1/S5, bull, a few strays. */
const LANDING: HeatmapMetrics = {
  cellMm: 4,
  target: null,
  cells: [
    [-1, -26, 30],
    [0, -26, 38],
    [1, -26, 24],
    [0, -25, 18],
    [0, -27, 14],
    [-1, -34, 10],
    [0, -34, 14],
    [0, -33, 9],
    [1, -35, 6],
    [-7, -23, 8],
    [-8, -24, 5],
    [7, -24, 7],
    [8, -23, 4],
    [0, 0, 6],
    [-1, 0, 4],
    [37, -13, 3],
    [-13, -39, 3],
  ],
};

/** The highest daily average to two decimals, or a dash with no days. */
export function dailyPeak(days: DailyAverage[]): string {
  if (days.length === 0) return "—";
  return Math.max(...days.map((d) => d.value)).toFixed(2);
}

/** A bar's CSS height: `value` mapped from 50–75 onto 0–100%, clamped. */
export function barHeight(value: number): string {
  const pct = ((value - BAR_FLOOR) / BAR_RANGE) * 100;
  return `${Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10}%`;
}

/** One bar per day; every day sharing the highest value is a peak. */
export function dailyBars(days: DailyAverage[]): DailyBar[] {
  const max = Math.max(...days.map((d) => d.value));
  return days.map((d) => ({
    day: d.day,
    height: barHeight(d.value),
    peak: d.value === max,
  }));
}

/**
 * Homepage stat sections. Fixture values from the design until the data
 * pass replaces them with reads; the returned shape is the contract.
 */
export function homeSnapshot(): HomeSnapshotContext {
  return {
    hero: {
      label: "FIRST-9 AVERAGE",
      value: "72.4",
      delta: "1.8",
      window: "last 30 days",
    },
    resume: {
      game: "501",
      detail: "vs Dartbot · Leg 3 of 5 · 2–0",
      remaining: "141",
      started: "STARTED 18 MIN AGO",
      href: "/games",
    },
    careerTiles: CAREER,
    dailyAverage: DAILY,
    peak: dailyPeak(DAILY),
    bars: dailyBars(DAILY),
    landing: {
      window: "LAST 30 DAYS",
      stamps: heatStamps(LANDING, BOARD_SPAN_MM),
    },

    navigate(path: string) {
      globalThis.location.href = path;
    },

    resumeGame(this: HomeSnapshotContext) {
      this.navigate(this.resume.href);
    },
  };
}
