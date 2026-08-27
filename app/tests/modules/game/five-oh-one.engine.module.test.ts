import { describe, it, expect } from "vitest";
import {
  FiveOhOneEngine,
  fiveOhOneEngineFactory,
  foldFiveOhOneState,
  initialFiveOhOneState,
  resolveFiveOhOneVisit,
} from "@modules/game/five-oh-one.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import type { GameEngine } from "@modules/interfaces";
import type {
  DartZoneKey,
  EngineFacts,
  FiveOhOneState,
  FiveOhOneVisitInput,
  MultiSeatState,
} from "@modules/types";
import type { FiveOhOneSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = () =>
  ({
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SEATS,
  }) satisfies Seated<FiveOhOneSnapshot>;

type FiveOhOneGameEngine = GameEngine<FiveOhOneVisitInput, FiveOhOneState>;

/** Plays 180, 180, 101 and a 40 checkout finished on a double — one whole leg. */
function winOneLeg(engine: FiveOhOneGameEngine): FiveOhOneState {
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 101 });
  return engine.record({
    scoreAttempted: 40,
    finishedOnDouble: true,
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

function factsOf(scores: number[]): EngineFacts {
  return {
    stages: [
      {
        clientKey: "leg-1",
        stageTypeKey: "LEG",
        parentClientKey: null,
        sequence: 1,
      },
    ],
    turns: scores.map((totalScore, index) => ({
      clientKey: `t${index + 1}`,
      stageClientKey: "leg-1",
      participantRef: "participant-1",
      sequence: index + 1,
      completedAt: "2026-08-20T10:00:00.000Z",
      totalScore,
      darts: [],
    })),
  };
}

describe("initialFiveOhOneState", () => {
  it("starts every seat at the configured starting score with no legs won", () => {
    expect(initialFiveOhOneState(config())).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 501,
        },
      ],
    });
  });

  it("honours a non-default starting score", () => {
    expect(
      initialFiveOhOneState({ ...config(), startingScore: 301 }).seats[0]
        .remainingScore,
    ).toBe(301);
  });
});

