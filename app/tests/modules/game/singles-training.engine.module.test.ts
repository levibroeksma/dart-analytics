import { describe, it, expect } from "vitest";
import {
  applyDart,
  initialSinglesTrainingState,
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
