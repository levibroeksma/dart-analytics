import { describe, expect, it } from "vitest";
import {
  chunkWindows,
  mergeMetrics,
  zonedYearWindow,
} from "@lib/stats/merge-metrics";

const AMS = "Europe/Amsterdam";

/** The hour (0-23) `iso` reads as in `tz` — used to assert a boundary is local midnight. */
function localHour(iso: string, tz: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hourCycle: "h23",
  });
  return Number(formatter.format(new Date(iso)));
}

/** The month (1-12) `iso` reads as in `tz`. */
function localMonth(iso: string, tz: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "2-digit",
  });
  return Number(formatter.format(new Date(iso)));
}

describe("chunkWindows", () => {
  it("gives 12 calendar-month windows for a calendar year in Europe/Amsterdam", () => {
    const from = "2025-12-31T23:00:00.000Z"; // 2026-01-01 00:00 local (CET, +01:00)
    const to = "2026-12-31T23:00:00.000Z"; // 2027-01-01 00:00 local (CET, +01:00)

    const windows = chunkWindows(from, to, "none", AMS);

    expect(windows).toHaveLength(12);
    expect(windows[0]!.from).toBe(from);
    expect(windows.at(-1)!.to).toBe(to);
    for (let i = 0; i < windows.length; i += 1) {
      expect(localHour(windows[i]!.from, AMS)).toBe(0);
      expect(localHour(windows[i]!.to, AMS)).toBe(0);
      expect(localMonth(windows[i]!.from, AMS)).toBe(i + 1);
      if (i > 0) expect(windows[i]!.from).toBe(windows[i - 1]!.to);
    }
  });

  it("handles the March and October DST month edges at local midnight", () => {
    // Europe/Amsterdam: CET (+01:00) Jan-Mar, CEST (+02:00) Apr-Oct, CET again from Nov.
    const from = "2025-12-31T23:00:00.000Z";
    const to = "2026-12-31T23:00:00.000Z";
    const windows = chunkWindows(from, to, "year", AMS);

    const marchStart = windows[2]!.from; // 2026-03-01 local midnight, still CET
    const aprilStart = windows[3]!.from; // 2026-04-01 local midnight, already CEST
    expect(marchStart.endsWith("T23:00:00.000Z")).toBe(true);
    expect(aprilStart.endsWith("T22:00:00.000Z")).toBe(true);
  });

  it("gives bucket-unit windows for day and week", () => {
    const dayWindows = chunkWindows(
      "2026-01-01T00:00:00.000Z",
      "2026-01-04T00:00:00.000Z",
      "day",
      "UTC",
    );
    expect(dayWindows).toEqual([
      { from: "2026-01-01T00:00:00.000Z", to: "2026-01-02T00:00:00.000Z" },
      { from: "2026-01-02T00:00:00.000Z", to: "2026-01-03T00:00:00.000Z" },
      { from: "2026-01-03T00:00:00.000Z", to: "2026-01-04T00:00:00.000Z" },
    ]);

    const weekWindows = chunkWindows(
      "2026-01-05T00:00:00.000Z", // a Monday
      "2026-01-19T00:00:00.000Z",
      "week",
      "UTC",
    );
    expect(weekWindows).toEqual([
      { from: "2026-01-05T00:00:00.000Z", to: "2026-01-12T00:00:00.000Z" },
      { from: "2026-01-12T00:00:00.000Z", to: "2026-01-19T00:00:00.000Z" },
    ]);
  });

  it("clips the first and last windows to the requested range", () => {
    const windows = chunkWindows(
      "2026-01-15T00:00:00.000Z",
      "2026-02-10T00:00:00.000Z",
      "month",
      "UTC",
    );
    expect(windows).toEqual([
      { from: "2026-01-15T00:00:00.000Z", to: "2026-02-01T00:00:00.000Z" },
      { from: "2026-02-01T00:00:00.000Z", to: "2026-02-10T00:00:00.000Z" },
    ]);
  });
});