describe("foldFiveOhOneState", () => {
  it("subtracts each counted visit from the seat that threw it", () => {
    const state = foldFiveOhOneState(factsOf([180, 60]), config());
    expect(state.seats[0].remainingScore).toBe(261);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("treats a scoreless turn as the bust it was recorded as", () => {
    const state = foldFiveOhOneState(factsOf([180, 0]), config());
    expect(state.seats[0].remainingScore).toBe(321);
  });

  it("wins the match for the seat's side when the last leg checks out", () => {
    const state = foldFiveOhOneState(factsOf([180, 180, 101, 40]), config());
    expect(state.status).toBe("WON");
    expect(state.winningSideKey).toBe("A");
    expect(state.sides[0].legsWon).toBe(1);
  });

  it("conforms to MultiSeatState so a generic scoreboard can read it", () => {
    const state: MultiSeatState = foldFiveOhOneState(factsOf([60]), config());
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.seats[0].sideKey).toBe("A");
  });

  it("resets every seat at a leg boundary and keeps the side's leg count", () => {
    const state = foldFiveOhOneState(
      {
        stages: [
          {
            clientKey: "leg-1",
            stageTypeKey: "LEG",
            parentClientKey: null,
            sequence: 1,
          },
          {
            clientKey: "leg-2",
            stageTypeKey: "LEG",
            parentClientKey: null,
            sequence: 2,
          },
        ],
        turns: [180, 180, 101, 40].map((totalScore, index) => ({
          clientKey: `t${index + 1}`,
          stageClientKey: "leg-1",
          participantRef: "participant-1",
          sequence: index + 1,
          completedAt: "2026-08-20T10:00:00.000Z",
          totalScore,
          darts: [],
        })),
      },
      { ...config(), legsToWin: 3 },
    );

    expect(state.status).toBe("IN_PROGRESS");
    expect(state.sides[0].legsWon).toBe(1);
    expect(state.seats[0].remainingScore).toBe(501);
  });
});

describe("resolveFiveOhOneVisit — bust matrix", () => {
  it("busts on an overshoot and leaves the remaining score unchanged", () => {
    const outcome = resolveFiveOhOneVisit(40, { scoreAttempted: 50 });
    expect(outcome.isBust).toBe(true);
    expect(outcome.scored).toBe(0);
    expect(outcome.remainingAfter).toBe(40);
  });

  it("busts when the visit would leave exactly 1, which cannot be finished on a double", () => {
    const outcome = resolveFiveOhOneVisit(41, { scoreAttempted: 40 });
    expect(outcome.isBust).toBe(true);
    expect(outcome.remainingAfter).toBe(41);
  });

  it("treats a visit that would leave exactly 2 as a legal reduction, since 2 is finishable as D1", () => {
    const outcome = resolveFiveOhOneVisit(42, { scoreAttempted: 40 });
    expect(outcome.isBust).toBe(false);
    expect(outcome.remainingAfter).toBe(2);
  });

  it("ignores a finish flag on an overshoot bust", () => {
    const outcome = resolveFiveOhOneVisit(40, {
      scoreAttempted: 50,
      finishedOnDouble: true,
    });
    expect(outcome.isBust).toBe(true);
    expect(outcome.remainingAfter).toBe(40);
  });

  it("ignores a finish flag on a leaves-exactly-1 bust", () => {
    const outcome = resolveFiveOhOneVisit(41, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(outcome.isBust).toBe(true);
    expect(outcome.remainingAfter).toBe(41);
  });

  it("busts when the visit reaches zero but no finish was declared", () => {
    const outcome = resolveFiveOhOneVisit(40, { scoreAttempted: 40 });
    expect(outcome.isBust).toBe(true);
    expect(outcome.wonLeg).toBe(false);
    expect(outcome.remainingAfter).toBe(40);
  });

  it("ignores a finish flag on a visit that does not reach zero", () => {
    const outcome = resolveFiveOhOneVisit(100, {
      scoreAttempted: 60,
      finishedOnDouble: true,
    });
    expect(outcome.isBust).toBe(false);
    expect(outcome.wonLeg).toBe(false);
    expect(outcome.remainingAfter).toBe(40);
  });
});

describe("resolveFiveOhOneVisit — double out", () => {
  it("wins the leg when the dart that reached zero was a double", () => {
    const outcome = resolveFiveOhOneVisit(40, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(outcome.wonLeg).toBe(true);
    expect(outcome.remainingAfter).toBe(0);
  });

  it("busts when the finishing dart was not a double", () => {
    const outcome = resolveFiveOhOneVisit(40, {
      scoreAttempted: 40,
      finishedOnDouble: false,
    });
    expect(outcome.isBust).toBe(true);
    expect(outcome.wonLeg).toBe(false);
    expect(outcome.remainingAfter).toBe(40);
  });
});

describe("FiveOhOneEngine — visit score cap", () => {
  it("throws on a negative score rather than inflating the remaining total", () => {
    const engine = new FiveOhOneEngine(config());
    expect(() => engine.record({ scoreAttempted: -100 })).toThrow(/0 and 180/);
  });

  it("throws above the ruleset's maximum visit score", () => {
    const engine = new FiveOhOneEngine(config());
    expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
  });

  it("throws on a score that is not a whole number", () => {
    const engine = new FiveOhOneEngine(config());
    expect(() => engine.record({ scoreAttempted: 60.5 })).toThrow(/0 and 180/);
  });

  it("accepts a scoreless visit of 0", () => {
    const engine = new FiveOhOneEngine(config());
    const state = engine.record({ scoreAttempted: 0 });
    expect(state.seats[0].remainingScore).toBe(501);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("FiveOhOneEngine — terminal state guard", () => {
  it("throws when recording a visit into a session that is already WON", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });

    expect(engine.state().status).toBe("WON");
    expect(() => engine.record({ scoreAttempted: 20 })).toThrow();
  });
});

describe("FiveOhOneEngine — Task 9 acceptance", () => {
  it("rejects an impossible visit score instead of inflating the total", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    expect(() => engine.record({ scoreAttempted: -100 })).toThrow(/0 and 180/);
    expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
    expect(engine.state().seats[0].remainingScore).toBe(501);
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
    });

    expect(busted.status).toBe("IN_PROGRESS");
    expect(engine.state().seats[0].remainingScore).toBe(40);
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
    });

    expect(won.status).toBe("WON");
    expect(engine.isComplete()).toBe(true);
  });

  it("busts when the visit would leave exactly one", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 140 });
    expect(engine.state().seats[0].remainingScore).toBe(141);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
  });

  it("opens a new LEG stage per leg and completes at legsToWin", () => {
    const engine = fiveOhOneEngineFactory.create({
      ...config(),
      legsToWin: 2,
    });
    winOneLeg(engine);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].remainingScore).toBe(501);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.facts().stages[1].stageTypeKey).toBe("LEG");
    winOneLeg(engine);
    expect(engine.isComplete()).toBe(true);
  });

  it("rehydrates mid-leg from persisted facts", () => {
    const first = fiveOhOneEngineFactory.create(config());
    first.record({ scoreAttempted: 100 });
    const resumed = fiveOhOneEngineFactory.create(config(), first.facts());
    expect(resumed.state().seats[0].remainingScore).toBe(401);
  });
});

