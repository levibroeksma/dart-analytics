import { describe, it, expect } from "vitest";
import {
  foldSeriesByKey,
  hitRateRows,
} from "@modules/stats/sections/hit-rate-rows.module";
import type { CachedSeries } from "@client/types";
import type { HitRateTotals } from "@modules/types";

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

describe("foldSeriesByKey", () => {
  const init = (m: HitRateTotals): HitRateTotals => ({ ...m });
  const merge = (into: HitRateTotals, m: HitRateTotals) => {
    into.attempts += m.attempts;
    into.hits += m.hits;
  };

  it("merges a key across buckets in first-seen order", () => {
    const folded = foldSeriesByKey(
      series<Record<string, HitRateTotals>>([
        { A: { attempts: 1, hits: 1 }, B: { attempts: 2, hits: 0 } },
        { A: { attempts: 3, hits: 2 }, C: { attempts: 1, hits: 1 } },
      ]),
      init,
      merge,
    );

    expect(Array.from(folded.entries())).toEqual([
      ["A", { attempts: 4, hits: 3 }],
      ["B", { attempts: 2, hits: 0 }],
      ["C", { attempts: 1, hits: 1 }],
    ]);
  });

  it("starts each key from init, never aliasing the bucket's metric", () => {
    const first = { attempts: 1, hits: 1 };
    const input = series<Record<string, HitRateTotals>>([
      { A: first },
      { A: { attempts: 1, hits: 0 } },
    ]);

    const folded = foldSeriesByKey(input, init, merge);

    expect(folded.get("A")).not.toBe(first);
    expect(first).toEqual({ attempts: 1, hits: 1 });
  });

  it("returns an empty map for an undefined series", () => {
    expect(foldSeriesByKey(undefined, init, merge).size).toBe(0);
  });
});