describe("zonedYearWindow", () => {
  it("gives the calendar year in tz containing the instant", () => {
    const window = zonedYearWindow("2026-06-15T00:00:00.000Z", AMS);
    expect(localMonth(window.from, AMS)).toBe(1);
    expect(localHour(window.from, AMS)).toBe(0);
    expect(new Date(window.to).getTime()).toBeGreaterThan(
      new Date(window.from).getTime(),
    );
  });
});

describe("mergeMetrics", () => {
  it("sums checkout-rate leaves key by key, including keys only one side has", () => {
    const merged = mergeMetrics(
      "checkout-rate",
      { "170": { chances: 2, finished: 1 }, "32": { chances: 3, finished: 3 } },
      { "170": { chances: 1, finished: 1 } },
    );
    expect(merged).toEqual({
      "170": { chances: 3, finished: 2 },
      "32": { chances: 3, finished: 3 },
    });
  });

  it("sums double-performance leaves", () => {
    const merged = mergeMetrics(
      "double-performance",
      { "DOUBLE:16": { attempts: 4, hits: 2 } },
      {
        "DOUBLE:16": { attempts: 1, hits: 1 },
        "INNER_BULL:25": { attempts: 2, hits: 0 },
      },
    );
    expect(merged).toEqual({
      "DOUBLE:16": { attempts: 5, hits: 3 },
      "INNER_BULL:25": { attempts: 2, hits: 0 },
    });
  });

  it("sums bust-rate leaves", () => {
    const merged = mergeMetrics(
      "bust-rate",
      { "40": { visits: 3, busts: 1 } },
      { "40": { visits: 2, busts: 2 } },
    );
    expect(merged).toEqual({ "40": { visits: 5, busts: 3 } });
  });

  it("sums the leg-stats histogram and keeps the fewest-darts best leg", () => {
    const merged = mergeMetrics(
      "leg-stats",
      {
        legs: { "18": 2, "21": 1 },
        bestLeg: {
          darts: 18,
          sessionId: "0190a000-0000-7000-8000-000000000001",
        },
      },
      {
        legs: { "18": 1, "15": 3 },
        bestLeg: {
          darts: 15,
          sessionId: "0190a000-0000-7000-8000-000000000002",
        },
      },
    );
    expect(merged).toEqual({
      legs: { "18": 3, "21": 1, "15": 3 },
      bestLeg: { darts: 15, sessionId: "0190a000-0000-7000-8000-000000000002" },
    });
  });

  it("keeps the first best leg on a tie and tolerates a null side", () => {
    const first = {
      darts: 18,
      sessionId: "0190a000-0000-7000-8000-000000000001",
    };
    expect(
      mergeMetrics(
        "leg-stats",
        { legs: { "18": 1 }, bestLeg: first },
        {
          legs: { "18": 1 },
          bestLeg: {
            darts: 18,
            sessionId: "0190a000-0000-7000-8000-000000000002",
          },
        },
      ).bestLeg,
    ).toEqual(first);
    expect(
      mergeMetrics(
        "leg-stats",
        { legs: {}, bestLeg: null },
        { legs: { "18": 1 }, bestLeg: first },
      ).bestLeg,
    ).toEqual(first);
  });

  it("merges checkout-path two levels deep", () => {
    const merged = mergeMetrics(
      "checkout-path",
      { "170": { "T20 T20 BULL": { visits: 2, finished: 2 } } },
      {
        "170": {
          "T20 T20 BULL": { visits: 1, finished: 0 },
          "T20 T19 D8": { visits: 1, finished: 1 },
        },
        "81": { "T19 D12": { visits: 1, finished: 1 } },
      },
    );
    expect(merged).toEqual({
      "170": {
        "T20 T20 BULL": { visits: 3, finished: 2 },
        "T20 T19 D8": { visits: 1, finished: 1 },
      },
      "81": { "T19 D12": { visits: 1, finished: 1 } },
    });
  });

  it("merges ladder-progress, max-merging maxTarget with null as identity", () => {
    const merged = mergeMetrics(
      "ladder-progress",
      {
        targets: { "41": { attempts: 2, successes: 1 } },
        maxTarget: 51,
        afterMiss: 1,
        recovered: 1,
      },
      {
        targets: {
          "41": { attempts: 1, successes: 1 },
          "121": { attempts: 1, successes: 0 },
        },
        maxTarget: null,
        afterMiss: 2,
        recovered: 0,
      },
    );
    expect(merged).toEqual({
      targets: {
        "41": { attempts: 3, successes: 2 },
        "121": { attempts: 1, successes: 0 },
      },
      maxTarget: 51,
      afterMiss: 3,
      recovered: 1,
    });
  });

  it("maxTarget merges to the larger side when both are present", () => {
    const merged = mergeMetrics(
      "ladder-progress",
      { targets: {}, maxTarget: 41, afterMiss: 0, recovered: 0 },
      { targets: {}, maxTarget: 121, afterMiss: 0, recovered: 0 },
    );
    expect(merged.maxTarget).toBe(121);
  });

  it("sums heatmap cells by ix,iy and keeps cellMm and target", () => {
    const merged = mergeMetrics(
      "heatmap",
      {
        cellMm: 5,
        target: "NUMBER:7",
        cells: [
          [0, 0, 2],
          [1, -1, 1],
        ],
      },
      {
        cellMm: 5,
        target: "NUMBER:7",
        cells: [
          [0, 0, 3],
          [2, 2, 4],
        ],
      },
    );
    expect(merged).toEqual({
      cellMm: 5,
      target: "NUMBER:7",
      cells: [
        [0, 0, 5],
        [1, -1, 1],
        [2, 2, 4],
      ],
    });
  });

  it("sums target-accuracy leaves", () => {
    const merged = mergeMetrics(
      "target-accuracy",
      { "NUMBER:20": { attempts: 4, hits: 2 } },
      {
        "NUMBER:20": { attempts: 1, hits: 1 },
        "BULL:25": { attempts: 2, hits: 0 },
      },
    );
    expect(merged).toEqual({
      "NUMBER:20": { attempts: 5, hits: 3 },
      "BULL:25": { attempts: 2, hits: 0 },
    });
  });

  it("sums loose-darts leaves", () => {
    const merged = mergeMetrics(
      "loose-darts",
      { "NUMBER:20": { onTarget: 2, nearMiss: 1, loose: 1 } },
      { "NUMBER:20": { onTarget: 1, nearMiss: 0, loose: 2 } },
    );
    expect(merged).toEqual({
      "NUMBER:20": { onTarget: 3, nearMiss: 1, loose: 3 },
    });
  });

  it("sums confusion counts two levels deep, including keys only one side has", () => {
    const merged = mergeMetrics(
      "confusion",
      { "NUMBER:20": { "TREBLE:20": 3, MISS: 1 } },
      {
        "NUMBER:20": { "TREBLE:20": 2, "DOUBLE:20": 1 },
        "BULL:25": { "INNER_BULL:25": 1 },
      },
    );
    expect(merged).toEqual({
      "NUMBER:20": { "TREBLE:20": 5, MISS: 1, "DOUBLE:20": 1 },
      "BULL:25": { "INNER_BULL:25": 1 },
    });
  });

  it("sums miss-direction entries by (target, sector, radial), not double-counting or overwriting overlapping keys", () => {
    const merged = mergeMetrics(
      "miss-direction",
      {
        "NUMBER:20": [
          { sector: 0, radial: "WITHIN", darts: 2 },
          { sector: 1, radial: "OUTSIDE", darts: 1 },
        ],
      },
      {
        "NUMBER:20": [{ sector: 0, radial: "WITHIN", darts: 3 }],
        "BULL:25": [{ sector: 4, radial: "INSIDE", darts: 1 }],
      },
    );
    expect(merged["NUMBER:20"]).toHaveLength(2);
    expect(merged["NUMBER:20"]).toContainEqual({
      sector: 0,
      radial: "WITHIN",
      darts: 5,
    });
    expect(merged["NUMBER:20"]).toContainEqual({
      sector: 1,
      radial: "OUTSIDE",
      darts: 1,
    });
    expect(merged["BULL:25"]).toEqual([
      { sector: 4, radial: "INSIDE", darts: 1 },
    ]);
  });

  it("sums shanghai-count", () => {
    const merged = mergeMetrics(
      "shanghai-count",
      { sessions: 3, shanghais: 1, byRound: { "3": 1 } },
      { sessions: 2, shanghais: 1, byRound: { "3": 1, "5": 1 } },
    );
    expect(merged).toEqual({
      sessions: 5,
      shanghais: 2,
      byRound: { "3": 2, "5": 1 },
    });
  });

  it("sums training-result sessions and totals but takes the max best", () => {
    const merged = mergeMetrics(
      "training-result",
      {
        g: { sessions: 2, total: 10, best: 7 },
        h: { sessions: 1, total: 4, best: 4 },
      },
      { g: { sessions: 1, total: 9, best: 9 } },
    );
    expect(merged).toEqual({
      g: { sessions: 3, total: 19, best: 9 },
      h: { sessions: 1, total: 4, best: 4 },
    });
  });

  it("sums atc-darts-per-target two levels deep, grouped by config key", () => {
    const merged = mergeMetrics(
      "atc-darts-per-target",
      { "V1|": { "NUMBER:1": { darts: 2, cleared: 1 } } },
      {
        "V1|": {
          "NUMBER:1": { darts: 1, cleared: 1 },
          "NUMBER:2": { darts: 3, cleared: 0 },
        },
        "V2|": { "NUMBER:1": { darts: 5, cleared: 2 } },
      },
    );
    expect(merged).toEqual({
      "V1|": {
        "NUMBER:1": { darts: 3, cleared: 2 },
        "NUMBER:2": { darts: 3, cleared: 0 },
      },
      "V2|": { "NUMBER:1": { darts: 5, cleared: 2 } },
    });
  });

  it("sums bobs27-survival counts, keeping the MIN of mins and MAX of maxes for scoreAfter", () => {
    const merged = mergeMetrics(
      "bobs27-survival",
      {
        "START27|": {
          runs: 2,
          completed: 1,
          reached: { "DOUBLE:4": 2 },
          died: { "DOUBLE:4": 1 },
          scoreAfter: { "DOUBLE:4": { runs: 2, sum: 30, min: 10, max: 20 } },
        },
      },
      {
        "START27|": {
          runs: 1,
          completed: 0,
          reached: { "DOUBLE:4": 1, "DOUBLE:5": 1 },
          died: {},
          scoreAfter: { "DOUBLE:4": { runs: 1, sum: 5, min: 5, max: 5 } },
        },
      },
    );
    expect(merged["START27|"]).toEqual({
      runs: 3,
      completed: 1,
      reached: { "DOUBLE:4": 3, "DOUBLE:5": 1 },
      died: { "DOUBLE:4": 1 },
      scoreAfter: { "DOUBLE:4": { runs: 3, sum: 35, min: 5, max: 20 } },
    });
  });

  it("keeps a bobs27-survival group present on only one side untouched", () => {
    const merged = mergeMetrics(
      "bobs27-survival",
      {
        "START27|": {
          runs: 1,
          completed: 0,
          reached: {},
          died: {},
          scoreAfter: {},
        },
      },
      {
        "START15|": {
          runs: 1,
          completed: 1,
          reached: { "INNER_BULL:25": 1 },
          died: {},
          scoreAfter: {
            "INNER_BULL:25": { runs: 1, sum: 27, min: 27, max: 27 },
          },
        },
      },
    );
    expect(merged["START27|"]!.runs).toBe(1);
    expect(merged["START15|"]!.completed).toBe(1);
  });
});
