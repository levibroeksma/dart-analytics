import { describe, expect, it } from "vitest";
import {
  foldHitCountState,
  hitCountEngineFactory,
  HitCountEngine,
  hitCountIntent,
} from "@modules/training/exercises/hit-count.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";
import type { HitCountConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const T = (number: number) => ({ kind: "TREBLE", number }) as const;
const BIG_TREBLES: HitCountConfigData = {
  targets: [T(20), T(19), T(18), T(17)],
  dartsPerTarget: 9,
};
const SHORT: HitCountConfigData = {
  targets: [T(20), { kind: "DOUBLE", number: 16 }],
  dartsPerTarget: 3,
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}
const MISS = dart(null, "MISS");
const times = (n: number, d: DartObservation) =>
  Array.from({ length: n }, () => d);

function play(engine: HitCountEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("Hit Count engine", () => {
  it("starts on the first target with its full darts", () => {
    expect(new HitCountEngine(BIG_TREBLES).state()).toEqual({
      currentTarget: T(20),
      targetIndex: 0,
      dartsLeftOnTarget: 9,
      hits: 0,
      dartsThrown: 0,
      hitsPerTarget: BIG_TREBLES.targets.map((target) => ({ target, hits: 0 })),
      passes: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts only the named bed", () => {
    const state = play(new HitCountEngine(BIG_TREBLES), [
      dart(20, "TREBLE"),
      dart(20, "SINGLE"),
      dart(20, "DOUBLE"),
    ]);
    expect(state.hits).toBe(1);
    expect(state.dartsThrown).toBe(3);
  });

  it("counts darts left mid-visit", () => {
    const state = play(new HitCountEngine(BIG_TREBLES), [MISS, MISS]);
    expect(state.dartsLeftOnTarget).toBe(7);
    expect(state.currentTarget).toEqual(T(20));
  });

  it("moves to the next target after its darts", () => {
    const state = play(
      new HitCountEngine(BIG_TREBLES),
      times(9, dart(20, "TREBLE")),
    );
    expect(state.currentTarget).toEqual(T(19));
    expect(state.dartsLeftOnTarget).toBe(9);
    expect(state.hitsPerTarget[0]!.hits).toBe(9);
  });

  it("wraps to the first target and counts a pass", () => {
    const state = play(new HitCountEngine(SHORT), [
      ...times(3, dart(20, "TREBLE")),
      ...times(3, dart(16, "DOUBLE")),
    ]);
    expect(state.passes).toBe(1);
    expect(state.targetIndex).toBe(0);
    expect(state.dartsLeftOnTarget).toBe(3);
  });

  it("sums hits per target over every pass", () => {
    const pass = [
      ...times(3, dart(20, "TREBLE")),
      dart(16, "DOUBLE"),
      MISS,
      MISS,
    ];
    const state = play(new HitCountEngine(SHORT), [...pass, ...pass]);
    expect(state.hitsPerTarget.map((entry) => entry.hits)).toEqual([6, 2]);
    expect(state.hits).toBe(8);
    expect(state.passes).toBe(2);
  });

  it("bull target counts the bullseye only", () => {
    const engine = new HitCountEngine({
      targets: [{ kind: "BULL" }],
      dartsPerTarget: 3,
    });
    const state = play(engine, [
      dart(25, "INNER_BULL"),
      dart(25, "OUTER_BULL"),
      MISS,
    ]);
    expect(state.hits).toBe(1);
    expect(engine.facts().turns[0]!.darts[0]).toMatchObject({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("stamps each dart with the target's bed", () => {
    const engine = new HitCountEngine(SHORT);
    play(engine, [...times(3, MISS), MISS]);
    const [first, second] = engine.facts().turns;
    expect(first!.darts[0]).toMatchObject({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
    });
    expect(second!.darts[0]).toMatchObject({
      intendedTargetNumber: 16,
      intendedZoneKey: "DOUBLE",
    });
  });

  it("writes one turn per three-dart visit", () => {
    const engine = new HitCountEngine(BIG_TREBLES);
    play(engine, times(7, MISS));
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 1,
    ]);
  });

  it("undo across a pass wrap restores the last visit of pass 1", () => {
    const engine = new HitCountEngine(SHORT);
    const before = play(engine, [
      ...times(3, dart(20, "TREBLE")),
      ...times(3, dart(16, "DOUBLE")),
    ]);
    engine.record(dart(20, "TREBLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("rehydrates mid-target", () => {
    const engine = new HitCountEngine(BIG_TREBLES);
    const state = play(engine, [...times(4, dart(20, "TREBLE")), MISS]);
    expect(new HitCountEngine(BIG_TREBLES, engine.facts()).state()).toEqual(
      state,
    );
    expect(state.dartsLeftOnTarget).toBe(4);
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new HitCountEngine(SHORT);
    play(engine, times(30, MISS));
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a config whose darts per target is not a multiple of three", () => {
    expect(() => new HitCountEngine({ ...SHORT, dartsPerTarget: 4 })).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new HitCountEngine(SHORT);
    const state = play(engine, [dart(20, "TREBLE"), MISS]);
    expect(foldHitCountState(engine.facts(), SHORT, false)).toEqual(state);
  });

  it("hitCountIntent aims at the target's bed", () => {
    expect(hitCountIntent(T(19))).toEqual({
      intendedTargetNumber: 19,
      intendedZoneKey: "TREBLE",
    });
    expect(hitCountIntent({ kind: "DOUBLE", number: 8 })).toEqual({
      intendedTargetNumber: 8,
      intendedZoneKey: "DOUBLE",
    });
    expect(hitCountIntent({ kind: "BULL" })).toEqual({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("HIT_COUNT_V1")).toBe(
      hitCountEngineFactory,
    );
  });

  it("produces an events batch the API accepts", () => {
    const engine = new HitCountEngine(BIG_TREBLES);
    play(engine, [dart(20, "TREBLE"), MISS, dart(20, "SINGLE"), MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
