import { describe, it, expect } from "vitest";
import {
  applyVisit,
  initialFiveOhOneState,
  FiveOhOneEngine,
} from "@modules/game/five-oh-one.engine.module";
import type { FiveOhOneState } from "@modules/game/types";

describe("applyVisit — legal reduction", () => {
  it("subtracts the visit score and stays in progress", () => {
    const state = initialFiveOhOneState(501);
    const next = applyVisit(state, 45);
    expect(next.remainingScore).toBe(456);
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.visitHistory).toEqual([
      { scoreAttempted: 45, isBust: false, remainingAfter: 456 },
    ]);
  });

  it("ignores a checkout passed on a visit that does not reach zero, and does not record it", () => {
    const state = initialFiveOhOneState(100);
    const next = applyVisit(state, 60, { dartsUsed: 3, dartsOnDouble: 1 });
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.visitHistory[0].checkout).toBeUndefined();
  });
});

describe("applyVisit — bust rules", () => {
  it("busts on an overshoot and leaves the remaining score unchanged", () => {
    const state = initialFiveOhOneState(40);
    const next = applyVisit(state, 50);
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.visitHistory).toEqual([
      { scoreAttempted: 50, isBust: true, remainingAfter: 40 },
    ]);
  });

  it("busts when the visit would leave exactly 1, which cannot be finished on a double", () => {
    const state = initialFiveOhOneState(41);
    const next = applyVisit(state, 40);
    expect(next.remainingScore).toBe(41);
    expect(next.visitHistory[0].isBust).toBe(true);
  });

  it("busts when the visit reaches zero but no checkout was supplied", () => {
    const state = initialFiveOhOneState(40);
    const next = applyVisit(state, 40);
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.visitHistory[0].isBust).toBe(true);
  });

  it("busts when the visit reaches zero with no darts on a double, but still records the checkout fact", () => {
    const state = initialFiveOhOneState(40);
    const next = applyVisit(state, 40, { dartsUsed: 3, dartsOnDouble: 0 });
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.visitHistory).toEqual([
      {
        scoreAttempted: 40,
        isBust: true,
        remainingAfter: 40,
        checkout: { dartsUsed: 3, dartsOnDouble: 0 },
      },
    ]);
  });
});

describe("applyVisit — winning checkout", () => {
  it("wins the leg when the visit reaches zero with at least one dart on a double", () => {
    const state = initialFiveOhOneState(40);
    const next = applyVisit(state, 40, { dartsUsed: 1, dartsOnDouble: 1 });
    expect(next.remainingScore).toBe(0);
    expect(next.status).toBe("WON");
    expect(next.visitHistory).toEqual([
      {
        scoreAttempted: 40,
        isBust: false,
        remainingAfter: 0,
        checkout: { dartsUsed: 1, dartsOnDouble: 1 },
      },
    ]);
  });
});

describe("applyVisit — terminal state guard", () => {
  it("throws when called on a state that is already WON", () => {
    const wonState: FiveOhOneState = {
      remainingScore: 0,
      visitHistory: [],
      status: "WON",
    };
    expect(() => applyVisit(wonState, 20)).toThrow();
  });
});

describe("FiveOhOneEngine", () => {
  it("starts at 501 with an empty history and is not complete", () => {
    const engine = new FiveOhOneEngine();
    expect(engine.currentScore()).toBe(501);
    expect(engine.visitHistory()).toEqual([]);
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates recordVisit to the reducer and exposes the updated state via getters", () => {
    const engine = new FiveOhOneEngine();
    engine.recordVisit(60);
    expect(engine.currentScore()).toBe(441);
    engine.recordVisit(100);
    expect(engine.currentScore()).toBe(341);
    expect(engine.visitHistory()).toHaveLength(2);
    expect(engine.isComplete()).toBe(false);
  });

  it("reports isComplete once the leg is checked out on a double", () => {
    const engine = new FiveOhOneEngine(40);
    engine.recordVisit(40, { dartsUsed: 2, dartsOnDouble: 1 });
    expect(engine.isComplete()).toBe(true);
    expect(engine.currentScore()).toBe(0);
  });

  it("accepts a custom starting score", () => {
    const engine = new FiveOhOneEngine(301);
    expect(engine.currentScore()).toBe(301);
  });
});

describe("FiveOhOneEngine.undoLastVisit", () => {
  it("returns false when there is no history", () => {
    const engine = new FiveOhOneEngine();
    expect(engine.undoLastVisit()).toBe(false);
  });

  it("reverts a legal reduction, restoring the previous score", () => {
    const engine = new FiveOhOneEngine();
    engine.recordVisit(45);
    expect(engine.currentScore()).toBe(456);

    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentScore()).toBe(501);
    expect(engine.visitHistory()).toHaveLength(0);
  });

  it("reverts a bust visit, removing its history entry", () => {
    const engine = new FiveOhOneEngine();
    engine.recordVisit(60);
    engine.recordVisit(500);
    expect(engine.currentScore()).toBe(441);
    expect(engine.visitHistory()).toHaveLength(2);
    expect(engine.visitHistory()[1].isBust).toBe(true);

    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentScore()).toBe(441);
    expect(engine.visitHistory()).toHaveLength(1);
  });

  it("reverts the winning visit, allowing the leg to be won again on redo", () => {
    const engine = new FiveOhOneEngine(40);
    engine.recordVisit(40, { dartsUsed: 1, dartsOnDouble: 1 });
    expect(engine.isComplete()).toBe(true);

    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.currentScore()).toBe(40);
    expect(engine.visitHistory()).toHaveLength(0);

    engine.recordVisit(40, { dartsUsed: 2, dartsOnDouble: 1 });
    expect(engine.isComplete()).toBe(true);
    expect(engine.currentScore()).toBe(0);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new FiveOhOneEngine();
    engine.recordVisit(60);
    engine.recordVisit(100);
    expect(engine.currentScore()).toBe(341);

    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentScore()).toBe(441);
    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentScore()).toBe(501);
    expect(engine.visitHistory()).toHaveLength(0);
    expect(engine.undoLastVisit()).toBe(false);
  });

  it("does not push a phantom history entry when recordVisit is rejected on a won leg", () => {
    const engine = new FiveOhOneEngine(101);
    engine.recordVisit(61);
    engine.recordVisit(40, { dartsUsed: 1, dartsOnDouble: 1 });
    expect(engine.isComplete()).toBe(true);
    expect(engine.visitHistory()).toHaveLength(2);

    expect(() => engine.recordVisit(20)).toThrow();

    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.currentScore()).toBe(40);
    expect(engine.visitHistory()).toHaveLength(1);

    expect(engine.undoLastVisit()).toBe(true);
    expect(engine.currentScore()).toBe(101);
    expect(engine.visitHistory()).toHaveLength(0);
  });
});
