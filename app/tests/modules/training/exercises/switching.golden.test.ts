import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SwitchingEngine } from "@modules/training/exercises/switching.engine.module";
import {
  goldenTrace,
  normalise,
  randomObservation,
} from "../../game/support/engine-oracle";
import type { SwitchingConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const CONFIG: SwitchingConfigData = {
  targets: [20, 19, 18],
  scoring: { single: 1, double: 2, treble: 3 },
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const SCRIPT = [
  dart(20, "TREBLE"),
  dart(19, "SINGLE"),
  dart(18, "DOUBLE"),
  dart(5, "TREBLE"),
  dart(null, "MISS"),
];

function aimedOrRandom(
  rand: () => number,
  engine: SwitchingEngine,
): DartObservation {
  return rand() < 0.6
    ? dart(engine.state().currentTargetNumber, "TREBLE")
    : randomObservation(rand);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Switching — golden", () => {
  it("seed 7 step trace with rehydration is unchanged", () => {
    expect(
      goldenTrace({
        build: (prior) => new SwitchingEngine(CONFIG, prior),
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

  it("scripted darts, undo across a visit boundary and expiry keep facts unchanged", () => {
    const engine = new SwitchingEngine(CONFIG);
    SCRIPT.forEach((d) => engine.record(d));
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.map((t) => t.darts.length)).toEqual([2]);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    engine.record(dart(18, "TREBLE"));
    engine.record(dart(20, "SINGLE"));
    engine.expireTimer();
    expect(() => engine.record(SCRIPT[0])).toThrow("exercise is complete");
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.map((t) => t.darts.length)).toEqual([3]);
    engine.record(dart(20, "DOUBLE"));
    engine.record(dart(19, "TREBLE"));
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });

  it("resumes from prior facts mid-visit like a continuous run", () => {
    const continuous = new SwitchingEngine(CONFIG);
    SCRIPT.forEach((d) => continuous.record(d));
    const first = new SwitchingEngine(CONFIG);
    SCRIPT.slice(0, 4).forEach((d) => first.record(d));
    const resumed = new SwitchingEngine(CONFIG, first.facts());
    expect(resumed.isComplete()).toBe(false);
    resumed.record(SCRIPT[4]);
    expect(normalise(resumed.facts())).toEqual(normalise(continuous.facts()));
    expect(resumed.state()).toEqual(continuous.state());
  });
});
