import { describe, expect, it } from "vitest";
import {
  HALVE_IT_PATH,
  HalveItEngine,
  foldHalveItState,
  halveItEngineFactory,
} from "@modules/training/exercises/halve-it.engine.module";
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
const BLANK = [MISS, MISS, MISS];
const S = (n: number) => dart(n, "SINGLE");
const D = (n: number) => dart(n, "DOUBLE");
const T = (n: number) => dart(n, "TREBLE");
const BULLSEYE = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");
const visit = (first: DartObservation) => [first, MISS, MISS];
const TO_95 = [
  ...visit(S(20)),
  ...visit(D(16)),
  ...visit(D(13)),
  ...visit(S(17)),
];

function play(engine: HalveItEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("Halve-It engine", () => {
  it("starts on 20, round 1, total 0", () => {
    const state = new HalveItEngine({}).state();
    expect(state).toMatchObject({
      currentTarget: { kind: "NUMBER", number: 20 },
      targetIndex: 0,
      round: 1,
      total: 0,
      passes: 0,
      halvings: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
    expect(state.hitsPerTarget).toHaveLength(9);
  });

  it("walks 20, 16, any double, 17, 18, any treble, 19, 20, bull", () => {
    expect(HALVE_IT_PATH).toEqual([
      { kind: "NUMBER", number: 20 },
      { kind: "NUMBER", number: 16 },
      { kind: "ANY_DOUBLE" },
      { kind: "NUMBER", number: 17 },
      { kind: "NUMBER", number: 18 },
      { kind: "ANY_TREBLE" },
      { kind: "NUMBER", number: 19 },
      { kind: "NUMBER", number: 20 },
      { kind: "BULL" },
    ]);
  });

  it("any ring of the round's number scores its board value", () => {
    expect(play(new HalveItEngine({}), [T(20), S(20), D(20)]).total).toBe(120);
  });

  it("only the round's number scores", () => {
    const state = play(new HalveItEngine({}), [
      S(20),
      MISS,
      MISS,
      S(5),
      T(20),
      MISS,
    ]);
    expect(state.total).toBe(10);
    expect(state.halvings).toBe(1);
  });

  it("a blank visit halves an odd total rounding up: 95 → 48", () => {
    const engine = new HalveItEngine({});
    expect(play(engine, TO_95).total).toBe(95);
    expect(play(engine, BLANK)).toMatchObject({ total: 48, halvings: 1 });
  });

  it("halving at 0 leaves 0 and still counts", () => {
    expect(play(new HalveItEngine({}), BLANK)).toMatchObject({
      total: 0,
      halvings: 1,
    });
  });

  it("the bullseye counts in Any double; the outer bull does not", () => {
    const engine = new HalveItEngine({});
    play(engine, [...visit(S(20)), ...visit(S(16))]);
    expect(play(engine, [BULLSEYE, OUTER, MISS]).total).toBe(86);
    const blank = new HalveItEngine({});
    play(blank, [...visit(S(20)), ...visit(S(16))]);
    expect(play(blank, [OUTER, MISS, MISS])).toMatchObject({
      total: 18,
      halvings: 1,
    });
  });

  it("any treble scores in Any treble; a double does not count there", () => {
    const engine = new HalveItEngine({});
    play(engine, [
      ...visit(S(20)),
      ...visit(S(16)),
      ...visit(D(1)),
      ...visit(S(17)),
      ...visit(S(18)),
    ]);
    expect(play(engine, [T(19), D(19), MISS]).total).toBe(130);
  });

  it("the bull round scores 25 and 50", () => {
    const engine = new HalveItEngine({});
    play(
      engine,
      [20, 16].flatMap((n) => visit(S(n))),
    );
    play(engine, visit(D(1)));
    play(
      engine,
      [17, 18].flatMap((n) => visit(S(n))),
    );
    play(engine, visit(T(1)));
    play(
      engine,
      [19, 20].flatMap((n) => visit(S(n))),
    );
    expect(engine.state().currentTarget).toEqual({ kind: "BULL" });
    expect(play(engine, [OUTER, BULLSEYE, MISS]).total).toBe(
      20 + 16 + 2 + 17 + 18 + 3 + 19 + 20 + 75,
    );
  });

  it("a pass restarts at 20 and carries the total", () => {
    const engine = new HalveItEngine({});
    play(engine, visit(T(20)));
    for (let i = 0; i < 8; i++) play(engine, BLANK);
    expect(engine.state()).toMatchObject({
      passes: 1,
      round: 1,
      currentTarget: { kind: "NUMBER", number: 20 },
      total: 1,
      halvings: 8,
    });
    expect(play(engine, visit(S(20))).total).toBe(21);
  });

  it("sums hits per path index over every pass", () => {
    const engine = new HalveItEngine({});
    play(engine, [S(20), S(20), MISS]);
    for (let i = 0; i < 8; i++) play(engine, BLANK);
    const state = play(engine, [S(20), MISS, MISS]);
    expect(state.hitsPerTarget[0].hits).toBe(3);
    expect(state.hitsPerTarget[7].hits).toBe(0);
    expect(state.hits).toBe(3);
  });

  it("aims a number or the bull at no bed, a zone at its ring", () => {
    const engine = new HalveItEngine({});
    play(engine, [
      ...BLANK,
      ...BLANK,
      ...BLANK,
      ...BLANK,
      ...BLANK,
      ...BLANK,
      ...BLANK,
      ...BLANK,
      MISS,
    ]);
    const intents = engine
      .facts()
      .turns.map((turn) => [
        turn.darts[0].intendedTargetNumber,
        turn.darts[0].intendedZoneKey,
      ]);
    expect(intents).toEqual([
      [null, null],
      [null, null],
      [null, "DOUBLE"],
      [null, null],
      [null, null],
      [null, "TREBLE"],
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it("writes one turn per three-dart visit", () => {
    const engine = new HalveItEngine({});
    play(engine, [MISS, MISS, MISS, MISS, MISS, MISS, MISS]);
    expect(engine.facts().turns.map((turn) => turn.darts.length)).toEqual([
      3, 3, 1,
    ]);
  });

  it("undo restores the total a halving took", () => {
    const engine = new HalveItEngine({});
    play(engine, [...TO_95, ...BLANK]);
    expect(engine.state().total).toBe(48);
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toMatchObject({ total: 95, halvings: 0 });
  });

  it("rehydrates mid-visit", () => {
    const engine = new HalveItEngine({});
    const state = play(engine, [S(20), MISS, MISS, D(16)]);
    const rebuilt = new HalveItEngine({}, engine.facts());
    expect(rebuilt.state()).toEqual(state);
  });

  it("completes only on timer expiry and refuses darts after it", () => {
    const engine = new HalveItEngine({});
    play(
      engine,
      Array.from({ length: 27 }, () => MISS),
    );
    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(MISS)).toThrow();
  });

  it("refuses a non-empty config", () => {
    expect(() => new HalveItEngine({ startTotal: 40 } as never)).toThrow();
  });

  it("folds state from a fact log without an engine", () => {
    const engine = new HalveItEngine({});
    const state = play(engine, [...TO_95, MISS]);
    expect(foldHalveItState(engine.facts(), {}, false)).toEqual(state);
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("HALVE_IT_V1")).toBe(
      halveItEngineFactory,
    );
  });

  it("produces an events batch the API accepts, zone intents included", () => {
    const engine = new HalveItEngine({});
    play(engine, [...BLANK, ...BLANK, D(5), MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
