import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DoublePatternEngine } from "@modules/training/exercises/double-pattern.engine.module";
import {
  goldenTrace,
  normalise,
  randomObservation,
} from "../../game/support/engine-oracle";
import type { DoublePatternConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const CONFIG: DoublePatternConfigData = {
  patterns: [[20, 10, 5], [16, 8], [4]],
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const FULL_PASS = [
  dart(20, "DOUBLE"),
  dart(10, "SINGLE"),
  dart(5, "DOUBLE"),
  dart(16, "DOUBLE"),
  dart(null, "MISS"),
  dart(4, "DOUBLE"),
];

const SCRIPT = [...FULL_PASS, dart(20, "DOUBLE"), dart(10, "DOUBLE")];

function aimedOrRandom(
  rand: () => number,
  engine: DoublePatternEngine,
): DartObservation {
  return rand() < 0.6
    ? dart(engine.state().currentDoubleNumber, "DOUBLE")
    : randomObservation(rand);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Double Pattern — golden", () => {
  it("seed 7 step trace with rehydration is unchanged", () => {
    expect(
      goldenTrace({
        build: (prior) => new DoublePatternEngine(CONFIG, prior),
        seed: 7,
        steps: 240,
        undoRate: 0.1,
        rehydrateEvery: 7,
        expireAt: 181,
        resumeExpired: true,
        observe: aimedOrRandom as never,
      }),
    ).toMatchSnapshot();
  });

  it("wraps the pattern list after a full pass", () => {
    const engine = new DoublePatternEngine(CONFIG);
    SCRIPT.forEach((d) => engine.record(d));
    expect(engine.facts().turns.map((t) => t.darts.length)).toEqual([
      3, 2, 1, 2,
    ]);
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });

  it("scripted darts, undo across a visit boundary and expiry keep facts unchanged", () => {
    const engine = new DoublePatternEngine(CONFIG);
    SCRIPT.slice(0, 4).forEach((d) => engine.record(d));
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.map((t) => t.darts.length)).toEqual([2]);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(dart(5, "DOUBLE"));
    engine.record(dart(16, "SINGLE"));
    engine.expireTimer();
    expect(() => engine.record(SCRIPT[0])).toThrow("exercise is complete");
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.map((t) => t.darts.length)).toEqual([3]);
    engine.record(dart(16, "DOUBLE"));
    engine.record(dart(8, "DOUBLE"));
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });

  it("resumes from prior facts mid-visit like a continuous run", () => {
    const continuous = new DoublePatternEngine(CONFIG);
    SCRIPT.forEach((d) => continuous.record(d));
    const first = new DoublePatternEngine(CONFIG);
    SCRIPT.slice(0, 7).forEach((d) => first.record(d));
    const resumed = new DoublePatternEngine(CONFIG, first.facts());
    expect(resumed.isComplete()).toBe(false);
    resumed.record(SCRIPT[7]);
    expect(normalise(resumed.facts())).toEqual(normalise(continuous.facts()));
    expect(resumed.state()).toEqual(continuous.state());
  });
});
