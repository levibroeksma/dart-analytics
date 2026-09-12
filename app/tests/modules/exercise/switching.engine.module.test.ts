import { describe, expect, it } from "vitest";
import {
  applySwitchingDart,
  foldSwitchingState,
  SwitchingEngine,
  switchingEngineFactory,
} from "@modules/exercise/switching.engine.module";
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

describe("switchingEngineFactory", () => {
  it("starts aimed at the first target with no points", () => {
    const engine = switchingEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      currentTargetNumber: 20,
      targetIndex: 0,
      totalPoints: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("scores a treble hit on the current target and advances the target", () => {
    const engine = switchingEngineFactory.create(CONFIG);

    const state = engine.record(dart(20, "TREBLE"));

    expect(state.totalPoints).toBe(3);
    expect(state.dartsThrown).toBe(1);
    expect(state.targetIndex).toBe(1);
    expect(state.currentTargetNumber).toBe(19);
  });

  it("scores zero for a dart that lands outside the current target", () => {
    const engine = switchingEngineFactory.create(CONFIG);

    const state = engine.record(dart(5, "TREBLE"));

    expect(state.totalPoints).toBe(0);
    expect(state.dartsThrown).toBe(1);
  });

  it("wraps back to the first target after a full cycle", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "SINGLE"));
    engine.record(dart(19, "SINGLE"));

    const state = engine.record(dart(18, "SINGLE"));

    expect(state.dartsThrown).toBe(3);
    expect(state.totalPoints).toBe(3);
    expect(state.targetIndex).toBe(0);
    expect(state.currentTargetNumber).toBe(20);
  });

  it("undoes the last dart", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));

    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual({
      currentTargetNumber: 20,
      targetIndex: 0,
      totalPoints: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
    expect(engine.undo()).toBe(false);
  });

  it("completes only on expireTimer, and refuses to record after", () => {
    const engine = new SwitchingEngine(CONFIG);
    engine.record(dart(20, "SINGLE"));

    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(dart(19, "SINGLE"))).toThrow();
  });

  it("rehydrates in-progress totals from prior facts", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(19, "DOUBLE"));
    const prior = engine.facts();

    const resumed = switchingEngineFactory.create(CONFIG, prior);

    expect(resumed.state()).toEqual({
      currentTargetNumber: 18,
      targetIndex: 2,
      totalPoints: 5,
      dartsThrown: 2,
      status: "IN_PROGRESS",
    });
  });

  it("returns copies, never live internals", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "SINGLE"));

    engine.facts().turns.push({
      clientKey: "x",
      stageClientKey: "block-1",
      participantRef: "solo",
      sequence: 99,
      completedAt: null,
      totalScore: 0,
      darts: [],
    });

    expect(engine.facts().turns).toHaveLength(1);
  });
});

describe("applySwitchingDart", () => {
  it("folds a single dart onto the initial progress", () => {
    const progress = applySwitchingDart(
      CONFIG,
      { targetIndex: 0, totalPoints: 0, dartsThrown: 0 },
      { hitTargetNumber: 20, hitZoneKey: "TREBLE" },
    );

    expect(progress).toEqual({
      targetIndex: 1,
      totalPoints: 3,
      dartsThrown: 1,
    });
  });
});

describe("foldSwitchingState", () => {
  it("derives state directly from a fact log without an engine instance", () => {
    const state = foldSwitchingState(
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
                hitZoneKey: "SINGLE",
                intendedTargetNumber: 20,
                intendedZoneKey: null,
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
      currentTargetNumber: 19,
      targetIndex: 1,
      totalPoints: 1,
      dartsThrown: 1,
      status: "IN_PROGRESS",
    });
  });
});
