import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BullUpEngine } from "@modules/training/exercises/bull-up.engine.module";
import { goldenTrace, normalise } from "../../game/support/engine-oracle";
import type { DartObservation } from "@modules/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const SCRIPT = [
  dart(25, "INNER_BULL"),
  dart(25, "OUTER_BULL"),
  dart(20, "SINGLE"),
  dart(null, "MISS"),
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Bull Up — golden", () => {
  it("seed 7 step trace with rehydration is unchanged", () => {
    expect(
      goldenTrace({
        build: (prior) => new BullUpEngine({}, prior),
        seed: 7,
        steps: 200,
        undoRate: 0.1,
        rehydrateEvery: 7,
        expireAt: 150,
        resumeExpired: true,
      }),
    ).toMatchSnapshot();
  });

  it("scripted darts, expiry and undo keep facts unchanged", () => {
    const engine = new BullUpEngine({});
    SCRIPT.forEach((d) => engine.record(d));
    engine.expireTimer();
    expect(() => engine.record(SCRIPT[0])).toThrow("exercise is complete");
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.facts().turns).toHaveLength(4);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(3);
    engine.record(SCRIPT[1]);
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });

  it("resumes from prior facts like a continuous run", () => {
    const continuous = new BullUpEngine({});
    SCRIPT.forEach((d) => continuous.record(d));
    const first = new BullUpEngine({});
    SCRIPT.slice(0, 3).forEach((d) => first.record(d));
    const resumed = new BullUpEngine({}, first.facts());
    expect(resumed.isComplete()).toBe(false);
    resumed.record(SCRIPT[3]);
    expect(normalise(resumed.facts())).toEqual(normalise(continuous.facts()));
    expect(resumed.state()).toEqual(continuous.state());
  });
});
