import { describe, expect, it } from "vitest";
import {
  DOUBLES_LOCK_PATH,
  DoublesLockEngine,
  doublesLockEngineFactory,
  foldDoublesLockState,
} from "@modules/training/exercises/doubles-lock.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";
import type { DartObservation } from "@modules/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}
const MISS = dart(null, "MISS");
const D = (n: number) => dart(n, "DOUBLE");
const double = (number: number) => ({ kind: "DOUBLE", number }) as const;
const times = (n: number, d: DartObservation) =>
  Array.from({ length: n }, () => d);
const LADDER = Array.from({ length: 20 }, (_, i) => 20 - i);
const PERFECT_PASS = LADDER.flatMap((n) => times(3, D(n)));
const SLOW_PASS = [
  ...times(3, MISS),
  ...LADDER.flatMap((n) => [D(n), MISS, MISS]),
];

function play(engine: DoublesLockEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("Doubles Lock engine", () => {
  it("starts on D20 with no lock", () => {
    expect(new DoublesLockEngine({}).state()).toEqual({
      currentDouble: double(20),
      targetIndex: 0,
      lastLock: null,
      bonus: 0,
      locks: 0,
      passes: 0,
      dartsPerPass: [],
      bestPassDarts: null,
      dartsThisPass: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("walks D20 down to D1", () => {
    expect(DOUBLES_LOCK_PATH).toHaveLength(20);
    expect(DOUBLES_LOCK_PATH[0]).toEqual(double(20));
    expect(DOUBLES_LOCK_PATH[19]).toEqual(double(1));
  });

  it("one hit advances without a lock", () => {
    const state = play(new DoublesLockEngine({}), [D(20), MISS, MISS]);
    expect(state.currentDouble).toEqual(double(19));
    expect(state.lastLock).toBeNull();
    expect(state.bonus).toBe(0);
    expect(state.locks).toBe(0);
    expect(state.hits).toBe(1);
  });

  it("two hits lock for 50, three for 100", () => {
    const two = play(new DoublesLockEngine({}), [D(20), D(20), MISS]);
    expect(two.currentDouble).toEqual(double(19));
    expect(two.lastLock).toEqual(double(20));
    expect(two.bonus).toBe(50);
    expect(two.locks).toBe(1);
    const three = play(new DoublesLockEngine({}), times(3, D(20)));
    expect(three.bonus).toBe(100);
    expect(three.locks).toBe(1);
  });

  it("only the double counts", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20),
      MISS,
      MISS,
      dart(19, "TREBLE"),
      dart(19, "SINGLE"),
      D(20),
    ]);
    expect(state.hits).toBe(1);
    expect(state.currentDouble).toEqual(double(20));
  });

  it("retreats to D20 before any lock", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20),
      MISS,
      MISS,
      ...times(3, MISS),
    ]);
    expect(state.currentDouble).toEqual(double(20));
    expect(state.dartsThisPass).toBe(6);
  });

  it("retreats to the last locked double", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20),
      MISS,
      MISS,
      D(19),
      D(19),
      MISS,
      D(18),
      MISS,
      MISS,
      ...times(3, MISS),
    ]);
    expect(state.currentDouble).toEqual(double(19));
    expect(state.lastLock).toEqual(double(19));
    expect(state.bonus).toBe(50);
  });

  it("re-locking after a retreat pays again", () => {
    const state = play(new DoublesLockEngine({}), [
      D(20),
      MISS,
      MISS,
      D(19),
      D(19),
      MISS,
      D(18),
      MISS,
      MISS,
      ...times(3, MISS),
      ...times(3, D(19)),
    ]);
    expect(state.bonus).toBe(150);
    expect(state.locks).toBe(2);
    expect(state.currentDouble).toEqual(double(18));
  });

  it("a perfect pass is 60 darts and 2,000 bonus, then restarts at D20", () => {
    const state = play(new DoublesLockEngine({}), PERFECT_PASS);
    expect(state).toMatchObject({
      currentDouble: double(20),
      targetIndex: 0,
      lastLock: null,
      bonus: 2000,
      locks: 20,
      passes: 1,
      dartsPerPass: [60],
      bestPassDarts: 60,
      dartsThisPass: 0,
      hits: 60,
      dartsThrown: 60,
    });
  });

  it("a lock on D1 pays then wraps", () => {
    const state = play(new DoublesLockEngine({}), [
      ...LADDER.slice(0, 19).flatMap((n) => [D(n), MISS, MISS]),
      D(1),
      D(1),
      MISS,
    ]);
    expect(state.bonus).toBe(50);
    expect(state.locks).toBe(1);
    expect(state.passes).toBe(1);
    expect(state.lastLock).toBeNull();
    expect(state.dartsPerPass).toEqual([60]);
    expect(state.currentDouble).toEqual(double(20));
  });

  it("a pass clears the last lock", () => {
    const state = play(new DoublesLockEngine({}), [
      ...PERFECT_PASS,
      D(20),
      MISS,
      MISS,
      ...times(3, MISS),
    ]);
    expect(state.currentDouble).toEqual(double(20));
    expect(state.lastLock).toBeNull();
  });

  it("best pass is the fewest darts", () => {
    const state = play(new DoublesLockEngine({}), [
      ...SLOW_PASS,
      ...PERFECT_PASS,
    ]);
    expect(state.passes).toBe(2);
    expect(state.dartsPerPass).toEqual([63, 60]);
    expect(state.bestPassDarts).toBe(60);
    expect(state.dartsThrown).toBe(123);
    expect(state.hits).toBe(80);
  });

  it("counts the open visit in darts this pass", () => {
    const state = play(new DoublesLockEngine({}), [D(20), MISS]);
    expect(state.dartsThisPass).toBe(2);
    expect(state.currentDouble).toEqual(double(20));
  });

  it("aims every dart at the current double", () => {
    const engine = new DoublesLockEngine({});
    play(engine, [D(20), MISS, MISS, MISS]);
    expect(
      engine
        .facts()
        .turns.flatMap((turn) =>
          turn.darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey]),
        ),
    ).toEqual([
      [20, "DOUBLE"],
      [20, "DOUBLE"],
      [20, "DOUBLE"],
      [19, "DOUBLE"],
    ]);
  });

  it("writes one turn per three-dart visit", () => {
    const engine = new DoublesLockEngine({});
    play(engine, times(7, MISS));
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 1,
    ]);
  });

  it("undo across a pass wrap restores the end of pass 1", () => {
    const engine = new DoublesLockEngine({});
    const before = play(engine, PERFECT_PASS);
    engine.record(D(20));
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("rehydrates mid-visit after a lock", () => {
    const engine = new DoublesLockEngine({});
    const state = play(engine, [D(20), D(20), MISS, D(19)]);
    const rebuilt = new DoublesLockEngine({}, engine.facts());
    expect(rebuilt.state()).toEqual(state);
    rebuilt.record(D(19));
    expect(rebuilt.facts().turns[1]!.darts[1]).toMatchObject({
      intendedTargetNumber: 19,
      intendedZoneKey: "DOUBLE",
    });
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new DoublesLockEngine({});
    play(engine, PERFECT_PASS);
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a non-empty config", () => {
    expect(() => new DoublesLockEngine({ lockHits: 3 } as never)).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new DoublesLockEngine({});
    const state = play(engine, [D(20), D(20), MISS, D(19), MISS]);
    expect(foldDoublesLockState(engine.facts(), {}, false)).toEqual(state);
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("DOUBLES_LOCK_V1")).toBe(
      doublesLockEngineFactory,
    );
  });

  it("produces an events batch the API accepts", () => {
    const engine = new DoublesLockEngine({});
    play(engine, [D(20), D(20), MISS, D(19)]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
