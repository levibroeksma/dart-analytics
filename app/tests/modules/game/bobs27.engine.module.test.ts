import { describe, it, expect } from "vitest";
import {
  applyDart,
  initialBobs27State,
  Bobs27Engine,
} from "@modules/game/bobs27.engine.module";
import type { Bobs27State } from "@modules/game/types";

describe("applyDart — hit scoring", () => {
  it("adds the target's value immediately on a single hit and keeps the same target", () => {
    const state = initialBobs27State(27);
    const next = applyDart(state, true);
    expect(next.score).toBe(28);
    expect(next.targetIndex).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("adds each hit as it happens across a 3-hit visit, then advances the target", () => {
    let state = initialBobs27State(27);
    state = applyDart(state, true);
    expect(state.score).toBe(28);
    state = applyDart(state, true);
    expect(state.score).toBe(29);
    state = applyDart(state, true);
    expect(state.score).toBe(30);
    expect(state.targetIndex).toBe(1);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("does not penalize a visit with at least one hit", () => {
    let state = initialBobs27State(27);
    state = applyDart(state, true);
    state = applyDart(state, false);
    state = applyDart(state, true);
    expect(state.score).toBe(29);
    expect(state.targetIndex).toBe(1);
  });
});

describe("applyDart — full-miss penalty", () => {
  it("does not change the score until the 3rd dart resolves a full-miss visit", () => {
    let state = initialBobs27State(27);
    state = applyDart(state, false);
    expect(state.score).toBe(27);
    state = applyDart(state, false);
    expect(state.score).toBe(27);
    state = applyDart(state, false);
    expect(state.score).toBe(26);
    expect(state.targetIndex).toBe(1);
  });

  it("drives the score to exactly 0 and ends the game as LOST", () => {
    let state = initialBobs27State(1);
    state = applyDart(state, false);
    state = applyDart(state, false);
    state = applyDart(state, false);
    expect(state.score).toBe(0);
    expect(state.status).toBe("LOST");
  });
});

describe("applyDart — path completion and win/loss", () => {
  it("wins after a full-hit run through the entire path", () => {
    let state = initialBobs27State(27);
    for (let visit = 0; visit < 21; visit++) {
      state = applyDart(state, true);
      state = applyDart(state, true);
      state = applyDart(state, true);
    }
    expect(state.status).toBe("WON");
    expect(state.score).toBe(807);
  });

  it("loses when a full-miss on the bull visit drops the score to 0 or below, even though it is the final visit", () => {
    const bullState: Bobs27State = {
      targetIndex: 20,
      score: 50,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    let state = applyDart(bullState, false);
    state = applyDart(state, false);
    state = applyDart(state, false);
    expect(state.score).toBe(0);
    expect(state.status).toBe("LOST");
  });

  it("wins when a full-miss on the bull visit leaves the score positive", () => {
    const bullState: Bobs27State = {
      targetIndex: 20,
      score: 100,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    let state = applyDart(bullState, false);
    state = applyDart(state, false);
    state = applyDart(state, false);
    expect(state.score).toBe(50);
    expect(state.status).toBe("WON");
  });

  it("throws when called on a state that already has a WON or LOST status", () => {
    const wonState: Bobs27State = {
      targetIndex: 20,
      score: 10,
      dartsThisVisit: [],
      status: "WON",
    };
    expect(() => applyDart(wonState, true)).toThrow();
  });
});

describe("Bobs27Engine", () => {
  it("starts at score 27 on target D1, in progress", () => {
    const engine = new Bobs27Engine();
    expect(engine.currentScore()).toBe(27);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.isGameOver()).toBe(false);
    expect(engine.result()).toBeNull();
  });

  it("delegates recordDart to the reducer and exposes the updated state via getters", () => {
    const engine = new Bobs27Engine();
    engine.recordDart(true);
    expect(engine.currentScore()).toBe(28);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    engine.recordDart(true);
    engine.recordDart(true);
    expect(engine.currentScore()).toBe(30);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
  });

  it("reports isGameOver and result once the game ends", () => {
    const engine = new Bobs27Engine(1);
    engine.recordDart(false);
    engine.recordDart(false);
    engine.recordDart(false);
    expect(engine.isGameOver()).toBe(true);
    expect(engine.result()).toBe("LOST");
  });

  it("accepts a custom starting score", () => {
    const engine = new Bobs27Engine(100);
    expect(engine.currentScore()).toBe(100);
  });
});

describe("Bobs27Engine.undoLastDart", () => {
  it("returns false when there is no history", () => {
    const engine = new Bobs27Engine();
    expect(engine.undoLastDart()).toBe(false);
  });

  it("reverts a single hit", () => {
    const engine = new Bobs27Engine();
    engine.recordDart(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentScore()).toBe(27);
  });

  it("reverts the 3rd dart of a full-miss visit, restoring the penalty and the target", () => {
    const engine = new Bobs27Engine();
    engine.recordDart(false);
    engine.recordDart(false);
    engine.recordDart(false);
    expect(engine.currentScore()).toBe(26);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentScore()).toBe(27);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.isGameOver()).toBe(false);
  });

  it("reverts a game-ending dart, allowing play to continue afterward", () => {
    const engine = new Bobs27Engine(1);
    engine.recordDart(false);
    engine.recordDart(false);
    engine.recordDart(false);
    expect(engine.isGameOver()).toBe(true);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.isGameOver()).toBe(false);
    expect(engine.currentScore()).toBe(1);

    engine.recordDart(true);
    expect(engine.isGameOver()).toBe(false);
    expect(engine.currentScore()).toBe(2);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new Bobs27Engine();
    engine.recordDart(true);
    engine.recordDart(true);
    engine.recordDart(true);
    engine.recordDart(true);
    expect(engine.currentScore()).toBe(32);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentScore()).toBe(27);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.undoLastDart()).toBe(false);
  });
});
