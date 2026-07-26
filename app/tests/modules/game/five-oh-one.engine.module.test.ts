import { describe, it, expect } from "vitest";
import {
  applyFiveOhOneVisit,
  FiveOhOneEngine,
  fiveOhOneEngineFactory,
  initialFiveOhOneState,
} from "@modules/game/five-oh-one.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import type { GameEngine } from "@modules/game/interfaces";
import type { FiveOhOneState, FiveOhOneVisitInput } from "@modules/game/types";
import type { FiveOhOneSnapshot } from "@lib/game/rulesets/types";

const config = () =>
  ({
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
  }) satisfies FiveOhOneSnapshot;

type FiveOhOneGameEngine = GameEngine<FiveOhOneVisitInput, FiveOhOneState>;

/** Plays 180, 180, 101 and a 40 checkout finished on a double — one whole leg. */
function winOneLeg(engine: FiveOhOneGameEngine): FiveOhOneState {
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 101 });
  return engine.record({
    scoreAttempted: 40,
    finishedOnDouble: true,
    dartsUsed: 2,
    dartsAtDouble: 1,
  });
}

describe("fiveOhOneEngineFactory", () => {
  it("registers itself under 501_V1", () => {
    expect(fiveOhOneEngineFactory.rulesetVersionKey).toBe("501_V1");
    expect(getEngineFactory("501_V1")).toBe(fiveOhOneEngineFactory);
  });

  it("builds a FiveOhOneEngine bound to the ruleset version", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    expect(engine).toBeInstanceOf(FiveOhOneEngine);
    expect(engine.rulesetVersionKey).toBe("501_V1");
  });
});

describe("initialFiveOhOneState", () => {
  it("starts at the configured starting score with no legs won", () => {
    expect(initialFiveOhOneState(config())).toEqual({
      remainingScore: 501,
      legsWon: 0,
      status: "IN_PROGRESS",
    });
  });

  it("honours a non-default starting score", () => {
    expect(
      initialFiveOhOneState({ ...config(), startingScore: 301 }).remainingScore,
    ).toBe(301);
  });
});

describe("applyFiveOhOneVisit — legal reduction", () => {
  it("subtracts the visit score and stays in progress", () => {
    const next = applyFiveOhOneVisit(
      initialFiveOhOneState(config()),
      { scoreAttempted: 45 },
      config(),
    );
    expect(next.remainingScore).toBe(456);
    expect(next.legsWon).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ignores a finish flag on a visit that does not reach zero", () => {
    const state: FiveOhOneState = {
      remainingScore: 100,
      legsWon: 0,
      status: "IN_PROGRESS",
    };
    const next = applyFiveOhOneVisit(
      state,
      { scoreAttempted: 60, finishedOnDouble: true, dartsAtDouble: 1 },
      config(),
    );
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
  });
});

describe("applyFiveOhOneVisit — score cap", () => {
  it("throws on a negative score rather than inflating the remaining total", () => {
    expect(() =>
      applyFiveOhOneVisit(
        initialFiveOhOneState(config()),
        { scoreAttempted: -100 },
        config(),
      ),
    ).toThrow(/0 and 180/);
  });

  it("throws above the ruleset's maximum visit score", () => {
    expect(() =>
      applyFiveOhOneVisit(
        initialFiveOhOneState(config()),
        { scoreAttempted: 181 },
        config(),
      ),
    ).toThrow(/0 and 180/);
  });

  it("throws on a score that is not a whole number", () => {
    expect(() =>
      applyFiveOhOneVisit(
        initialFiveOhOneState(config()),
        { scoreAttempted: 60.5 },
        config(),
      ),
    ).toThrow(/0 and 180/);
  });

  it("accepts a scoreless visit of 0", () => {
    const next = applyFiveOhOneVisit(
      initialFiveOhOneState(config()),
      { scoreAttempted: 0 },
      config(),
    );
    expect(next.remainingScore).toBe(501);
    expect(next.status).toBe("IN_PROGRESS");
  });
});

