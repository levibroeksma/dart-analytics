import { describe, expect, it } from "vitest";
import {
  DoublePatternEngine,
  doublePatternEngineFactory,
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
