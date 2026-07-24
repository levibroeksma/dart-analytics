import { describe, it, expect } from "vitest";
import {
  applyDart,
  initialSinglesTrainingState,
  SinglesTrainingEngine,
} from "@modules/game/singles-training.engine.module";
import type { SinglesTrainingState } from "@modules/game/types";

describe("applyDart — ring scoring on a NUMBER target", () => {
  it("scores 1 point for a SINGLE hit and keeps the same target", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "SINGLE");
    expect(next.totalPoints).toBe(1);
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("scores 2 points for a DOUBLE hit", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "DOUBLE");
    expect(next.totalPoints).toBe(2);
  });

  it("scores 3 points for a TREBLE hit", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "TREBLE");
    expect(next.totalPoints).toBe(3);
  });

  it("scores 0 points for a MISS but still counts the dart", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "MISS");
    expect(next.totalPoints).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("sums a mixed 3-dart visit and advances the target on the 3rd dart", () => {
    let state = initialSinglesTrainingState(0);
    state = applyDart(state, "SINGLE");
    state = applyDart(state, "DOUBLE");
    state = applyDart(state, "TREBLE");
    expect(state.totalPoints).toBe(6);
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applyDart — path completion", () => {
  it("completes after a full run of TREBLE on every NUMBER target and DOUBLE on BULL", () => {
    let state = initialSinglesTrainingState(0);
    for (let visit = 0; visit < 20; visit++) {
      state = applyDart(state, "TREBLE");
      state = applyDart(state, "TREBLE");
      state = applyDart(state, "TREBLE");
    }
    state = applyDart(state, "DOUBLE");
    state = applyDart(state, "DOUBLE");
    state = applyDart(state, "DOUBLE");
    expect(state.status).toBe("COMPLETE");
    expect(state.totalPoints).toBe(186);
  });
});

describe("applyDart — BULL target scoring", () => {
  it("scores 1 point for a SINGLE (outer bull) hit", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "SINGLE");
    expect(next.totalPoints).toBe(1);
  });

  it("scores 2 points for a DOUBLE (inner bull) hit", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "DOUBLE");
    expect(next.totalPoints).toBe(2);
  });

  it("scores 0 points for a TREBLE hit on BULL (not a physically valid ring, defensive)", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "TREBLE");
    expect(next.totalPoints).toBe(0);
  });

  it("sets status COMPLETE on the bull visit's 3rd dart, not just advancing", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 10,
      dartsThisVisit: 2,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "SINGLE");
    expect(next.status).toBe("COMPLETE");
    expect(next.dartsThisVisit).toBe(0);
  });

  it("scores 0 points for a MISS on BULL", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 5,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "MISS");
    expect(next.totalPoints).toBe(5);
  });
});

describe("applyDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 186,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() => applyDart(completeState, "SINGLE")).toThrow();
  });
});

describe("SinglesTrainingEngine", () => {
  it("starts at 0 points on target NUMBER 1, not complete", () => {
    const engine = new SinglesTrainingEngine();
    expect(engine.currentPoints()).toBe(0);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates recordDart to the reducer and exposes the updated state via getters", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("TREBLE");
    expect(engine.currentPoints()).toBe(3);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });
    engine.recordDart("TREBLE");
    engine.recordDart("TREBLE");
    expect(engine.currentPoints()).toBe(9);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 2 });
  });

  it("reports isComplete once the full path is finished", () => {
    const engine = new SinglesTrainingEngine();
    for (let visit = 0; visit < 20; visit++) {
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
    }
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.currentPoints()).toBe(186);
  });

  it("accepts a custom starting points value", () => {
    const engine = new SinglesTrainingEngine(50);
    expect(engine.currentPoints()).toBe(50);
  });
});

describe("SinglesTrainingEngine.undoLastDart", () => {
  it("returns false when there is no history", () => {
    const engine = new SinglesTrainingEngine();
    expect(engine.undoLastDart()).toBe(false);
  });

  it("does not push a phantom history entry when recordDart is rejected on a completed engine", () => {
    const engine = new SinglesTrainingEngine();
    for (let visit = 0; visit < 20; visit++) {
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
    }
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);

    expect(() => engine.recordDart("SINGLE")).toThrow();

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.currentPoints()).toBe(184);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(182);
  });

  it("reverts a single dart", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("SINGLE");
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(0);
  });

  it("reverts the 3rd dart of a visit, restoring the mid-visit total, then can still resolve the visit", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    const afterThird = engine.recordDart("SINGLE");
    expect(afterThird.totalPoints).toBe(3);
    expect(afterThird.targetIndex).toBe(1);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(2);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });

    const resumed = engine.recordDart("MISS");
    expect(resumed.totalPoints).toBe(2);
    expect(resumed.targetIndex).toBe(1);
    expect(resumed.dartsThisVisit).toBe(0);
  });

  it("reverts the completing dart, allowing the engine to be marked complete again on redo", () => {
    const engine = new SinglesTrainingEngine();
    for (let visit = 0; visit < 20; visit++) {
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
    }
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(false);
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.currentPoints()).toBe(186);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.currentPoints()).toBe(184);

    const resumed = engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);
    expect(resumed.totalPoints).toBe(186);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    expect(engine.currentPoints()).toBe(4);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 2 });

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(0);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });
    expect(engine.undoLastDart()).toBe(false);
  });
});
