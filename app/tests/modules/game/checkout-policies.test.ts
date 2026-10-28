import { describe, it, expect } from "vitest";
import {
  consecutiveTargets,
  dartWalkJudge,
  ladderTarget,
  seededDrawTarget,
  seededPoolDraw,
  storedTotalJudge,
  unreachableFails,
  untilWon,
  walkTotalJudge,
  winAtCap,
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

const turnOf = (over: Partial<TurnFact>): TurnFact => ({
  clientKey: "t",
  stageClientKey: "s",
  participantRef: "p1",
  sequence: 1,
  completedAt: "2026-11-01T10:00:00Z",
  totalScore: 0,
  darts: [],
  ...over,
});

describe("storedTotalJudge", () => {
  const seat = initialCheckoutSeat(41, null);
  const dart = (score: number) =>
    ({ score, hitZoneKey: "OUTER_SINGLE" }) as TurnFact["darts"][number];

  it("shows an unstamped turn open at the live remainder", () => {
    expect(
      storedTotalJudge(
        seat,
        turnOf({ completedAt: null, darts: [dart(20), dart(1)] }),
      ),
    ).toEqual({ kind: "OPEN", remaining: 20, darts: 2 });
  });

  it("checks out a closed turn with a positive stored total", () => {
    expect(
      storedTotalJudge(seat, turnOf({ totalScore: 41, darts: [dart(41)] })),
    ).toEqual({
      kind: "CHECKOUT",
      darts: 1,
    });
  });

  it("fails a closed turn stored as 0", () => {
    expect(storedTotalJudge(seat, turnOf({ totalScore: 0 }))).toEqual({
      kind: "FAIL",
    });
  });
});

describe("ladderTarget", () => {
  const step = ladderTarget(10, 1, 2, 170);
  const onTarget = (target: number) => ({
    ...initialCheckoutSeat(target, null),
    target,
  });

  it("climbs by `up` on a pass and falls by `down` on a miss", () => {
    expect(step(onTarget(41), true)).toBe(51);
    expect(step(onTarget(41), false)).toBe(40);
  });

  it("clamps at the cap and the floor", () => {
    expect(step(onTarget(165), true)).toBe(170);
    expect(step(onTarget(2), false)).toBe(2);
    expect(ladderTarget(0, 30, 2, 170)(onTarget(10), false)).toBe(2);
  });
});

describe("walkTotalJudge", () => {
  const seat = initialCheckoutSeat(121, null);
  const dart = (score: number) =>
    ({ score, hitZoneKey: "OUTER_SINGLE" }) as TurnFact["darts"][number];

  it("shows an unstamped turn open at the visit's start less its darts", () => {
    expect(
      walkTotalJudge(
        seat,
        turnOf({ completedAt: null, darts: [dart(20), dart(20)] }),
      ),
    ).toEqual({ kind: "OPEN", remaining: 81, darts: 2 });
  });

  it("checks out a stored total equal to the visit's start", () => {
    expect(
      walkTotalJudge(seat, turnOf({ totalScore: 121, darts: [dart(121)] })),
    ).toEqual({ kind: "CHECKOUT", darts: 1 });
  });

  it("spends a visit at the remainder, a stored 0 at the visit's start", () => {
    expect(walkTotalJudge(seat, turnOf({ totalScore: 0 }))).toEqual({
      kind: "SPENT",
      remaining: 121,
    });
    expect(walkTotalJudge(seat, turnOf({ totalScore: 60 }))).toEqual({
      kind: "SPENT",
      remaining: 61,
    });
  });

  it("busts a total that leaves 1 or overshoots", () => {
    expect(walkTotalJudge(seat, turnOf({ totalScore: 120 }))).toEqual({
      kind: "BUST",
    });
    expect(walkTotalJudge(seat, turnOf({ totalScore: 130 }))).toEqual({
      kind: "BUST",
    });
  });
});

describe("winAtCap", () => {
  const onTarget = (target: number) => ({
    ...initialCheckoutSeat(target, null),
    target,
  });

  it("marks a pass at the cap WON and leaves every other close alone", () => {
    expect(winAtCap(170)(onTarget(170), true).status).toBe("WON");
    expect(winAtCap(170)(onTarget(169), true)).toEqual(onTarget(169));
    expect(winAtCap(170)(onTarget(170), false)).toEqual(onTarget(170));
  });
});

describe("untilWon", () => {
  const next = untilWon(ladderTarget(1, 0, 121, 170));

  it("names no next target for a WON seat and delegates otherwise", () => {
    const seat = { ...initialCheckoutSeat(170, null), target: 170 };
    expect(next({ ...seat, status: "WON" }, true)).toBeNull();
    expect(next({ ...seat, target: 150 }, true)).toBe(151);
  });
});