describe("FiveOhOneEngine — state", () => {
  it("starts at the starting score with no turns and is not complete", () => {
    const engine = new FiveOhOneEngine(config());
    expect(engine.state()).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 501,
        },
      ],
    });
    expect(engine.facts().turns).toEqual([]);
    expect(engine.isComplete()).toBe(false);
  });

  it("folds successive visits into the remaining score", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    expect(engine.state().seats[0].remainingScore).toBe(441);
    engine.record({ scoreAttempted: 100 });
    expect(engine.state().seats[0].remainingScore).toBe(341);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.isComplete()).toBe(false);
  });

  it("accepts a custom starting score", () => {
    const engine = new FiveOhOneEngine({ ...config(), startingScore: 301 });
    expect(engine.state().seats[0].remainingScore).toBe(301);
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
    expect(engine.state().seats[0].remainingScore).toBe(40);
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

    const batch = buildEventsBatch(engine.facts());
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
    expect(engine.state().seats[0].remainingScore).toBe(441);
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
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 40,
        },
      ],
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
    const before = engine.facts();
    engine.record({ scoreAttempted: 60 });
    expect(engine.state().seats[0].remainingScore).toBe(441);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.state()).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 1 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 501,
        },
      ],
    });
  });

  it("reverts a bust visit, removing its turn", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    expect(engine.state().seats[0].remainingScore).toBe(81);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);

    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].remainingScore).toBe(81);
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
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 40,
        },
      ],
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
    expect(engine.state().seats[0].remainingScore).toBe(40);
    expect(engine.facts().turns).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].remainingScore).toBe(101);
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
    expect(resumed.state().seats[0].remainingScore).toBe(341);
    resumed.record({ scoreAttempted: 41 });
    expect(resumed.state().seats[0].remainingScore).toBe(300);
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
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 1 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 501,
        },
      ],
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
    expect(resumed.state().seats[0].remainingScore).toBe(501);
    expect(resumed.undo()).toBe(false);
  });
});

