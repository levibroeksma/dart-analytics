import { describe, expect, it } from "vitest";
import {
  SNAKES_LADDERS_FINISH,
  SNAKES_LADDERS_MOVES,
  SNAKES_LADDERS_PATH,
  SnakesLaddersEngine,
  foldSnakesLaddersState,
  snakesLaddersEngineFactory,
} from "@modules/training/exercises/snakes-ladders.engine.module";
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
const S = (n: number) => dart(n, "SINGLE");
const BULLSEYE = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

function visitOf(hits: number, hit: DartObservation): DartObservation[] {
  return [
    ...Array.from({ length: hits }, () => hit),
    ...Array.from({ length: 3 - hits }, () => MISS),
  ];
}

function play(engine: SnakesLaddersEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

function climbTo(engine: SnakesLaddersEngine, levelNumber: number) {
  for (let level = 1; level < levelNumber; level += 1)
    play(engine, visitOf(3, D(level)));
  return engine;
}

function atBull(): SnakesLaddersEngine {
  const engine = climbTo(new SnakesLaddersEngine({}), 20);
  play(engine, visitOf(3, D(20)));
  return engine;
}

describe("Snakes & Ladders engine", () => {
  it("has a 21-level ladder, D1 to D20 then the bull", () => {
    expect(SNAKES_LADDERS_PATH).toHaveLength(21);
    expect(SNAKES_LADDERS_PATH[0]).toEqual({ kind: "DOUBLE", number: 1 });
    expect(SNAKES_LADDERS_PATH[19]).toEqual({ kind: "DOUBLE", number: 20 });
    expect(SNAKES_LADDERS_PATH[20]).toEqual({ kind: "BULL" });
    expect(SNAKES_LADDERS_MOVES).toEqual({ 0: -2, 1: -1, 2: 0, 3: 1 });
    expect(SNAKES_LADDERS_FINISH).toBe(3);
  });

  it("starts on D1, round 0, highest D1", () => {
    expect(new SnakesLaddersEngine({}).state()).toMatchObject({
      currentLevel: { kind: "DOUBLE", number: 1 },
      levelIndex: 0,
      highestLevel: { kind: "DOUBLE", number: 1 },
      highestLevelNumber: 1,
      rounds: 0,
      finishes: 0,
      hits: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("three hits climb one level", () => {
    const state = play(new SnakesLaddersEngine({}), visitOf(3, D(1)));
    expect(state).toMatchObject({ levelIndex: 1, rounds: 1, hits: 3 });
  });

  it("two hits stay; one hit slides back one; none slides back two", () => {
    const stay = climbTo(new SnakesLaddersEngine({}), 5);
    expect(play(stay, visitOf(2, D(5))).levelIndex).toBe(4);
    const slide = climbTo(new SnakesLaddersEngine({}), 5);
    expect(play(slide, visitOf(1, D(5))).levelIndex).toBe(3);
    const drop = climbTo(new SnakesLaddersEngine({}), 5);
    expect(play(drop, visitOf(0, D(5))).levelIndex).toBe(2);
  });

  it("never drops below D1", () => {
    expect(play(new SnakesLaddersEngine({}), visitOf(0, D(1))).levelIndex).toBe(
      0,
    );
    const engine = climbTo(new SnakesLaddersEngine({}), 2);
    expect(play(engine, visitOf(0, D(2))).levelIndex).toBe(0);
  });

  it("only the level's own double counts", () => {
    const state = play(new SnakesLaddersEngine({}), [D(7), S(1), D(1)]);
    expect(state.hits).toBe(1);
  });

  it("D20 with three hits climbs to the bull", () => {
    const engine = atBull();
    expect(engine.state()).toMatchObject({
      levelIndex: 20,
      currentLevel: { kind: "BULL" },
      highestLevelNumber: 21,
      status: "IN_PROGRESS",
    });
  });

  it("the bull with no hit drops two to D19", () => {
    const engine = atBull();
    const state = play(engine, visitOf(0, BULLSEYE));
    expect(state.levelIndex).toBe(18);
    expect(state.highestLevelNumber).toBe(21);
  });

  it("the outer bull does not count", () => {
    const engine = atBull();
    const before = engine.state().hits;
    const state = play(engine, [OUTER, OUTER, OUTER]);
    expect(state.hits).toBe(before);
    expect(state.levelIndex).toBe(18);
  });

  it("three bullseyes finish the run", () => {
    const engine = atBull();
    const state = play(engine, [BULLSEYE, BULLSEYE, BULLSEYE]);
    expect(state).toMatchObject({ finishes: 1, status: "COMPLETE" });
    expect(engine.isComplete()).toBe(true);
  });

  it("a finished run refuses further darts", () => {
    const engine = atBull();
    play(engine, [BULLSEYE, BULLSEYE, BULLSEYE]);
    expect(() => engine.record(MISS)).toThrow();
  });

  it("two bullseyes at the bull level stay", () => {
    const engine = atBull();
    const state = play(engine, visitOf(2, BULLSEYE));
    expect(state.levelIndex).toBe(20);
    expect(state.finishes).toBe(0);
  });

  it("three hits at D20 climb but do not finish", () => {
    const engine = climbTo(new SnakesLaddersEngine({}), 20);
    const state = play(engine, visitOf(3, D(20)));
    expect(state.finishes).toBe(0);
  });

  it("undo reopens a finished run", () => {
    const engine = atBull();
    play(engine, [BULLSEYE, BULLSEYE, BULLSEYE]);
    expect(engine.undo()).toBe(true);
    expect(engine.state()).toMatchObject({
      status: "IN_PROGRESS",
      levelIndex: 20,
    });
    expect(engine.isComplete()).toBe(false);
  });

  it("a run cut by time keeps the highest level", () => {
    const engine = climbTo(new SnakesLaddersEngine({}), 5);
    play(engine, visitOf(0, D(5)));
    play(engine, visitOf(1, D(3)));
    engine.expireTimer();
    expect(engine.state()).toMatchObject({
      highestLevelNumber: 5,
      currentLevel: { kind: "DOUBLE", number: 2 },
      status: "COMPLETE",
    });
  });

  it("rounds count closed visits only", () => {
    const state = play(new SnakesLaddersEngine({}), [
      ...visitOf(3, D(1)),
      ...visitOf(3, D(2)),
      D(3),
      D(3),
      D(3),
      MISS,
    ]);
    expect(state.rounds).toBe(3);
    expect(state.dartsThrown).toBe(10);
    const open = play(new SnakesLaddersEngine({}), [
      ...visitOf(3, D(1)),
      ...visitOf(3, D(2)),
      D(3),
    ]);
    expect(open.rounds).toBe(2);
    expect(open.dartsThrown).toBe(7);
  });

  it("intent is the level's double", () => {
    const engine = climbTo(new SnakesLaddersEngine({}), 2);
    engine.record(D(2));
    const last = engine.facts().turns.at(-1)!.darts.at(-1)!;
    expect(last).toMatchObject({
      intendedTargetNumber: 2,
      intendedZoneKey: "DOUBLE",
    });
    const bull = atBull();
    bull.record(BULLSEYE);
    const bullDart = bull.facts().turns.at(-1)!.darts.at(-1)!;
    expect(bullDart).toMatchObject({
      intendedTargetNumber: 25,
      intendedZoneKey: "INNER_BULL",
    });
  });

  it("registers its factory", () => {
    expect(getDartExerciseEngineFactory("DOUBLES_SNAKES_LADDERS_V1")).toBe(
      snakesLaddersEngineFactory,
    );
    expect(snakesLaddersEngineFactory.create({})).toBeInstanceOf(
      SnakesLaddersEngine,
    );
  });

  it("fold equals the engine's state", () => {
    const engine = climbTo(new SnakesLaddersEngine({}), 4);
    play(engine, visitOf(1, D(4)));
    expect(foldSnakesLaddersState(engine.facts(), {}, false)).toEqual(
      engine.state(),
    );
  });

  it("rejects a non-empty config", () => {
    expect(() => new SnakesLaddersEngine({ finish: 2 } as never)).toThrow();
  });

  it("undo is the exact inverse of record", () => {
    const engine = new SnakesLaddersEngine({});
    const initial = engine.state();
    const darts = [
      ...visitOf(3, D(1)),
      ...visitOf(1, D(2)),
      ...visitOf(0, D(1)),
      ...visitOf(2, D(1)),
      ...visitOf(3, D(1)),
      ...visitOf(3, D(2)),
      ...visitOf(1, D(3)),
      ...visitOf(0, D(2)),
      ...visitOf(3, D(1)),
      ...visitOf(2, D(2)),
      ...visitOf(3, D(2)),
      ...visitOf(3, D(3)),
      D(4),
    ];
    play(engine, darts);
    darts.forEach(() => engine.undo());
    expect(engine.state()).toEqual(initial);
  });

  it("produces an events batch the API accepts, bullseye intent included", () => {
    const engine = atBull();
    play(engine, [BULLSEYE, MISS, MISS]);
    expect(
      EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success,
    ).toBe(true);
  });
});
