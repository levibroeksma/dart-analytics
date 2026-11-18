import { describe, expect, it } from "vitest";
import { aceComparison } from "@lib/stats/ace/ace-comparison";
import type { DoublesTrainingInput } from "@lib/types";

const BUCKET = {
  start: "2026-10-01T00:00:00.000Z",
  end: "2026-11-01T00:00:00.000Z",
  closed: true,
};

type Misses = { left?: number; right?: number; high?: number; low?: number };

function input(
  rows: Record<
    string,
    {
      attempts: number;
      hits: number;
      misses?: Misses;
      near?: number;
      loose?: number;
    }
  >,
): DoublesTrainingInput {
  const accuracy: Record<string, { attempts: number; hits: number }> = {};
  const misses: Record<string, unknown> = {};
  const loose: Record<string, unknown> = {};
  for (const [aim, row] of Object.entries(rows)) {
    accuracy[aim] = { attempts: row.attempts, hits: row.hits };
    const m = row.misses ?? {};
    misses[aim] = (
      [
        [5, m.left],
        [1, m.right],
        [0, m.high],
        [4, m.low],
      ] as const
    )
      .filter(([, darts]) => (darts ?? 0) > 0)
      .map(([sector, darts]) => ({ sector, radial: "WITHIN", darts }));
    loose[aim] = {
      onTarget: row.hits,
      nearMiss: row.near ?? 0,
      loose: row.loose ?? 0,
    };
  }
  const bucket = (metrics: unknown) => ({ ...BUCKET, sampleSize: 1, metrics });
  return {
    accuracy: [bucket(accuracy)],
    misses: [bucket(misses)],
    loose: [bucket(loose)],
  } as unknown as DoublesTrainingInput;
}

const KEYS = new Set(["NUMBER:7", "NUMBER:8", "BULL:25"]);

describe("aceComparison", () => {
  it("sums the target hit rate over every row, now and before", () => {
    const result = aceComparison(
      input({
        "NUMBER:7": { attempts: 25, hits: 10 },
        "BULL:25": { attempts: 15, hits: 6 },
      }),
      input({ "NUMBER:8": { attempts: 50, hits: 15 } }),
      KEYS,
    );

    expect(result.hit).toEqual({
      current: { part: 16, whole: 40 },
      previous: { part: 15, whole: 50 },
    });
  });

  it("names the largest miss direction and compares the same direction's share before", () => {
    const result = aceComparison(
      input({
        "NUMBER:7": {
          attempts: 40,
          hits: 20,
          misses: { left: 12, right: 5, high: 2, low: 1 },
        },
      }),
      input({
        "NUMBER:7": {
          attempts: 50,
          hits: 20,
          misses: { left: 9, right: 15, high: 3, low: 3 },
        },
      }),
      KEYS,
    );

    expect(result.drift).toEqual({
      direction: "Left",
      current: { part: 12, whole: 20 },
      previous: { part: 9, whole: 30 },
    });
  });

  it("breaks a drift tie in the order Left, Right, High, Low", () => {
    const result = aceComparison(
      input({
        "NUMBER:7": { attempts: 20, hits: 10, misses: { left: 5, right: 5 } },
      }),
      null,
      KEYS,
    );

    expect(result.drift.direction).toBe("Left");
  });

  it("names no drift direction when no miss has a direction", () => {
    const result = aceComparison(
      input({ "NUMBER:7": { attempts: 10, hits: 10 } }),
      null,
      KEYS,
    );

    expect(result.drift.direction).toBeNull();
    expect(result.drift.current).toEqual({ part: 0, whole: 0 });
  });

  it("gives the near miss share of near and loose misses", () => {
    const result = aceComparison(
      input({ "NUMBER:7": { attempts: 50, hits: 20, near: 18, loose: 12 } }),
      null,
      KEYS,
    );

    expect(result.near.current).toEqual({ part: 18, whole: 30 });
  });

  it("leaves every previous empty without a preceding period", () => {
    const result = aceComparison(
      input({ "NUMBER:7": { attempts: 10, hits: 5 } }),
      null,
      KEYS,
    );

    expect([
      result.hit.previous,
      result.drift.previous,
      result.near.previous,
    ]).toEqual([null, null, null]);
  });
});