describe("visual board capture", () => {
  const config = {
    startingScore: 501,
    maxVisitScore: 180,
    legsToWin: 1,
    seats: SEATS,
  } as never;

  /**
   * A located dart. The engine re-classifies from the coordinate, so the
   * claimed zone is never authoritative — but it is stated truthfully anyway,
   * because a fixture claiming MISS while resolving to a treble reads like it
   * covers the unseen-dart path. It does not: that path needs null
   * coordinates, and is covered by its own tests.
   */
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);
  const doubleTwenty = dartAt(0, -166, "DOUBLE", 20);

  it("deducts each dart from the remaining score as it lands", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    expect(engine.state().seats[0].remainingScore).toBe(441);

    engine.record(trebleTwenty);
    expect(engine.state().seats[0].remainingScore).toBe(381);
  });

  it("keeps dart rows with real scores when a visit busts", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 70 } as never,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const busted = engine.facts().turns.at(-1)!;
    expect(busted.totalScore).toBe(0);
    expect(busted.darts.map((dart) => dart.score)).toEqual([60, 60]);
    expect(engine.state().seats[0].remainingScore).toBe(70);
  });

  it("wins the leg on a double that reaches exactly zero", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 40 } as never,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(doubleTwenty);

    expect(engine.isComplete()).toBe(true);
    const turn = engine.facts().turns.at(-1)!;
    expect(turn.darts).toHaveLength(1);
    expect(turn.totalScore).toBe(40);
  });

  it("does not win on a non-double that reaches zero", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 60 } as never,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);

    expect(engine.isComplete()).toBe(false);
    expect(engine.facts().turns.at(-1)!.totalScore).toBe(0);
  });

  it("undoes one dart at a time", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].remainingScore).toBe(441);
  });

  it("leaves quick-score behaviour unchanged", () => {
    const engine = fiveOhOneEngineFactory.create(config) as FiveOhOneEngine;

    engine.record({ scoreAttempted: 60 });

    expect(engine.state().seats[0].remainingScore).toBe(441);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(0);
  });
});

describe("FiveOhOneEngine.wouldComplete — visual board", () => {
  const config = {
    startingScore: 40,
    maxVisitScore: 180,
    legsToWin: 1,
    seats: SEATS,
  } as never;

  /**
   * A located dart. The engine re-classifies from the coordinate, so the
   * claimed zone is never authoritative — but it is stated truthfully anyway,
   * because a fixture claiming MISS while resolving to a treble reads like it
   * covers the unseen-dart path. It does not: that path needs null
   * coordinates, and is covered by its own tests.
   */
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);
  const doubleTwenty = dartAt(0, -166, "DOUBLE", 20);
  const miss = dartAt(0, -190, "MISS", null);

  it("is false for a dart that merely opens a visit", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;

    expect(engine.wouldComplete(trebleTwenty)).toBe(false);
  });

  it("is true for a first-dart checkout on the final leg", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;

    expect(engine.wouldComplete(doubleTwenty)).toBe(true);
  });

  it("is false for a checkout that only wins a leg short of legsToWin", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), legsToWin: 2 } as never,
      undefined,
    ) as FiveOhOneEngine;

    expect(engine.wouldComplete(doubleTwenty)).toBe(false);
  });

  it("is false once a visit is open on two darts with no checkout dart", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...(config as object), startingScore: 501 } as never,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    expect(engine.wouldComplete(trebleTwenty)).toBe(false);
  });

  it("does not mutate the fact log", () => {
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;
    const before = engine.facts();

    expect(engine.wouldComplete(doubleTwenty)).toBe(true);
    expect(engine.wouldComplete(miss)).toBe(false);

    expect(engine.facts()).toEqual(before);
  });
});

