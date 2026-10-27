import { describe, it, expect } from "vitest";
import {
  consecutiveTargets,
  dartWalkJudge,
  seededDrawTarget,
  seededPoolDraw,
  unreachableFails,
} from "@modules/game/checkout-policies";
import { initialCheckoutSeat } from "@modules/game/checkout-kernel.module";
import type { DartZoneKey, TurnFact } from "@modules/types";

function turn(...darts: [number | null, DartZoneKey, number][]): TurnFact {
  return {
    darts: darts.map(([hitTargetNumber, hitZoneKey, score]) => ({
      hitTargetNumber,
      hitZoneKey,
      score,
    })),
  } as unknown as TurnFact;
}

const at = (start: number) => initialCheckoutSeat(start, null);

describe("dartWalkJudge", () => {
  it("checks out on a double, counting darts used", () => {
    expect(
      dartWalkJudge(at(61), turn([15, "TREBLE", 45], [8, "DOUBLE", 16])),
    ).toEqual({ kind: "CHECKOUT", darts: 2 });
  });
  it("checks out on the bullseye", () => {
    expect(dartWalkJudge(at(50), turn([25, "INNER_BULL", 50]))).toEqual({
      kind: "CHECKOUT",
      darts: 1,
    });
  });
  it("busts on an overshoot, on 1 left, and on zero off a single", () => {
    expect(dartWalkJudge(at(40), turn([20, "TREBLE", 60]))).toEqual({
      kind: "BUST",
    });
    expect(dartWalkJudge(at(21), turn([20, "SINGLE", 20]))).toEqual({
      kind: "BUST",
    });
    expect(dartWalkJudge(at(20), turn([20, "SINGLE", 20]))).toEqual({
      kind: "BUST",
    });
  });
  it("walks from the seat's visit start, not its target", () => {
    const seat = { ...at(61), visitStart: 16 };
    expect(dartWalkJudge(seat, turn([8, "DOUBLE", 16]))).toEqual({
      kind: "CHECKOUT",
      darts: 1,
    });
  });
  it("a third dart short of zero spends the visit; fewer keep it open", () => {
    expect(
      dartWalkJudge(
        at(61),
        turn([null, "MISS", 0], [1, "SINGLE", 1], [null, "MISS", 0]),
      ),
    ).toEqual({ kind: "SPENT", remaining: 60 });
    expect(dartWalkJudge(at(61), turn([20, "SINGLE", 20]))).toEqual({
      kind: "OPEN",
      remaining: 41,
      darts: 1,
    });
    expect(dartWalkJudge(at(61), turn())).toEqual({
      kind: "OPEN",
      remaining: 61,
      darts: 0,
    });
  });
});

describe("consecutiveTargets", () => {
  it("steps one up until the last target has been attempted", () => {
    const next = consecutiveTargets(100);
    expect(next(at(61))).toBe(62);
    expect(next(at(100))).toBeNull();
  });
});

describe("unreachableFails", () => {
  it("fails an open visit whose remainder the darts left cannot finish", () => {
    expect(unreachableFails(at(155), turn([1, "SINGLE", 1]))).toEqual({
      kind: "FAIL",
    });
    expect(
      unreachableFails(at(40), turn([19, "SINGLE", 19], [2, "SINGLE", 2])),
    ).toEqual({ kind: "FAIL" });
  });
  it("keeps an open visit open while a finish stays reachable", () => {
    expect(
      unreachableFails(at(40), turn([null, "MISS", 0], [null, "MISS", 0])),
    ).toEqual({ kind: "OPEN", remaining: 40, darts: 2 });
  });
  it("keeps an empty visit open, even on an unreachable start", () => {
    expect(unreachableFails(at(169), turn())).toEqual({
      kind: "OPEN",
      remaining: 169,
      darts: 0,
    });
  });
  it("passes a checkout, a bust and a spent visit through", () => {
    expect(unreachableFails(at(40), turn([20, "DOUBLE", 40]))).toEqual({
      kind: "CHECKOUT",
      darts: 1,
    });
    expect(unreachableFails(at(40), turn([20, "TREBLE", 60]))).toEqual({
      kind: "BUST",
    });
    expect(
      unreachableFails(
        at(40),
        turn([null, "MISS", 0], [null, "MISS", 0], [null, "MISS", 0]),
      ),
    ).toEqual({ kind: "SPENT", remaining: 40 });
  });
});

describe("seeded draws", () => {
  const POOL = [10, 20, 30, 40, 50];
  it("draws from the pool, stable per seed and index", () => {
    for (let index = 0; index < 20; index++) {
      const drawn = seededPoolDraw(42, POOL, index);
      expect(POOL).toContain(drawn);
      expect(seededPoolDraw(42, POOL, index)).toBe(drawn);
    }
  });
  it("the next target is the draw for the next attempt index", () => {
    const seat = { ...at(10), attemptIndex: 3 };
    expect(seededDrawTarget(42, POOL)(seat)).toBe(seededPoolDraw(42, POOL, 4));
  });
});
