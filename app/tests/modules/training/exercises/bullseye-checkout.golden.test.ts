import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
import {
  goldenTrace,
  normalise,
  randomObservation,
} from "../../game/support/engine-oracle";
import type { BullseyeCheckoutConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const CONFIG: BullseyeCheckoutConfigData = { startScore: 81 };

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const PLANNED = [
  dart(19, "SINGLE"),
  dart(12, "SINGLE"),
  dart(25, "INNER_BULL"),
];

const SCRIPT = [...PLANNED, dart(20, "TREBLE"), dart(1, "SINGLE")];

function plannedOrRandom(
  rand: () => number,
  engine: BullseyeCheckoutEngine,
): DartObservation {
  return rand() < 0.6
    ? PLANNED[engine.state().dartsInVisit]
    : randomObservation(rand);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Bullseye Checkout — golden", () => {
  it("seed 7 step trace with rehydration is unchanged", () => {
    expect(
      goldenTrace({
        build: (prior) => new BullseyeCheckoutEngine(CONFIG, prior),
        seed: 7,
        steps: 240,
        undoRate: 0.1,
        rehydrateEvery: 7,
        expireAt: 181,
        resumeExpired: true,
        observe: plannedOrRandom as never,
      }),
    ).toMatchSnapshot();
  });

  it("scripted darts, expiry and undo keep facts unchanged", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    SCRIPT.forEach((d) => engine.record(d));
    engine.expireTimer();
    expect(() => engine.record(SCRIPT[0])).toThrow("exercise is complete");
    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.map((t) => t.darts.length)).toEqual([3, 1]);
    engine.record(dart(11, "SINGLE"));
    engine.record(dart(25, "OUTER_BULL"));
    engine.record(dart(5, "SINGLE"));
    engine.expireTimer();
    expect(
      normalise({ facts: engine.facts(), state: engine.state() }),
    ).toMatchSnapshot();
  });

  it("resumes from prior facts mid-visit like a continuous run", () => {
    const continuous = new BullseyeCheckoutEngine(CONFIG);
    SCRIPT.forEach((d) => continuous.record(d));
    const first = new BullseyeCheckoutEngine(CONFIG);
    SCRIPT.slice(0, 4).forEach((d) => first.record(d));
    const resumed = new BullseyeCheckoutEngine(CONFIG, first.facts());
    expect(resumed.isComplete()).toBe(false);
    resumed.record(SCRIPT[4]);
    expect(normalise(resumed.facts())).toEqual(normalise(continuous.facts()));
    expect(resumed.state()).toEqual(continuous.state());
  });
});