describe("FiveOhOneEngine.undo — visual board", () => {
  /**
   * A located dart. The engine re-classifies from the coordinate, so the
   * claimed zone is never authoritative — but it is stated truthfully anyway,
   * because a fixture claiming MISS while resolving to a treble reads like it
   * covers the unseen-dart path. It does not: that path needs null
   * coordinates, and is covered by its own tests.
   */
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);
  const doubleTwenty = dartAt(0, -166, "DOUBLE", 20);

  it("undoes a checkout thrown on the second dart of a visit, popping the newly-opened leg and leaving the first dart in the earlier leg", () => {
    const config = {
      startingScore: 100,
      maxVisitScore: 180,
      legsToWin: 2,
      seats: SEATS,
    } as never;
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(doubleTwenty);
    expect(engine.state()).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 1 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 100,
        },
      ],
    });
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().stages).toHaveLength(1);
    const reopened = engine.facts().turns.at(-1)!;
    expect(reopened.darts).toHaveLength(1);
    expect(reopened.darts[0].score).toBe(60);
    expect(reopened.completedAt).toBeNull();
    expect(engine.state()).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 40,
        },
      ],
    });

    expect(engine.undo()).toBe(true);
    expect(engine.facts().stages).toHaveLength(1);
    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state()).toEqual({
      activeParticipantRef: "participant-1",
      status: "IN_PROGRESS",
      winningSideKey: null,
      sides: [{ sideKey: "A", legsWon: 0 }],
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          remainingScore: 100,
        },
      ],
    });
    expect(engine.undo()).toBe(false);
  });

  it("leaves the stage list untouched when undoing a dart from an ordinary visit that never opened a leg", () => {
    const config = {
      startingScore: 501,
      maxVisitScore: 180,
      legsToWin: 2,
      seats: SEATS,
    } as never;
    const engine = fiveOhOneEngineFactory.create(
      config,
      undefined,
    ) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    const stagesBefore = engine.facts().stages;
    expect(stagesBefore).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().stages).toHaveLength(1);
    expect(engine.facts().stages).toEqual(stagesBefore);
  });
});

describe("FiveOhOneEngine.record — keypad input under VISUAL_BOARD (shape-based dispatch)", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });
  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);

  it("a keypad visit total on a VISUAL_BOARD engine produces the same fact-log result as the same input on a QUICK_SCORE engine", () => {
    const visualEngine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;
    const quickEngine = fiveOhOneEngineFactory.create(
      config(),
    ) as FiveOhOneEngine;

    visualEngine.record({ scoreAttempted: 100 });
    quickEngine.record({ scoreAttempted: 100 });

    const visualTurn = visualEngine.facts().turns.at(-1)!;
    const quickTurn = quickEngine.facts().turns.at(-1)!;
    expect(visualTurn.totalScore).toBe(100);
    expect(visualTurn.darts).toEqual([]);
    expect(visualTurn.totalScore).toBe(quickTurn.totalScore);
    expect(visualTurn.darts).toEqual(quickTurn.darts);
    expect(visualEngine.state().seats[0].remainingScore).toBe(401);
  });

  it("accepts a keypad visit total from a clean VISUAL_BOARD engine — the keypad stays usable as the accessible alternative", () => {
    const engine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;

    expect(() => engine.record({ scoreAttempted: 60 })).not.toThrow();

    expect(engine.state().seats[0].remainingScore).toBe(441);
    const turn = engine.facts().turns.at(-1)!;
    expect(turn.totalScore).toBe(60);
    expect(turn.darts).toEqual([]);
  });

  it("rejects a keypad visit total while a board-recorded visit is still open, and leaves the fact log untouched", () => {
    const engine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;
    engine.record(trebleTwenty);
    const before = engine.facts();

    expect(() => engine.record({ scoreAttempted: 60 })).toThrow();
    expect(engine.facts()).toEqual(before);
  });

  it("wouldComplete also refuses a mid-visit keypad total rather than mis-dispatching it as a dart", () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...config(), startingScore: 100 },
      undefined,
    ) as FiveOhOneEngine;
    engine.record(trebleTwenty);

    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(false);
  });

  it("undo removes a keypad-recorded visit as a whole unit even on a VISUAL_BOARD engine", () => {
    const engine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;
    engine.record({ scoreAttempted: 60 });

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state().seats[0].remainingScore).toBe(501);
  });
});

