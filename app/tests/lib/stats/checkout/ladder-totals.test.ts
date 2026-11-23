import { describe, expect, it } from "vitest";
import {
  ladderBands,
  sumLadderTargets,
} from "@lib/stats/checkout/ladder-totals";

const total = (attempts: number, successes: number) => ({
  attempts,
  successes,
});

describe("ladderBands", () => {
  it("bands by 20 from the start score with one band below it", () => {
    const totals = new Map([
      ["2", total(3, 1)],
      ["40", total(2, 0)],
      ["41", total(8, 4)],
      ["60", total(4, 2)],
      ["165", total(10, 5)],
    ]);
    expect(
      ladderBands(totals, { origin: 41, size: 20, cap: 170, minSample: 10 }),
    ).toEqual([
      { start: 2, end: 40, attempts: 5, successes: 1, rate: null },
      { start: 41, end: 60, attempts: 12, successes: 6, rate: 0.5 },
      { start: 161, end: 170, attempts: 10, successes: 5, rate: 0.5 },
    ]);
  });

  it("ends the top band at the cap", () => {
    expect(
      ladderBands(new Map([["170", total(1, 0)]]), {
        origin: 121,
        size: 20,
        cap: 170,
        minSample: 10,
      }),
    ).toEqual([
      { start: 161, end: 170, attempts: 1, successes: 0, rate: null },
    ]);
  });

  it("reproduces the store's tens from 1", () => {
    expect(
      ladderBands(new Map([["45", total(30, 15)]]), {
        origin: 1,
        size: 10,
        cap: 170,
        minSample: 30,
      }),
    ).toEqual([{ start: 41, end: 50, attempts: 30, successes: 15, rate: 0.5 }]);
  });
});

describe("sumLadderTargets", () => {
  it("sums targets, merges the peak and adds the miss counts", () => {
    const bucket = (maxTarget: number | null, a: number) => ({
      start: "a",
      end: "b",
      closed: true,
      sampleSize: 1,
      metrics: {
        targets: { "41": total(a, 1) },
        maxTarget,
        afterMiss: a,
        recovered: 1,
      },
    });
    const sum = sumLadderTargets([bucket(51, 2), bucket(null, 3)]);
    expect(sum.totals.get("41")).toEqual(total(5, 2));
    expect(sum.maxTarget).toBe(51);
    expect(sum.afterMiss).toBe(5);
    expect(sum.recovered).toBe(2);
  });
});