describe("applyFiveOhOneVisit — bust matrix", () => {
  const at = (remainingScore: number): FiveOhOneState => ({
    remainingScore,
    legsWon: 0,
    status: "IN_PROGRESS",
  });

  it("busts on an overshoot and leaves the remaining score unchanged", () => {
    const next = applyFiveOhOneVisit(at(40), { scoreAttempted: 50 }, config());
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("busts when the visit would leave exactly 1, which cannot be finished on a double", () => {
    const next = applyFiveOhOneVisit(at(41), { scoreAttempted: 40 }, config());
    expect(next.remainingScore).toBe(41);
  });

  it("treats a visit that would leave exactly 2 as a legal reduction, since 2 is finishable as D1", () => {
    const next = applyFiveOhOneVisit(at(42), { scoreAttempted: 40 }, config());
    expect(next.remainingScore).toBe(2);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ignores a finish flag on an overshoot bust", () => {
    const next = applyFiveOhOneVisit(
      at(40),
      { scoreAttempted: 50, finishedOnDouble: true, dartsAtDouble: 3 },
      config(),
    );
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ignores a finish flag on a leaves-exactly-1 bust", () => {
    const next = applyFiveOhOneVisit(
      at(41),
      { scoreAttempted: 40, finishedOnDouble: true, dartsAtDouble: 1 },
      config(),
    );
    expect(next.remainingScore).toBe(41);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("busts when the visit reaches zero but no finish was declared", () => {
    const next = applyFiveOhOneVisit(at(40), { scoreAttempted: 40 }, config());
    expect(next.remainingScore).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
  });
});

describe("applyFiveOhOneVisit — double out", () => {
  const at = (remainingScore: number): FiveOhOneState => ({
    remainingScore,
    legsWon: 0,
    status: "IN_PROGRESS",
  });

  it("wins the leg when the dart that reached zero was a double", () => {
    const next = applyFiveOhOneVisit(
      at(40),
      { scoreAttempted: 40, finishedOnDouble: true, dartsUsed: 1 },
      config(),
    );
    expect(next.remainingScore).toBe(0);
    expect(next.legsWon).toBe(1);
    expect(next.status).toBe("WON");
  });

  it("busts when the finishing dart was not a double, however many darts were at a double", () => {
    const next = applyFiveOhOneVisit(
      at(40),
      { scoreAttempted: 40, finishedOnDouble: false, dartsAtDouble: 3 },
      config(),
    );
    expect(next.remainingScore).toBe(40);
    expect(next.legsWon).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });
});

describe("applyFiveOhOneVisit — legs", () => {
  it("resets the remaining score and stays in progress while legs are left to win", () => {
    const state: FiveOhOneState = {
      remainingScore: 40,
      legsWon: 0,
      status: "IN_PROGRESS",
    };
    const next = applyFiveOhOneVisit(
      state,
      { scoreAttempted: 40, finishedOnDouble: true },
      { ...config(), legsToWin: 3 },
    );
    expect(next).toEqual({
      remainingScore: 501,
      legsWon: 1,
      status: "IN_PROGRESS",
    });
  });

  it("completes the session once legs won reaches legsToWin", () => {
    const state: FiveOhOneState = {
      remainingScore: 40,
      legsWon: 1,
      status: "IN_PROGRESS",
    };
    const next = applyFiveOhOneVisit(
      state,
      { scoreAttempted: 40, finishedOnDouble: true },
      { ...config(), legsToWin: 2 },
    );
    expect(next).toEqual({ remainingScore: 0, legsWon: 2, status: "WON" });
  });
});

describe("applyFiveOhOneVisit — terminal state guard", () => {
  it("throws when called on a state that is already WON", () => {
    const wonState: FiveOhOneState = {
      remainingScore: 0,
      legsWon: 1,
      status: "WON",
    };
    expect(() =>
      applyFiveOhOneVisit(wonState, { scoreAttempted: 20 }, config()),
    ).toThrow();
  });
});

describe("FiveOhOneEngine — Task 9 acceptance", () => {
  it("rejects an impossible visit score instead of inflating the total", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    expect(() => engine.record({ scoreAttempted: -100 })).toThrow(/0 and 180/);
    expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
    expect(engine.state().remainingScore).toBe(501);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("requires the finishing dart to be a double", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    const busted = engine.record({
      scoreAttempted: 40,
      finishedOnDouble: false,
      dartsAtDouble: 2,
    });

    expect(busted.status).toBe("IN_PROGRESS");
    expect(engine.state().remainingScore).toBe(40);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
  });

  it("wins the leg when the finishing dart is a double", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    const won = engine.record({
      scoreAttempted: 40,
      finishedOnDouble: true,
      dartsUsed: 2,
      dartsAtDouble: 1,
    });

    expect(won.status).toBe("WON");
    expect(engine.isComplete()).toBe(true);
  });

  it("busts when the visit would leave exactly one", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 140 });
    expect(engine.state().remainingScore).toBe(141);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
  });

  it("opens a new LEG stage per leg and completes at legsToWin", () => {
    const engine = fiveOhOneEngineFactory.create({
      ...config(),
      legsToWin: 2,
    });
    winOneLeg(engine);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().remainingScore).toBe(501);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.facts().stages[1].stageTypeKey).toBe("LEG");
    winOneLeg(engine);
    expect(engine.isComplete()).toBe(true);
  });

  it("rehydrates mid-leg from persisted facts", () => {
    const first = fiveOhOneEngineFactory.create(config());
    first.record({ scoreAttempted: 100 });
    const resumed = fiveOhOneEngineFactory.create(config(), first.facts());
    expect(resumed.state().remainingScore).toBe(401);
  });
});