describe("FiveOhOneEngine.undo — dispatches on the fact log's shape", () => {
  /**
   * A located dart. The engine re-classifies from the coordinate, so the
   * claimed zone is never authoritative — but it is stated truthfully anyway,
   * because a fixture claiming MISS while resolving to a treble reads like it
   * covers the unseen-dart path. It does not: that path needs null
   * coordinates, and is covered by its own tests.
   */
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);

  /**
   * The Task 7d regression, kept as a live guard now that the engine's
   * `inputMode` field is gone: `undo()` once trusted that field instead of
   * the fact log, so an engine tagged `QUICK_SCORE` (which `playAgain()`
   * produced for a genuinely VISUAL_BOARD session, by passing no mode at all)
   * popped the whole open visit — both darts — instead of the one dart the
   * player asked to remove, while `record()` had already let those board
   * darts through. Nothing can carry a mode tag any more, so this reads as a
   * plain undo-depth check; it earns its place because the fact log's shape,
   * which is what `undo()` must branch on, is exactly what it exercises.
   */
  it("undoing a defaulted (QUICK_SCORE-tagged) engine after two board darts removes exactly one dart and leaves the first intact", () => {
    const engine = fiveOhOneEngineFactory.create(config()) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.state().seats[0].remainingScore).toBe(381);

    expect(engine.undo()).toBe(true);

    const visit = engine.facts().turns.at(-1)!;
    expect(visit.darts).toHaveLength(1);
    expect(visit.darts[0].score).toBe(60);
    expect(visit.completedAt).toBeNull();
    expect(engine.state().seats[0].remainingScore).toBe(441);
  });

  /**
   * A general correctness check, never a regression guard: back when the
   * engine still carried a mode tag, a genuinely VISUAL_BOARD-tagged engine
   * passed this under the old mode-keyed undo() too, because pop() on an
   * empty darts array is a no-op falling into the same turns.pop() branch.
   * It covers the mixed-shape log, not the dispatch rule.
   */
  it("unwinds a mixed keypad-then-board log one record() at a time", () => {
    const engine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;

    engine.record({ scoreAttempted: 60 });
    expect(engine.state().seats[0].remainingScore).toBe(441);

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.state().seats[0].remainingScore).toBe(321);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(1);
    expect(engine.state().seats[0].remainingScore).toBe(381);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state().seats[0].remainingScore).toBe(441);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state().seats[0].remainingScore).toBe(501);

    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse across a mixed sequence for an engine tagged QUICK_SCORE (defaulted)", () => {
    const engine = fiveOhOneEngineFactory.create(config()) as FiveOhOneEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.state().seats[0].remainingScore).toBe(321);

    engine.record({ scoreAttempted: 60 });
    expect(engine.state().seats[0].remainingScore).toBe(261);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state().seats[0].remainingScore).toBe(321);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(2);
    expect(engine.state().seats[0].remainingScore).toBe(381);

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state().seats[0].remainingScore).toBe(501);

    expect(engine.undo()).toBe(false);
  });
});

describe("FiveOhOneEngine.record — refusing a dart into a finished match", () => {
  /**
   * The refusal must leave the fact log untouched, which is the half that was
   * broken: `recordDart` pushed the dart (and, at a visit boundary, a whole new
   * turn) before the fold that rejects the throw ever ran, so a caught error
   * left rows behind in a log the method's own contract says it did not touch.
   * Reachable after an upload failure: the page's `finished` flag is not
   * persisted, so a reload rebuilds a WON engine behind a live board.
   */
  const finishedEngine = () => {
    const engine = fiveOhOneEngineFactory.create(
      { ...config(), startingScore: 40, legsToWin: 1 },
      undefined,
    ) as FiveOhOneEngine;
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
    return engine;
  };

  it("throws when a dart is recorded into a won match", () => {
    const engine = finishedEngine();
    expect(engine.state().status).toBe("WON");

    expect(() =>
      engine.record({
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: -102,
      }),
    ).toThrow(/complete/);
  });

  it("leaves the fact log untouched when it refuses", () => {
    const engine = finishedEngine();
    const before = JSON.stringify(engine.facts());

    try {
      engine.record({
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        locationX: 0,
        locationY: -102,
      });
    } catch {
      /* the throw is asserted above; this test is about the log */
    }

    expect(JSON.stringify(engine.facts())).toBe(before);
  });
});

