import { describe, it, expect } from "vitest";
import {
  bestRate,
  hitRateRows,
  seriesKeys,
  sumInBand,
  worstRate,
} from "@modules/stats/sections/hit-rate-rows.module";
import type { CachedSeries } from "@client/types";
import type { HitRateRow, HitRateTotals } from "@modules/types";

function series<M>(bucketMetrics: M[]): CachedSeries<M> {
  return {
    sectionId: "target-accuracy",
    sectionVersion: 1,
    dataVersion: "v1",
    bucket: "month",
    tz: null,
    range: { from: "2026-01-01T00:00:00.000Z", to: "2026-03-01T00:00:00.000Z" },
    buckets: bucketMetrics.map((metrics, i) => ({
      start: `2026-0${i + 1}-01T00:00:00.000Z`,
      end: `2026-0${i + 2}-01T00:00:00.000Z`,
      closed: true,
      sampleSize: 1,
      metrics,
    })),
  };
}

function row(targetKey: string, attempts: number, rate: number): HitRateRow {
  return { targetKey, attempts, hits: attempts * rate, rate };
}

describe("hitRateRows", () => {
  it("merges a target across two buckets and sorts ascending by rate", () => {
    const rows = hitRateRows(
      series<Record<string, HitRateTotals>>([
        {
          "DOUBLE:16": { attempts: 4, hits: 3 },
          "DOUBLE:8": { attempts: 2, hits: 0 },
        },
        { "DOUBLE:16": { attempts: 4, hits: 1 } },
      ]),
    );

    expect(rows).toEqual([
      { targetKey: "DOUBLE:8", attempts: 2, hits: 0, rate: 0 },
      { targetKey: "DOUBLE:16", attempts: 8, hits: 4, rate: 0.5 },
    ]);
  });

  it("gives rate 0 at zero attempts", () => {
    const rows = hitRateRows(
      series([{ "SINGLE:20": { attempts: 0, hits: 0 } }]),
    );

    expect(rows).toEqual([
      { targetKey: "SINGLE:20", attempts: 0, hits: 0, rate: 0 },
    ]);
  });

  it("keeps first-seen order among equal rates", () => {
    const rows = hitRateRows(
      series([{ A: { attempts: 2, hits: 1 }, B: { attempts: 4, hits: 2 } }]),
    );

    expect(rows.map((r) => r.targetKey)).toEqual(["A", "B"]);
  });

  it("returns [] for an undefined series", () => {
    expect(hitRateRows(undefined)).toEqual([]);
  });
});

describe("bestRate / worstRate", () => {
  it("return null when no row reaches minAttempts", () => {
    const rows = [row("A", 4, 0.5), row("B", 9, 1)];

    expect(bestRate(rows, 10)).toBeNull();
    expect(worstRate(rows, 10)).toBeNull();
  });

  it("ignore rows below minAttempts", () => {
    const rows = [row("LOW", 2, 0), row("MID", 10, 0.5), row("TOP", 3, 1)];

    expect(bestRate(rows, 10)?.targetKey).toBe("MID");
    expect(worstRate(rows, 10)?.targetKey).toBe("MID");
  });

  it("keep the first row of a tie", () => {
    const rows = [row("FIRST", 10, 0.5), row("SECOND", 10, 0.5)];

    expect(bestRate(rows, 10)?.targetKey).toBe("FIRST");
    expect(worstRate(rows, 10)?.targetKey).toBe("FIRST");
  });

  it("pick the highest and lowest rate", () => {
    const rows = [row("A", 10, 0.2), row("B", 10, 0.9), row("C", 10, 0.5)];

    expect(bestRate(rows, 10)?.targetKey).toBe("B");
    expect(worstRate(rows, 10)?.targetKey).toBe("A");
  });
});

describe("sumInBand", () => {
  const pick = (m: { chances: number; finished: number }) => [
    m.chances,
    m.finished,
  ];

  it("sums every metric whose numeric key is within the band, both edges included", () => {
    const sums = sumInBand(
      series<Record<string, { chances: number; finished: number }>>([
        {
          "1": { chances: 100, finished: 100 },
          "2": { chances: 3, finished: 1 },
          "40": { chances: 5, finished: 2 },
          "41": { chances: 100, finished: 100 },
        },
        { "20": { chances: 2, finished: 2 } },
      ]),
      { low: 2, high: 40 },
      pick,
    );

    expect(sums).toEqual([10, 5]);
  });

  it("returns zeros for an undefined series", () => {
    const [chances = 0, finished = 0] = sumInBand(
      undefined,
      { low: 2, high: 40 },
      pick,
    );

    expect([chances, finished]).toEqual([0, 0]);
  });
});

describe("seriesKeys", () => {
  it("unions the metric keys across buckets, sorted", () => {
    expect(
      seriesKeys(
        series([
          { b: 1, a: 1 },
          { c: 1, a: 2 },
        ]),
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("returns [] for an undefined series", () => {
    expect(seriesKeys(undefined)).toEqual([]);
  });
});
