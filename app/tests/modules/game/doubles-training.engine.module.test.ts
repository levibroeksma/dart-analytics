import { describe, it, expect } from "vitest";
import {
  applyDart,
  initialDoublesTrainingState,
} from "@modules/game/doubles-training.engine.module";
import type { DoublesTrainingState } from "@modules/game/types";

describe("applyDart — visit resolution on hit", () => {
  it("ends the visit immediately on a dart-1 hit and advances the target", () => {
    const state = initialDoublesTrainingState();
    const next = applyDart(state, true);
    expect(next.targetIndex).toBe(1);
    expect(next.dartsThisVisit).toBe(0);
    expect(next.visitHistory).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 1 },
    ]);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ends the visit on a dart-2 hit after a dart-1 miss", () => {
    let state = initialDoublesTrainingState();
    state = applyDart(state, false);
    state = applyDart(state, true);
    expect(state.targetIndex).toBe(1);
    expect(state.visitHistory).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 2 },
    ]);
  });

  it("resolves naturally on a dart-3 hit after two misses", () => {
    let state = initialDoublesTrainingState();
    state = applyDart(state, false);
    state = applyDart(state, false);
    state = applyDart(state, true);
    expect(state.targetIndex).toBe(1);
    expect(state.visitHistory).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 3 },
    ]);
  });
});

describe("applyDart — visit resolution on full miss", () => {
  it("still advances after all 3 darts miss", () => {
    let state = initialDoublesTrainingState();
    state = applyDart(state, false);
    state = applyDart(state, false);
    state = applyDart(state, false);
    expect(state.targetIndex).toBe(1);
    expect(state.visitHistory).toEqual([
      { targetIndex: 0, hit: false, hitDartNumber: null },
    ]);
  });

  it("does not resolve the visit or record history after only 1 miss", () => {
    const state = initialDoublesTrainingState();
    const next = applyDart(state, false);
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.visitHistory).toEqual([]);
  });
});

describe("applyDart — path completion", () => {
  it("completes after a dart-1 hit on every one of the 21 targets", () => {
    let state = initialDoublesTrainingState();
    for (let visit = 0; visit < 21; visit++) {
      state = applyDart(state, true);
    }
    expect(state.status).toBe("COMPLETE");
    expect(state.visitHistory).toHaveLength(21);
    expect(
      state.visitHistory.every((v) => v.hit === true && v.hitDartNumber === 1),
    ).toBe(true);
  });
});

describe("applyDart — BULL visit completion", () => {
  it("completes the session on a bull hit", () => {
    const bullState: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      visitHistory: [],
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, true);
    expect(next.status).toBe("COMPLETE");
    expect(next.visitHistory).toEqual([
      { targetIndex: 20, hit: true, hitDartNumber: 1 },
    ]);
  });

  it("completes the session even when the bull visit is a full miss", () => {
    const bullState: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 2,
      visitHistory: [],
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, false);
    expect(next.status).toBe("COMPLETE");
    expect(next.visitHistory).toEqual([
      { targetIndex: 20, hit: false, hitDartNumber: null },
    ]);
  });
});

describe("applyDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      visitHistory: [{ targetIndex: 20, hit: true, hitDartNumber: 1 }],
      status: "COMPLETE",
    };
    expect(() => applyDart(completeState, true)).toThrow();
  });
});

import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";

describe("DoublesTrainingEngine", () => {
  it("starts on target DOUBLE 1, empty history, not complete", () => {
    const engine = new DoublesTrainingEngine();
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.visitHistory()).toEqual([]);
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates recordDart to the reducer and exposes the updated state via getters", () => {
    const engine = new DoublesTrainingEngine();
    engine.recordDart(false);
    engine.recordDart(true);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
    expect(engine.visitHistory()).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 2 },
    ]);
  });

  it("reports isComplete once the full 21-visit path is finished", () => {
    const engine = new DoublesTrainingEngine();
    for (let visit = 0; visit < 21; visit++) {
      engine.recordDart(true);
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.visitHistory()).toHaveLength(21);
  });
});
