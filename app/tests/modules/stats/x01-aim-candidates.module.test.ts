import { describe, expect, it } from "vitest";
import { parseWireKey } from "@lib/stats/target-key";
import {
  candidatesFor,
  isGoodLeave,
  LEAVE_RANK,
} from "@modules/stats/x01-aim-candidates.module";
import type { InferredAim } from "@modules/types";

function keys(r: number, dartsLeft: 1 | 2 | 3): string[] {
  return candidatesFor({
    remaining: r,
    dartsLeft,
    earlierDartsInVisit: [],
  }).map(({ aim, basis }) => `${basis}:${aim.key}`);
}

/** `r` minus the largest score a hit on `aim` can make. */
function lowestLeaveOnHit(aim: InferredAim, r: number): number {
  switch (aim.kind) {
    case "TREBLE":
      return r - 3 * aim.number;
    case "SINGLE":
      return r - aim.number;
    case "DOUBLE":
      return r - 2 * aim.number;
    case "BULL":
      return r - 50;
    case "OUTER_BULL":
      return r - 25;
    case "WIRE":
      return r - Math.max(aim.numbers[0], aim.numbers[1]);
  }
}

describe("candidatesFor", () => {
  it.each([
    [
      501,
      3,
      [
        "LARGE_TARGET:TREBLE:20",
        "LARGE_TARGET:TREBLE:19",
        "LARGE_TARGET:TREBLE:18",
      ],
    ],
    [
      169,
      3,
      [
        "LARGE_TARGET:TREBLE:20",
        "LARGE_TARGET:TREBLE:19",
        "LARGE_TARGET:TREBLE:18",
      ],
    ],
    [100, 3, ["ROUTE:TREBLE:20"]],
    [81, 3, ["ROUTE:TREBLE:15"]],
    [120, 3, ["ROUTE:TREBLE:20"]],
    [41, 2, ["ROUTE:SINGLE:9"]],
    [41, 1, ["SETUP:SINGLE:9"]],
    [60, 1, ["SETUP:SINGLE:20"]],
    [99, 2, ["SETUP:TREBLE:19"]],
    [36, 1, ["FINISH:DOUBLE:18"]],
    [16, 2, ["FINISH:DOUBLE:8"]],
    [20, 2, ["FINISH:DOUBLE:10"]],
    [28, 3, ["FINISH:DOUBLE:14"]],
    [18, 3, ["FINISH:DOUBLE:9", "SPLIT:SINGLE:2"]],
    [34, 1, ["FINISH:DOUBLE:17", "SPLIT:SINGLE:2"]],
    [22, 2, ["FINISH:DOUBLE:11", "SPLIT:WIRE:6-10"]],
    [14, 2, ["FINISH:DOUBLE:7", "SPLIT:WIRE:6-10"]],
    [6, 3, ["FINISH:DOUBLE:3", "SPLIT:SINGLE:2"]],
    [10, 3, ["FINISH:DOUBLE:5", "SPLIT:SINGLE:2"]],
    [26, 3, ["FINISH:DOUBLE:13", "SPLIT:WIRE:6-10"]],
    [30, 3, ["FINISH:DOUBLE:15", "SPLIT:SINGLE:14"]],
    [38, 3, ["FINISH:DOUBLE:19", "SPLIT:WIRE:6-10"]],
    [39, 3, ["ROUTE:WIRE:7-19"]],
    [42, 3, ["ROUTE:WIRE:6-10"]],
    [46, 3, ["ROUTE:WIRE:6-10"]],
    [48, 3, ["ROUTE:WIRE:8-16"]],
    [23, 3, ["ROUTE:WIRE:7-19"]],
    [35, 3, ["ROUTE:WIRE:3-19"]],
    [43, 3, ["ROUTE:WIRE:3-19"]],
    [50, 3, ["FINISH:INNER_BULL:25", "ROUTE:SINGLE:10"]],
    [50, 1, ["FINISH:INNER_BULL:25", "SETUP:SINGLE:10"]],
    [135, 3, ["ROUTE:OUTER_BULL:25"]],
    [132, 3, ["ROUTE:INNER_BULL:25"]],
  ] as const)(
    "candidates at %i with %i darts left",
    (r, dartsLeft, expected) => {
      expect(keys(r, dartsLeft)).toEqual(expected);
    },
  );

  it.each([51, 52, 53, 54, 55, 56, 57, 58, 59, 60])("never wires %i", (r) => {
    expect(keys(r, 3).some((k) => k.includes("WIRE"))).toBe(false);
  });

  it("sweeps every state", () => {
    for (let r = 2; r <= 501; r++)
      for (const dartsLeft of [1, 2, 3] as const) {
        const list = candidatesFor({
          remaining: r,
          dartsLeft,
          earlierDartsInVisit: [],
        });
        expect(list.length).toBeGreaterThan(0);
        for (const { aim, weight } of list) {
          expect(weight).toBe(1);
          if (aim.kind === "WIRE")
            expect(parseWireKey(aim.key)).toEqual(aim.numbers);
          expect(lowestLeaveOnHit(aim, r)).toSatisfy(
            (leave: number) => leave === 0 || leave >= 2,
          );
        }
      }
  });

  it("ranks leaves", () => {
    expect(LEAVE_RANK).toEqual([32, 16, 40, 24, 8, 36, 28, 20, 12, 4]);
    expect([4, 12, 40].every(isGoodLeave)).toBe(true);
    expect([2, 6, 34, 44, 50].some(isGoodLeave)).toBe(false);
  });
});
