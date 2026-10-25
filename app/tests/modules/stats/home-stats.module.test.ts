import { describe, it, expect } from "vitest";
import {
  HOME_CELL_MM,
  HOME_GAME_TYPES,
  homeWindows,
  shapeHomeStats,
} from "@modules/stats/home-stats.module";
import type { VisitScoringRow } from "@modules/types";

const TZ = "Europe/Amsterdam";
const NOW = new Date("2026-10-25T10:00:00.000Z");

function row(
  bucketStart: string,
  v: {
    points: number;
    darts: number;
    firstNinePoints: number;
    firstNineDarts: number;
  },
): VisitScoringRow {
  return {
    bucketStart,
    bucketEnd: bucketStart,
    ton: 0,
    tonForty: 0,
    oneEighty: 0,
    ...v,
  };
}

describe("homeWindows", () => {
  it("anchors every bound on a local midnight, across the autumn DST day", () => {
    expect(homeWindows(NOW, TZ)).toEqual({
      today: "2026-10-25",
      currentStartDate: "2026-09-26",
      previousStartDate: "2026-08-27",
      dailyStartDate: "2026-10-19",
      currentFrom: "2026-09-25T22:00:00.000Z",
      previousFrom: "2026-08-26T22:00:00.000Z",
      to: "2026-10-25T23:00:00.000Z",
    });
  });

  it("uses the caller's local date, not the UTC date", () => {
    const late = new Date("2026-10-25T23:30:00.000Z");
    expect(homeWindows(late, TZ).today).toBe("2026-10-26");
    expect(homeWindows(late, "America/New_York").today).toBe("2026-10-25");
  });
});

describe("shapeHomeStats", () => {
  const windows = homeWindows(NOW, TZ);

  it("averages first nine per window and takes the difference", () => {
    const stats = shapeHomeStats({
      rows: [
        row("2026-10-24T22:00:00.000Z", {
          points: 300,
          darts: 9,
          firstNinePoints: 270,
          firstNineDarts: 9,
        }),
        row("2026-09-19T22:00:00.000Z", {
          points: 200,
          darts: 9,
          firstNinePoints: 180,
          firstNineDarts: 9,
        }),
        row("2026-08-19T22:00:00.000Z", {
          points: 999,
          darts: 9,
          firstNinePoints: 999,
          firstNineDarts: 9,
        }),
      ],
      cells: [],
      windows,
      tz: TZ,
    });
    expect(stats.firstNine).toEqual({ current: 90, previous: 60, delta: 30 });
  });

  it("returns seven days ending today with null for empty days", () => {
    const stats = shapeHomeStats({
      rows: [
        row("2026-10-24T22:00:00.000Z", {
          points: 300,
          darts: 9,
          firstNinePoints: 270,
          firstNineDarts: 9,
        }),
        row("2026-10-22T22:00:00.000Z", {
          points: 150,
          darts: 6,
          firstNinePoints: 150,
          firstNineDarts: 6,
        }),
      ],
      cells: [],
      windows,
      tz: TZ,
    });
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily[0]).toEqual({
      date: "2026-10-19",
      weekday: 1,
      value: null,
    });
    expect(stats.daily[4]).toEqual({
      date: "2026-10-23",
      weekday: 5,
      value: 75,
    });
    expect(stats.daily[6]).toEqual({
      date: "2026-10-25",
      weekday: 7,
      value: 100,
    });
  });

  it("is all null and empty with no data", () => {
    const stats = shapeHomeStats({ rows: [], cells: [], windows, tz: TZ });
    expect(stats.firstNine).toEqual({
      current: null,
      previous: null,
      delta: null,
    });
    expect(stats.daily.map((d) => d.value)).toEqual(Array(7).fill(null));
    expect(stats.landing).toEqual({ cellMm: HOME_CELL_MM, cells: [] });
  });

  it("has a null delta when only one window has darts", () => {
    const stats = shapeHomeStats({
      rows: [
        row("2026-10-24T22:00:00.000Z", {
          points: 300,
          darts: 9,
          firstNinePoints: 270,
          firstNineDarts: 9,
        }),
      ],
      cells: [],
      windows,
      tz: TZ,
    });
    expect(stats.firstNine).toEqual({
      current: 90,
      previous: null,
      delta: null,
    });
  });

  it("maps heatmap rows to [ix, iy, darts] cells", () => {
    const stats = shapeHomeStats({
      rows: [],
      cells: [
        { ix: -1, iy: -26, darts: 30 },
        { ix: 0, iy: 0, darts: 6 },
      ],
      windows,
      tz: TZ,
    });
    expect(stats.landing.cells).toEqual([
      [-1, -26, 30],
      [0, 0, 6],
    ]);
  });
});

describe("constants", () => {
  it("scopes home to the scoring games", () => {
    expect(HOME_GAME_TYPES).toEqual(["501", "SCORE_TRAINING"]);
  });
});