describe("501 checkout dart counts", () => {
  it("rejects a checkout claiming fewer darts than the route needs", () => {
    const engine = fiveOhOneEngineFactory.create({
      ...config(),
      startingScore: 41,
    });
    expect(() =>
      engine.record({
        scoreAttempted: 41,
        finishedOnDouble: true,
        dartsUsed: 1,
      }),
    ).toThrow(/at least 2 darts/);
  });

  it("accepts a checkout whose dart counts fit the route", () => {
    const engine = fiveOhOneEngineFactory.create({
      ...config(),
      startingScore: 41,
    });
    expect(() =>
      engine.record({
        scoreAttempted: 41,
        finishedOnDouble: true,
        dartsUsed: 2,
        dartsAtDouble: 1,
      }),
    ).not.toThrow();
  });

  it("ignores dart counts on a visit that did not check out", () => {
    const engine = fiveOhOneEngineFactory.create(config());
    expect(() =>
      engine.record({
        scoreAttempted: 60,
        finishedOnDouble: false,
        dartsUsed: 1,
      }),
    ).not.toThrow();
  });
});

const TWO_SEATS = [
  {
    participantRef: "seat-a",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "seat-b",
    displayName: "Dad",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
  },
];

const duo = (legsToWin = 1) =>
  ({
    startingScore: 501,
    legsToWin,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: TWO_SEATS,
  }) satisfies Seated<FiveOhOneSnapshot>;

/** Plays one whole leg for seat A while seat B scores 60 between every visit. */
function seatAWinsALeg(engine: FiveOhOneEngine): FiveOhOneState {
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 60 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 60 });
  engine.record({ scoreAttempted: 101 });
  engine.record({ scoreAttempted: 60 });
  return engine.record({ scoreAttempted: 40, finishedOnDouble: true });
}

