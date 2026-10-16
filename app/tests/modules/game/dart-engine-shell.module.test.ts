import { describe, it, expect, vi, afterEach } from "vitest";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "@modules/game/dart-engine-shell.module";
import type { DartGameSpec } from "@modules/interfaces";
import type { DartObservation, EngineFacts } from "@modules/types";

type Toy = { activeParticipantRef: string; status: string; darts: number };

const spec: DartGameSpec<{ limit: number }, Toy> = {
  rulesetVersionKey: "BOBS27_V1",
  stageOwnership: "PER_SEAT",
  fold: (facts, config) => {
    const darts = facts.turns.reduce((n, t) => n + t.darts.length, 0);
    return {
      activeParticipantRef: "p1",
      status: darts >= config.limit ? "COMPLETE" : "IN_PROGRESS",
      darts,
    };
  },
  refusal: (s) => (s.status === "IN_PROGRESS" ? null : "toy is over"),
  intent: () => ({ intendedTargetNumber: 20, intendedZoneKey: "TREBLE" }),
  isVisitOpen: (t) => t.darts.length < 3,
  wouldComplete: (s, _o, c) => s.darts + 1 >= c.limit,
};

const T20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: null,
  locationY: null,
};

const Toy = dartGameEngineClass(spec);

afterEach(() => vi.useRealTimers());

describe("dartGameEngineClass", () => {
  it("records into one visit until it closes, stamping completedAt on the closing dart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(T20);
    expect(engine.facts().turns[0].completedAt).toBe(
      "2026-11-01T10:00:00.000Z",
    );
    engine.record(T20);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[0].darts[0]).toMatchObject({
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      score: 60,
    });
  });

  it("refuses with the spec's message and leaves facts untouched", () => {
    const engine = new Toy({ limit: 1 });
    engine.record(T20);
    const before = engine.facts();
    expect(() => engine.record(T20)).toThrow("toy is over");
    expect(engine.facts()).toEqual(before);
    expect(engine.isComplete()).toBe(true);
  });

  it("undo reopens a closed visit and empties to false", () => {
    const engine = new Toy({ limit: 10 });
    [T20, T20, T20].forEach((o) => engine.record(o));
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(false);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rehydrates mid-visit and keeps appending to the open turn", () => {
    const first = new Toy({ limit: 10 });
    first.record(T20);
    const prior: EngineFacts = first.facts();
    const second = new Toy({ limit: 10 }, prior);
    second.record(T20);
    expect(second.facts().turns).toHaveLength(1);
    expect(second.facts().turns[0].darts).toHaveLength(2);
  });

  it("returns detached copies from state() and facts()", () => {
    const engine = new Toy({ limit: 10 });
    engine.record(T20);
    engine.facts().turns.pop();
    (engine.state() as Toy).darts = 99;
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state().darts).toBe(1);
  });

  it("delegates wouldComplete to the spec without mutating", () => {
    const engine = new Toy({ limit: 2 });
    engine.record(T20);
    expect(engine.wouldComplete(T20)).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("dartGameEngineFactory", () => {
  it("carries the spec's key and ownership and builds the class", () => {
    const factory = dartGameEngineFactory(spec, Toy);
    expect(factory.rulesetVersionKey).toBe("BOBS27_V1");
    expect(factory.stageOwnership).toBe("PER_SEAT");
    expect(factory.create({ limit: 3 })).toBeInstanceOf(Toy);
  });
});
