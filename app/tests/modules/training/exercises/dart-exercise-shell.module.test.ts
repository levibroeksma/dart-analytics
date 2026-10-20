import { describe, it, expect } from "vitest";
import {
  dartExerciseEngineClass,
  dartExerciseEngineFactory,
} from "@modules/training/exercises/dart-exercise-shell.module";
import type { DartExerciseSpec } from "@modules/interfaces";
import type { DartObservation } from "@modules/types";

type Toy = { darts: number; expired: boolean };
const spec: DartExerciseSpec<{ n: number }, Toy> = {
  exerciseRulesetVersionKey: "TARGET_SCORING_V1",
  parse: (c) => ({ n: c.n }),
  fold: (facts, _c, expired) => ({
    darts: facts.turns.reduce((s, t) => s + t.darts.length, 0),
    expired,
  }),
  intent: () => ({ intendedTargetNumber: 20, intendedZoneKey: "TREBLE" }),
  isVisitOpen: (t) => t.darts.length < 3,
};
const T20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: null,
  locationY: null,
};
const Toy = dartExerciseEngineClass(spec);

describe("dartExerciseEngineClass", () => {
  it("records as the solo participant in 3-dart visits", () => {
    const e = new Toy({ n: 1 });
    [T20, T20, T20, T20].forEach((o) => e.record(o));
    const turns = e.facts().turns;
    expect(turns.map((t) => t.darts.length)).toEqual([3, 1]);
    expect(turns[0].participantRef).toBe("solo");
    expect(turns[0].completedAt).not.toBeNull();
  });

  it("expireTimer completes; record then throws and leaves facts alone", () => {
    const e = new Toy({ n: 1 });
    e.record(T20);
    e.expireTimer();
    expect(e.isComplete()).toBe(true);
    expect(e.state().expired).toBe(true);
    const before = e.facts();
    expect(() => e.record(T20)).toThrow(
      "Cannot record a dart once the exercise is complete; undo first to correct it.",
    );
    expect(e.facts()).toEqual(before);
  });

  it("undo after expiry un-expires without popping a dart", () => {
    const e = new Toy({ n: 1 });
    e.record(T20);
    e.expireTimer();
    expect(e.undo()).toBe(true);
    expect(e.isComplete()).toBe(false);
    expect(e.facts().turns[0].darts).toHaveLength(1);
    expect(() => e.record(T20)).not.toThrow();
  });

  it("factory carries the key and builds the class", () => {
    const f = dartExerciseEngineFactory(spec, Toy);
    expect(f.exerciseRulesetVersionKey).toBe("TARGET_SCORING_V1");
    expect(f.create({ n: 1 })).toBeInstanceOf(Toy);
  });
});