describe("FiveOhOneEngine with two seats", () => {
  it("alternates seats visit by visit within one shared leg", () => {
    const engine = new FiveOhOneEngine(duo());
    expect(engine.state().activeParticipantRef).toBe("seat-a");

    engine.record({ scoreAttempted: 60 });
    expect(engine.state().activeParticipantRef).toBe("seat-b");

    engine.record({ scoreAttempted: 100 });
    expect(engine.state().activeParticipantRef).toBe("seat-a");
  });

  it("leaves the other seat's score untouched", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 180 });
    const state = engine.record({ scoreAttempted: 60 });

    expect(state.seats[0].remainingScore).toBe(321);
    expect(state.seats[1].remainingScore).toBe(441);
  });

  it("leaves the other seat's score untouched on a bust", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    const state = engine.record({ scoreAttempted: 180 });

    expect(state.seats[0].remainingScore).toBe(141);
    expect(state.seats[1].remainingScore).toBe(141);
  });

  it("resets every seat and opens exactly one shared next leg", () => {
    const engine = new FiveOhOneEngine(duo(2));
    const state = seatAWinsALeg(engine);

    expect(state.status).toBe("IN_PROGRESS");
    expect(state.seats.map((seat) => seat.remainingScore)).toEqual([501, 501]);
    expect(engine.facts().stages).toHaveLength(2);
  });

  it("folds legs won per side, not per seat", () => {
    const engine = new FiveOhOneEngine(duo(2));
    seatAWinsALeg(engine);
    const state = engine.state();

    expect(state.sides).toEqual([
      { sideKey: "A", legsWon: 1 },
      { sideKey: "B", legsWon: 0 },
    ]);
  });

  it("starts leg 2 with seat B and leg 3 with seat A", () => {
    const engine = new FiveOhOneEngine(duo(3));
    seatAWinsALeg(engine);
    expect(engine.state().activeParticipantRef).toBe("seat-b");

    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.state().activeParticipantRef).toBe("seat-a");
  });

  it("gives every turn a participantRef that is one of the seats", () => {
    const engine = new FiveOhOneEngine(duo(2));
    seatAWinsALeg(engine);

    const refs = new Set(TWO_SEATS.map((seat) => seat.participantRef));
    for (const turn of engine.facts().turns) {
      expect(refs.has(turn.participantRef)).toBe(true);
    }
  });

  it("numbers interleaved turns 1..N within the leg, not per seat", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });

    expect(engine.facts().turns.map((turn) => turn.sequence)).toEqual([
      1, 2, 3,
    ]);
  });

  it("wouldComplete is true only for the visit that takes a side to legsToWin", () => {
    const engine = new FiveOhOneEngine(duo(2));
    seatAWinsALeg(engine);
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 101 });

    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(false);

    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 60 });
    expect(
      engine.wouldComplete({ scoreAttempted: 40, finishedOnDouble: true }),
    ).toBe(true);
  });

  it("undo across the seat boundary hands the turn back and restores facts exactly", () => {
    const engine = new FiveOhOneEngine(duo());
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();
    engine.record({ scoreAttempted: 100 });

    expect(engine.state().activeParticipantRef).toBe("seat-a");
    expect(engine.undo()).toBe(true);
    expect(engine.state().activeParticipantRef).toBe("seat-b");
    expect(engine.facts()).toEqual(before);
  });

  it("rehydrates a mid-leg three-seat log onto the same active seat", () => {
    const trio = {
      ...duo(),
      seats: [
        ...TWO_SEATS,
        {
          participantRef: "seat-c",
          displayName: "Jan",
          sideKey: "C",
          participantTypeKey: "GUEST" as const,
        },
      ],
    } satisfies Seated<FiveOhOneSnapshot>;

    const engine = new FiveOhOneEngine(trio);
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    const expected = engine.state().activeParticipantRef;

    const resumed = new FiveOhOneEngine(trio, engine.facts());
    expect(resumed.state().activeParticipantRef).toBe(expected);
    expect(resumed.state()).toEqual(engine.state());
  });
});

describe("501 board-dart resolution and undo", () => {
  it("keeps a coordinate-less dart's own zone and scores it 0", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.hitTargetNumber).toBeNull();
    expect(dart.hitZoneKey).toBe("MISS");
    expect(dart.score).toBe(0);
    expect(dart.intendedTargetNumber).toBeNull();
    expect(engine.state().seats[0].remainingScore).toBe(501);
  });

  it("classifies a dart that carries coordinates and carries them onto the fact", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("INNER_BULL");
    expect(dart.score).toBe(50);
    expect(dart.locationX).toBe(0);
    expect(dart.locationY).toBe(0);
  });

  it("undo pops one dart at a time and takes the visit with the last one", () => {
    const engine = new FiveOhOneEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: 0,
      locationY: 0,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toEqual([]);
    expect(engine.undo()).toBe(false);
  });
});

describe("FiveOhOneEngine dart-path bust boundary", () => {
  it("busts a board visit that would leave exactly 1, matching the keypad rule", () => {
    const engine = fiveOhOneEngineFactory.create({
      ...config(),
      startingScore: 41,
    }) as FiveOhOneGameEngine;

    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 1,
      locationY: 1,
    });

    const state = engine.state();
    expect(state.seats[0].remainingScore).toBe(41);
  });
});
