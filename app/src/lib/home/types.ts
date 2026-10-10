import type { HeatStamp } from "@modules/types";

/** Homepage hero stat: label, headline value and its change over a window. */
export type HomeHero = {
  label: string;
  value: string;
  delta: string;
  window: string;
};

/** One career tile: mono key, display value, muted hint. */
export type CareerTile = { key: string; value: string; hint: string };

/** One weekday's average for the daily-average card. */
export type DailyAverage = { day: string; value: number };

/** One rendered bar of the daily-average card. */
export type DailyBar = { day: string; height: string; peak: boolean };

/** The landing heatmap card: its window label and canvas stamps. */
export type HomeLanding = { window: string; stamps: HeatStamp[] };

/** The `homeSnapshot()` Alpine scope. */
export type HomeSnapshotContext = {
  hero: HomeHero;
  careerTiles: CareerTile[];
  dailyAverage: DailyAverage[];
  peak: string;
  bars: DailyBar[];
  landing: HomeLanding;
  init(this: HomeSnapshotContext): Promise<void>;
};