describe("FiveOhOneEngine — state", () => {
  it("starts at the starting score with no turns and is not complete", () => {
    const engine = new FiveOhOneEngine(config());
    expect(engine.state()).toEqual({
      remainingScore: 501,
      legsWon: 0,
      status: "IN_PROGRESS",
    });
    expect(engine.facts().turns).toEqual([]);
    expect(engine.isComplete()).toBe(false);
  });

  it("folds successive visits into the remaining score", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    expect(engine.state().remainingScore).toBe(441);
    engine.record({ scoreAttempted: 100 });
    expect(engine.state().remainingScore).toBe(341);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.isComplete()).toBe(false);
  });

  it("accepts a custom starting score", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 301 });
    expect(engine.state().remainingScore).toBe(301);
  });

  it("refuses another visit once the session is complete", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 40 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record({ scoreAttempted: 20 })).toThrow();
    expect(engine.facts().turns).toHaveLength(1);
  });
});

describe("FiveOhOneEngine.facts", () => {
  it("opens exactly one LEG stage before any visit is recorded", () => {
    const engine = new FiveOhOneEngine(config());
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "leg-1",
        stageTypeKey: "LEG",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });

  it("records a visit total with no dart rows, since 501 is quick-score", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 100 });

    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(100);
    expect(turn.darts).toEqual([]);
    expect(turn.stageClientKey).toBe("leg-1");
    expect(turn.sequence).toBe(1);
    expect(turn.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("records a bust as a zero-scoring turn, never the attempted value", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 40 });
    engine.record({ scoreAttempted: 50 });
    expect(engine.facts().turns[0].totalScore).toBe(0);
    expect(engine.state().remainingScore).toBe(40);
  });

  it("mints a unique clientKey per turn", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
  });

  it("numbers turns from 1 again inside each new leg", () => {
    const engine = new FiveOhOneEngine({ ...config(), legsToWin: 2 });
    winOneLeg(engine);
    engine.record({ scoreAttempted: 60 });

    const facts = engine.facts();
    expect(facts.stages.map((stage) => stage.clientKey)).toEqual([
      "leg-1",
      "leg-2",
    ]);
    expect(
      facts.turns
        .filter((turn) => turn.stageClientKey === "leg-1")
        .map((turn) => turn.sequence),
    ).toEqual([1, 2, 3, 4]);
    expect(
      facts.turns
        .filter((turn) => turn.stageClientKey === "leg-2")
        .map((turn) => turn.sequence),
    ).toEqual([1]);
  });

  it("never emits a turn whose stage is missing, so the events batch builds", () => {
    const engine = new FiveOhOneEngine({ ...config(), legsToWin: 2 });
    winOneLeg(engine);
    engine.record({ scoreAttempted: 60 });

    const batch = buildEventsBatch("participant-1", engine.facts());
    expect(batch.stages).toHaveLength(2);
    expect(batch.stages[0].turns).toHaveLength(4);
    expect(batch.stages[1].turns).toHaveLength(1);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });

    engine.facts().turns.push(engine.facts().turns[0]);
    engine.facts().stages.push(engine.facts().stages[0]);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().stages).toHaveLength(1);
  });
});

describe("FiveOhOneEngine.wouldComplete", () => {
  it("is true for the checkout that wins the final leg", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 40 });
    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(true);
  });

  it("is false for a checkout that only wins a leg short of legsToWin", () => {
    const engine = new FiveOhOneEngine({
      ...config(),
      startingScore: 40,
      legsToWin: 2,
    });
    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(false);
  });

  it("is false for a checkout that was not finished on a double", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 40 });
    expect(
      engine.wouldComplete({
        scoreAttempted: 40,
        finishedOnDouble: false,
        dartsAtDouble: 2,
      }),
    ).toBe(false);
  });

  it("is false for an ordinary scoring visit", () => {
    const engine = new FiveOhOneEngine(config());
    expect(engine.wouldComplete({ scoreAttempted: 180 })).toBe(false);
  });

  it("is false for a score record would reject", () => {
    const engine = new FiveOhOneEngine(config());
    expect(engine.wouldComplete({ scoreAttempted: -100 })).toBe(false);
    expect(engine.wouldComplete({ scoreAttempted: 181 })).toBe(false);
  });

  it("is false once the session has already ended", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 40 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 40 });
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(true);

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
    expect(engine.isComplete()).toBe(false);
  });
});

