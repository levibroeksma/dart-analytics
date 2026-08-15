import { describe, it, expect } from "vitest";
import {
  applyAroundTheClockDart,
  initialAroundTheClockState,
  isAroundTheClockHit,
  AroundTheClockEngine,
  aroundTheClockEngineFactory,
} from "@modules/game/around-the-clock.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  AroundTheClockState,
  DartObservation,
  EngineFacts,
} from "@modules/types";
import type { AroundTheClockSnapshot } from "@lib/types";

const config: AroundTheClockSnapshot = {};

function numberHit(
  number: number,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

function miss(): DartObservation {
  return {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

function bullHit(zone: "OUTER_BULL" | "INNER_BULL"): DartObservation {
  return {
    hitTargetNumber: 25,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

describe("aroundTheClockEngineFactory", () => {
  it("registers itself under AROUND_THE_CLOCK_V1", () => {
    expect(aroundTheClockEngineFactory.rulesetVersionKey).toBe(
      "AROUND_THE_CLOCK_V1",
    );
    expect(getEngineFactory("AROUND_THE_CLOCK_V1")).toBe(
      aroundTheClockEngineFactory,
    );
  });

  it("builds an AroundTheClockEngine bound to the ruleset version", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    expect(engine).toBeInstanceOf(AroundTheClockEngine);
    expect(engine.rulesetVersionKey).toBe("AROUND_THE_CLOCK_V1");
  });
});

describe("initialAroundTheClockState", () => {
  it("starts at target index 0 (number 1), no darts thrown, in progress", () => {
    expect(initialAroundTheClockState()).toEqual({
      targetIndex: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("isAroundTheClockHit — NUMBER target", () => {
  const target = targetAt(numbersPath(), 0);

  it.each(["SINGLE", "DOUBLE", "TREBLE"] as const)(
    "accepts a %s on the matching number",
    (zone) => {
      expect(isAroundTheClockHit(target, numberHit(1, zone))).toBe(true);
    },
  );

  it("rejects a MISS", () => {
    expect(isAroundTheClockHit(target, miss())).toBe(false);
  });

  it("rejects a hit on the wrong number", () => {
    expect(isAroundTheClockHit(target, numberHit(2, "SINGLE"))).toBe(false);
  });
});

describe("isAroundTheClockHit — BULL target", () => {
  const target = targetAt(numbersPath(), 20);

  it("accepts OUTER_BULL", () => {
    expect(isAroundTheClockHit(target, bullHit("OUTER_BULL"))).toBe(true);
  });

  it("accepts INNER_BULL", () => {
    expect(isAroundTheClockHit(target, bullHit("INNER_BULL"))).toBe(true);
  });

  it("rejects a MISS", () => {
    expect(isAroundTheClockHit(target, miss())).toBe(false);
  });

  it("rejects a hit on a number (wrong target number)", () => {
    expect(isAroundTheClockHit(target, numberHit(20, "TREBLE"))).toBe(false);
  });
});

describe("applyAroundTheClockDart — mid-visit advance", () => {
  it("advances the target immediately within one visit, clearing two numbers in three darts", () => {
    let state = initialAroundTheClockState();
    state = applyAroundTheClockDart(state, numberHit(1, "SINGLE"));
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(1);

    state = applyAroundTheClockDart(state, numberHit(2, "DOUBLE"));
    expect(state.targetIndex).toBe(2);
    expect(state.dartsThisVisit).toBe(2);

    state = applyAroundTheClockDart(state, miss());
    expect(state.targetIndex).toBe(2);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("closes the visit at 3 darts with no advance when every dart misses", () => {
    let state = initialAroundTheClockState();
    state = applyAroundTheClockDart(state, miss());
    state = applyAroundTheClockDart(state, miss());
    state = applyAroundTheClockDart(state, miss());
    expect(state.targetIndex).toBe(0);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applyAroundTheClockDart — BULL completion", () => {
  it.each([0, 1, 2])(
    "completes immediately on a BULL hit as dart index %i of the visit",
    (dartsThisVisit) => {
      const state: AroundTheClockState = {
        targetIndex: 20,
        dartsThisVisit,
        status: "IN_PROGRESS",
      };
      const next = applyAroundTheClockDart(state, bullHit("INNER_BULL"));
      expect(next).toEqual({
        targetIndex: 20,
        dartsThisVisit: 0,
        status: "COMPLETE",
      });
    },
  );

  it("does not complete on a BULL miss and keeps counting the visit", () => {
    const state: AroundTheClockState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyAroundTheClockDart(state, miss());
    expect(next).toEqual({
      targetIndex: 20,
      dartsThisVisit: 1,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyAroundTheClockDart — terminal state guard", () => {
  it("throws when called on a COMPLETE state", () => {
    const terminal: AroundTheClockState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() => applyAroundTheClockDart(terminal, miss())).toThrow();
  });
});

describe("AroundTheClockEngine — fact log and derived state", () => {
  it("stores the real board score and null intention on every dart", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    engine.record(numberHit(1, "TREBLE"));

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.score).toBe(3);
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
    expect(engine.state().targetIndex).toBe(1);
  });

  it("keeps all three darts of a mid-visit-advance turn in one TurnFact", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "DOUBLE"));
    engine.record(miss());

    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(3);
    expect(engine.state().targetIndex).toBe(2);
  });

  it("stamps completedAt early when a BULL hit ends the session on the visit's 1st dart", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.state().targetIndex).toBe(20);

    engine.record(bullHit("OUTER_BULL"));

    const lastTurn = engine.facts().turns.at(-1);
    expect(lastTurn?.darts).toHaveLength(1);
    expect(lastTurn?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(engine.isComplete()).toBe(true);
  });

  it("leaves completedAt null on an open visit that has not resolved", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(miss());
    expect(engine.facts().turns[0].completedAt).toBeNull();
  });

  it("rehydrates target index and completion from persisted facts", () => {
    const first = aroundTheClockEngineFactory.create(config);
    first.record(numberHit(1, "SINGLE"));
    first.record(numberHit(2, "SINGLE"));

    const resumed = aroundTheClockEngineFactory.create(config, first.facts());
    expect(resumed.state().targetIndex).toBe(2);
    expect(resumed.state().status).toBe("IN_PROGRESS");
  });
});

describe("AroundTheClockEngine.wouldComplete", () => {
  it("is true for a BULL hit on any dart of the visit, not only the 3rd", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.state().targetIndex).toBe(20);
    expect(engine.wouldComplete(bullHit("INNER_BULL"))).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false for a BULL miss", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.wouldComplete(miss())).toBe(false);
  });

  it("is false once the session has already ended", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    engine.record(bullHit("OUTER_BULL"));
    expect(engine.state().status).toBe("COMPLETE");
    expect(engine.wouldComplete(bullHit("INNER_BULL"))).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    engine.wouldComplete(numberHit(2, "SINGLE"));

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("AroundTheClockEngine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new AroundTheClockEngine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record() when it extended the open visit", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    const before = engine.facts();
    engine.record(numberHit(2, "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("reopens a visit that closed early via a BULL completion, removing the 1-dart turn entirely", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    const turnsBeforeBull = engine.facts().turns.length;
    engine.record(bullHit("OUTER_BULL"));
    expect(engine.state().status).toBe("COMPLETE");

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().targetIndex).toBe(20);
    expect(engine.facts().turns).toHaveLength(turnsBeforeBull);
  });

  it("walks back across a two-advance turn one dart at a time", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "DOUBLE"));
    engine.record(miss());
    expect(engine.state().targetIndex).toBe(2);

    expect(engine.undo()).toBe(true);
    expect(engine.state().targetIndex).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.state().targetIndex).toBe(1);
    expect(engine.undo()).toBe(true);
    expect(engine.state().targetIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = aroundTheClockEngineFactory.create(config);
    first.record(numberHit(1, "SINGLE"));

    const resumed = aroundTheClockEngineFactory.create(config, first.facts());
    resumed.record(numberHit(2, "SINGLE"));
    expect(resumed.state().targetIndex).toBe(2);

    expect(resumed.undo()).toBe(true);
    expect(resumed.state().targetIndex).toBe(1);
  });
});
