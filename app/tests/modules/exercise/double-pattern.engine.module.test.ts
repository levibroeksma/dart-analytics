import { describe, expect, it } from "vitest";
import {
  applyDoublePatternDart,
  DoublePatternEngine,
  doublePatternEngineFactory,
  foldDoublePatternState,
} from "@modules/exercise/double-pattern.engine.module";
import type { DoublePatternConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const CONFIG: DoublePatternConfigData = {
  patterns: [
    [20, 10, 5],
    [16, 8, 4],
  ],
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

describe("doublePatternEngineFactory", () => {
  it("starts on the first pattern's first double", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      patternIndex: 0,
      targetWithinPattern: 0,
      currentDoubleNumber: 20,
      totalPoints: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("scores 1 point for a hit double and advances within the pattern", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    const state = engine.record(dart(20, "DOUBLE"));

    expect(state.totalPoints).toBe(1);
    expect(state.dartsThrown).toBe(1);
    expect(state.targetWithinPattern).toBe(1);
    expect(state.currentDoubleNumber).toBe(10);
  });

  it("scores 0 for a non-double hit on the right number", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    const state = engine.record(dart(20, "TREBLE"));

    expect(state.totalPoints).toBe(0);
  });

  it("scores 0 for a double on the wrong number", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    const state = engine.record(dart(10, "DOUBLE"));

    expect(state.totalPoints).toBe(0);
  });

  it("advances to the next pattern after the current one completes", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));
    engine.record(dart(10, "DOUBLE"));

    const state = engine.record(dart(5, "DOUBLE"));

    expect(state.totalPoints).toBe(3);
    expect(state.dartsThrown).toBe(3);
    expect(state.patternIndex).toBe(1);
    expect(state.targetWithinPattern).toBe(0);
    expect(state.currentDoubleNumber).toBe(16);
  });

  it("wraps back to the first pattern after a full cycle", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    for (const n of [20, 10, 5, 16, 8, 4]) {
      engine.record(dart(n, "DOUBLE"));
    }

    const state = engine.state();
    expect(state.dartsThrown).toBe(6);
    expect(state.totalPoints).toBe(6);
    expect(state.patternIndex).toBe(0);
    expect(state.targetWithinPattern).toBe(0);
    expect(state.currentDoubleNumber).toBe(20);
  });

  it("undoes the last dart", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));

    expect(engine.undo()).toBe(true);
    expect(engine.state().dartsThrown).toBe(0);
    expect(engine.state().totalPoints).toBe(0);
  });

  it("completes only on expireTimer, and refuses to record after", () => {
    const engine = new DoublePatternEngine(CONFIG);

    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(dart(20, "DOUBLE"))).toThrow();
  });

  it("rehydrates in-progress totals from prior facts", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));
    const prior = engine.facts();

    const resumed = doublePatternEngineFactory.create(CONFIG, prior);

    expect(resumed.state()).toEqual({
      patternIndex: 0,
      targetWithinPattern: 1,
      currentDoubleNumber: 10,
      totalPoints: 1,
      dartsThrown: 1,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyDoublePatternDart", () => {
  it("folds a single hit dart onto the initial progress", () => {
    const progress = applyDoublePatternDart(
      CONFIG,
      { dartsThrown: 0, totalPoints: 0 },
      { hitTargetNumber: 20, hitZoneKey: "DOUBLE" },
    );

    expect(progress).toEqual({ dartsThrown: 1, totalPoints: 1 });
  });

  it("scores 0 for a miss on the intended double", () => {
    const progress = applyDoublePatternDart(
      CONFIG,
      { dartsThrown: 0, totalPoints: 0 },
      { hitTargetNumber: 20, hitZoneKey: "SINGLE" },
    );

    expect(progress).toEqual({ dartsThrown: 1, totalPoints: 0 });
  });
});

describe("foldDoublePatternState", () => {
  it("derives state directly from a fact log without an engine instance", () => {
    const state = foldDoublePatternState(
      {
        stages: [],
        turns: [
          {
            clientKey: "t1",
            stageClientKey: "block-1",
            participantRef: "solo",
            sequence: 1,
            completedAt: null,
            totalScore: 0,
            darts: [
              {
                sequence: 1,
                hitTargetNumber: 20,
                hitZoneKey: "DOUBLE",
                intendedTargetNumber: 20,
                intendedZoneKey: "DOUBLE",
                score: 1,
                locationX: null,
                locationY: null,
              },
            ],
          },
        ],
      },
      CONFIG,
      false,
    );

    expect(state).toEqual({
      patternIndex: 0,
      targetWithinPattern: 1,
      currentDoubleNumber: 10,
      totalPoints: 1,
      dartsThrown: 1,
      status: "IN_PROGRESS",
    });
  });
});
