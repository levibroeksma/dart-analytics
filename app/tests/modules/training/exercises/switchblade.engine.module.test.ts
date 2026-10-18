import { describe, expect, it } from "vitest";
import {
  foldSwitchbladeState,
  SWITCHBLADE_PATH,
  switchbladeEngineFactory,
  SwitchbladeEngine,
  switchbladeIntent,
  switchbladeRoundSlots,
} from "@modules/training/exercises/switchblade.engine.module";
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
const T = (n: number) => dart(n, "TREBLE");
const times = (n: number, d: DartObservation) =>
  Array.from({ length: n }, () => d);
const PERFECT_PASS = [
  T(20),
  T(20),
  T(20),
  T(20),
  T(20),
  T(19),
  T(20),
  T(20),
  T(18),
  T(20),
  T(20),
  T(17),
  T(20),
  T(20),
  dart(25, "INNER_BULL"),
];
const TREBLE_20 = { kind: "TREBLE", number: 20 } as const;

function play(engine: SwitchbladeEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("SwitchBlade engine", () => {
  it("starts on round one's first slot", () => {
    expect(new SwitchbladeEngine({}).state()).toEqual({
      currentSlot: TREBLE_20,
      slotIndex: 0,
      round: 1,
      total: 0,
      roundTotals: [0, 0, 0, 0, 0],
      passes: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("lays out five rounds: T20, T20, then the switch", () => {
    expect(SWITCHBLADE_PATH).toHaveLength(15);
    expect(switchbladeRoundSlots(1)).toEqual([
      TREBLE_20,
      TREBLE_20,
      { kind: "TREBLE", number: 19 },
    ]);
    expect(switchbladeRoundSlots(4)[2]).toEqual({ kind: "BULL" });
    expect(switchbladeRoundSlots(5)).toEqual(switchbladeRoundSlots(0));
  });

  it("scores board value on the slot's number in any ring", () => {
    const state = play(new SwitchbladeEngine({}), [
      T(20),
      dart(20, "SINGLE"),
      dart(20, "DOUBLE"),
    ]);
    expect(state.total).toBe(120);
    expect(state.roundTotals).toEqual([120, 0, 0, 0, 0]);
    expect(state.hits).toBe(3);
  });

  it("scores nothing off the slot's number", () => {
    const state = play(new SwitchbladeEngine({}), [...times(5, MISS), T(20)]);
    expect(state.total).toBe(0);
    expect(state.hits).toBe(0);
    expect(state.round).toBe(3);
  });

  it("switches the slot mid-visit and stamps each dart with its own slot", () => {
    const engine = new SwitchbladeEngine({});
    const state = play(engine, times(5, MISS));
    expect(state.currentSlot).toEqual({ kind: "TREBLE", number: 19 });
    expect(state.round).toBe(2);
    engine.record(T(19));
    expect(
      engine
        .facts()
        .turns[1]!.darts.map((d) => [
          d.intendedTargetNumber,
          d.intendedZoneKey,
        ]),
    ).toEqual([
      [20, "TREBLE"],
      [20, "TREBLE"],
      [19, "TREBLE"],
    ]);
    expect(engine.state().roundTotals[1]).toBe(57);
  });

  it("bull slot scores either bull", () => {
    const outer = play(new SwitchbladeEngine({}), [
      ...times(14, MISS),
      dart(25, "OUTER_BULL"),
    ]);
    expect(outer.total).toBe(25);
    const inner = play(new SwitchbladeEngine({}), [
      ...times(14, MISS),
      dart(25, "INNER_BULL"),
    ]);
    expect(inner.total).toBe(50);
    const twenty = play(new SwitchbladeEngine({}), [...times(14, MISS), T(20)]);
    expect(twenty.total).toBe(0);
    const engine = new SwitchbladeEngine({});
    play(engine, times(15, MISS));
    expect(engine.facts().turns[4]!.darts[2]).toMatchObject({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("wraps after the bull slot and keeps round five's points", () => {
    const state = play(new SwitchbladeEngine({}), [
      ...times(14, MISS),
      dart(25, "INNER_BULL"),
    ]);
    expect(state.passes).toBe(1);
    expect(state.slotIndex).toBe(0);
    expect(state.round).toBe(1);
    expect(state.currentSlot).toEqual(TREBLE_20);
    expect(state.roundTotals).toEqual([0, 0, 0, 0, 50]);
  });

  it("a perfect pass totals 872 and two passes sum per round", () => {
    const one = play(new SwitchbladeEngine({}), PERFECT_PASS);
    expect(one.total).toBe(872);
    expect(one.roundTotals).toEqual([180, 177, 174, 171, 170]);
    const two = play(new SwitchbladeEngine({}), [
      ...PERFECT_PASS,
      ...PERFECT_PASS,
    ]);
    expect(two.roundTotals).toEqual([360, 354, 348, 342, 340]);
    expect(two.passes).toBe(2);
    expect(two.hits).toBe(30);
    expect(two.dartsThrown).toBe(30);
  });

  it("writes one turn per three-dart round", () => {
    const engine = new SwitchbladeEngine({});
    play(engine, times(7, MISS));
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 1,
    ]);
  });

  it("undo across a pass wrap restores the end of pass 1", () => {
    const engine = new SwitchbladeEngine({});
    const before = play(engine, PERFECT_PASS);
    engine.record(T(20));
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual(before);
  });

  it("rehydrates mid-visit at the switch", () => {
    const engine = new SwitchbladeEngine({});
    const state = play(engine, [...times(3, T(20)), T(20), MISS]);
    const rebuilt = new SwitchbladeEngine({}, engine.facts());
    expect(rebuilt.state()).toEqual(state);
    rebuilt.record(T(19));
    expect(rebuilt.facts().turns[1]!.darts[2]).toMatchObject({
      intendedTargetNumber: 19,
      intendedZoneKey: "TREBLE",
    });
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new SwitchbladeEngine({});
    play(engine, times(45, MISS));
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a non-empty config", () => {
    expect(() => new SwitchbladeEngine({ path: [] } as never)).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new SwitchbladeEngine({});
    const state = play(engine, [T(20), MISS, dart(20, "SINGLE"), T(20)]);
    expect(foldSwitchbladeState(engine.facts(), {}, false)).toEqual(state);
  });

  it("switchbladeIntent aims at the treble, or the bullseye on the bull slot", () => {
    expect(switchbladeIntent({ kind: "TREBLE", number: 18 })).toEqual({
      intendedTargetNumber: 18,
      intendedZoneKey: "TREBLE",
    });
    expect(switchbladeIntent({ kind: "BULL" })).toEqual({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("SWITCHBLADE_V1")).toBe(
      switchbladeEngineFactory,
    );
  });

  it("produces an events batch the API accepts", () => {
    const engine = new SwitchbladeEngine({});
    play(engine, [T(20), MISS, dart(20, "SINGLE"), MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