describe("FiveOhOneEngine.undo", () => {
  it("returns false when there is nothing to undo", () => {
    const engine = new FiveOhOneEngine(config());
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() for a visit inside a leg", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 100 });
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state().remainingScore).toBe(441);
  });

  it("is an exact inverse of record over facts() for the visit that won a leg and opened the next", () => {
    const engine = new FiveOhOneEngine({ ...config(), legsToWin: 2 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    const before = engine.facts();
    expect(before.stages).toHaveLength(1);

    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state()).toEqual({
      remainingScore: 40,
      legsWon: 0,
      status: "IN_PROGRESS",
    });
  });

  it("is an exact inverse of record over facts() for the visit that won the final leg", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.isComplete()).toBe(false);
  });

  it("keeps the new leg open when undoing a visit recorded inside it", () => {
    const engine = new FiveOhOneEngine({ ...config(), legsToWin: 2 });
    winOneLeg(engine);
    engine.record({ scoreAttempted: 60 });
    expect(engine.state().remainingScore).toBe(441);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.state()).toEqual({
      remainingScore: 501,
      legsWon: 1,
      status: "IN_PROGRESS",
    });
  });

  it("reverts a bust visit, removing its turn", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    expect(engine.state().remainingScore).toBe(81);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);

    expect(engine.undo()).toBe(true);
    expect(engine.state().remainingScore).toBe(81);
    expect(engine.facts().turns).toHaveLength(3);
  });

  it("walks back across a leg boundary with repeated undos", () => {
    const engine = new FiveOhOneEngine({ ...config(), legsToWin: 2 });
    winOneLeg(engine);
    engine.record({ scoreAttempted: 60 });
    expect(engine.facts().turns).toHaveLength(5);

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().stages).toHaveLength(1);
    expect(engine.state()).toEqual({
      remainingScore: 40,
      legsWon: 0,
      status: "IN_PROGRESS",
    });
  });

  it("does not push a phantom turn when record is rejected on a finished session", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 101 });
    engine.record({ scoreAttempted: 61 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.isComplete()).toBe(true);
    expect(engine.facts().turns).toHaveLength(2);

    expect(() => engine.record({ scoreAttempted: 20 })).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().remainingScore).toBe(40);
    expect(engine.facts().turns).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.state().remainingScore).toBe(101);
    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.undo()).toBe(false);
  });

  it("does not push a phantom turn when record is rejected for an impossible score", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();

    expect(() => engine.record({ scoreAttempted: 500 })).toThrow(/0 and 180/);
    expect(engine.facts()).toEqual(before);
  });
});

describe("FiveOhOneEngine — rehydration", () => {
  it("resumes mid-leg with the same remaining score and turn numbering", () => {
    const first = fiveOhOneEngineFactory.create(config());
    first.record({ scoreAttempted: 100 });
    first.record({ scoreAttempted: 60 });

    const resumed = fiveOhOneEngineFactory.create(config(), first.facts());
    expect(resumed.state().remainingScore).toBe(341);
    resumed.record({ scoreAttempted: 41 });
    expect(resumed.state().remainingScore).toBe(300);
    expect(resumed.facts().turns.map((turn) => turn.sequence)).toEqual([
      1, 2, 3,
    ]);
  });

  it("resumes after a won leg with the leg count and open stage intact", () => {
    const first = fiveOhOneEngineFactory.create({ ...config(), legsToWin: 2 });
    winOneLeg(first);

    const resumed = fiveOhOneEngineFactory.create(
      { ...config(), legsToWin: 2 },
      first.facts(),
    );
    expect(resumed.state()).toEqual({
      remainingScore: 501,
      legsWon: 1,
      status: "IN_PROGRESS",
    });
    expect(resumed.facts().stages).toHaveLength(2);

    resumed.record({ scoreAttempted: 60 });
    expect(resumed.facts().turns.at(-1)?.stageClientKey).toBe("leg-2");
    expect(resumed.facts().turns.at(-1)?.sequence).toBe(1);
  });

  it("continues to undo across the rehydration boundary", () => {
    const first = fiveOhOneEngineFactory.create(config());
    first.record({ scoreAttempted: 100 });

    const resumed = fiveOhOneEngineFactory.create(config(), first.facts());
    const before = resumed.facts();
    resumed.record({ scoreAttempted: 60 });
    expect(resumed.undo()).toBe(true);
    expect(resumed.facts()).toEqual(before);

    expect(resumed.undo()).toBe(true);
    expect(resumed.state().remainingScore).toBe(501);
    expect(resumed.undo()).toBe(false);
  });
});
