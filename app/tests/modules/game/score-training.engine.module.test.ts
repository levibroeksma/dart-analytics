import { describe, it, expect } from "vitest";
import {
  ScoreTrainingEngine,
  scoreTrainingEngineFactory,
} from "@modules/game/score-training.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { ScoreTrainingState } from "@modules/types";
import type { ScoreTrainingSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const ROUNDS_10: Seated<ScoreTrainingSnapshot> = {
  durationType: "ROUNDS",
  durationValue: 10,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
  seats: SEATS,
};

function minutes(durationValue: number): Seated<ScoreTrainingSnapshot> {
  return {
    durationType: "MINUTES",
    durationValue,
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SEATS,
  };
}

describe("scoreTrainingEngineFactory", () => {
  it("registers itself under SCORE_TRAINING_V1", () => {
    expect(scoreTrainingEngineFactory.rulesetVersionKey).toBe(
      "SCORE_TRAINING_V1",
    );
    expect(getEngineFactory("SCORE_TRAINING_V1")).toBe(
      scoreTrainingEngineFactory,
    );
  });

  it("builds a ScoreTrainingEngine bound to the ruleset version", () => {
    const engine = scoreTrainingEngineFactory.create(ROUNDS_10);
    expect(engine).toBeInstanceOf(ScoreTrainingEngine);
    expect(engine.rulesetVersionKey).toBe("SCORE_TRAINING_V1");
  });

  it("rehydrates from persisted facts and continues the sequence", () => {
    const first = scoreTrainingEngineFactory.create(ROUNDS_10);
    first.record(60);
    first.record(45);

    const resumed = scoreTrainingEngineFactory.create(ROUNDS_10, first.facts());
    resumed.record(100);

    expect(resumed.facts().turns).toHaveLength(3);
    expect(resumed.facts().turns.at(-1)?.sequence).toBe(3);
    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns).toHaveLength(2);
  });
});

describe("ScoreTrainingEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(60);

    const facts = engine.facts();
    expect(facts.stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
    expect(facts.turns[0].stageClientKey).toBe("block-1");
  });

  it("mints a unique clientKey and an ISO completedAt per visit", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(60);
    engine.record(60);

    const [a, b] = engine.facts().turns;
    expect(a.clientKey).not.toBe(b.clientKey);
    expect(a.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(a.stageClientKey).toBe(engine.facts().stages[0].clientKey);
  });

  it("records an incrementing sequence, a quick-score total and no darts", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(20);
    engine.record(30);

    const [first, second] = engine.facts().turns;
    expect(first.sequence).toBe(1);
    expect(first.totalScore).toBe(20);
    expect(first.darts).toEqual([]);
    expect(second.sequence).toBe(2);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(60);

    engine.facts().turns.push(engine.facts().turns[0]);
    expect(engine.facts().turns).toHaveLength(1);
  });
});

describe("ScoreTrainingEngine.record validation", () => {
  it("rejects a visit score above the ruleset cap", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect(() => engine.record(181)).toThrow(/0 and 180/);
    expect(() => engine.record(-1)).toThrow(/0 and 180/);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rejects a non-integer visit score", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect(() => engine.record(Number.NaN)).toThrow(/0 and 180/);
    expect(() => engine.record(12.5)).toThrow(/0 and 180/);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("bounds the cap by the ruleset config rather than a hardcoded 180", () => {
    const engine = new ScoreTrainingEngine({
      ...ROUNDS_10,
      maxVisitScore: 60,
    });
    expect(() => engine.record(61)).toThrow(/0 and 60/);
    expect(() => engine.record(60)).not.toThrow();
  });
});

describe("ScoreTrainingEngine.isComplete (ROUNDS)", () => {
  it("completes after the configured number of rounds", () => {
    const engine = new ScoreTrainingEngine({
      ...ROUNDS_10,
      durationValue: 2,
    });
    engine.record(60);
    expect(engine.isComplete()).toBe(false);
    engine.record(60);
    expect(engine.isComplete()).toBe(true);
  });
});

describe("ScoreTrainingEngine.isComplete (MINUTES)", () => {
  it("does not complete on a timer expiry before any visit is recorded", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.expireTimer();
    expect(engine.isComplete()).toBe(false);
  });

  it("completes once the timer has expired and at least one visit is recorded", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
  });

  it("completes when the visit is recorded after the timer expired", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.expireTimer();
    engine.record(30);
    expect(engine.isComplete()).toBe(true);
  });

  it("does not complete while the timer has not expired, regardless of visit count", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);
    engine.record(30);
    expect(engine.isComplete()).toBe(false);
  });

  it("starts every session with the timer unexpired, even when rehydrated", () => {
    const seed = new ScoreTrainingEngine(minutes(15));
    seed.record(30);
    const resumed = new ScoreTrainingEngine(minutes(15), seed.facts());
    expect(resumed.state().timerExpired).toBe(false);
    expect(resumed.isComplete()).toBe(false);
  });

  it("ignores a timerExpired written onto a previously returned state object", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);

    const leaked = engine.state();
    leaked.timerExpired = true;

    expect(engine.state().timerExpired).toBe(false);
    expect(engine.isComplete()).toBe(false);
    expect(engine.wouldComplete(45)).toBe(false);
  });
});

describe("ScoreTrainingEngine.wouldComplete", () => {
  it("is false for the visit before the last and true for the last (ROUNDS)", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 3 });
    engine.record(60);
    expect(engine.wouldComplete(60)).toBe(false);
    engine.record(60);
    expect(engine.wouldComplete(60)).toBe(true);
  });

  it("is true for the very first visit when the ruleset is a single round", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 1 });
    expect(engine.wouldComplete(60)).toBe(true);
  });

  it("is false before the timer expires and true after it (MINUTES)", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);
    expect(engine.wouldComplete(45)).toBe(false);

    engine.expireTimer();
    expect(engine.wouldComplete(45)).toBe(true);
  });

  it("is true for the first visit once the timer has expired (MINUTES)", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.expireTimer();
    expect(engine.wouldComplete(45)).toBe(true);
  });

  it("is false for a score the ruleset would reject, so the caller surfaces the range error", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 1 });
    expect(engine.wouldComplete(181)).toBe(false);
    expect(engine.wouldComplete(12.5)).toBe(false);
  });

  it("does not mutate the fact log or the live state", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 2 });
    engine.record(60);
    const factsBefore = structuredClone(engine.facts());
    const turnCountBefore = (engine.state() as ScoreTrainingState).seats[0]
      .turnCount;

    expect(engine.wouldComplete(45)).toBe(true);

    expect(engine.facts()).toEqual(factsBefore);
    expect((engine.state() as ScoreTrainingState).seats[0].turnCount).toBe(
      turnCountBefore,
    );
  });
});

describe("ScoreTrainingEngine.state", () => {
  it("reports the live turn count through record and undo", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect((engine.state() as ScoreTrainingState).seats[0].turnCount).toBe(0);
    expect((engine.record(40) as ScoreTrainingState).seats[0].turnCount).toBe(
      1,
    );
    engine.undo();
    expect((engine.state() as ScoreTrainingState).seats[0].turnCount).toBe(0);
  });
});

describe("ScoreTrainingEngine.undo", () => {
  it("pops the last turn and returns true; the next record reuses that sequence", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(40);
    engine.record(60);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    engine.record(50);
    expect(engine.facts().turns.at(-1)?.sequence).toBe(2);
  });

  it("returns false when there is nothing to undo", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect(engine.undo()).toBe(false);
  });
});

describe("visual board capture", () => {
  const config = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: SEATS,
  } as never;

  const trebleTwenty = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    locationX: 0,
    locationY: -102,
  } as const;

  const miss = {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: 0,
    locationY: -180,
  } as const;

  it("opens a turn on the first dart and closes it on the third", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0]!.completedAt).toBeNull();

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const [turn] = engine.facts().turns;
    expect(turn!.darts).toHaveLength(3);
    expect(turn!.totalScore).toBe(180);
    expect(turn!.completedAt).not.toBeNull();
  });

  it("stores each dart's landing coordinate", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);

    expect(engine.facts().turns[0]!.darts[0]).toMatchObject({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: 60,
      locationX: 0,
      locationY: -102,
    });
  });

  it("counts a miss as zero without a target number", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(miss);

    expect(engine.facts().turns[0]!.darts[0]).toMatchObject({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      score: 0,
    });
    expect(engine.facts().turns[0]!.totalScore).toBe(0);
  });

  it("undoes one dart at a time and removes the turn it opened", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0]!.darts).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);

    expect(engine.undo()).toBe(false);
  });

  it("rehydrates a part-thrown visit from persisted facts", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
    ) as ScoreTrainingEngine;
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const revived = scoreTrainingEngineFactory.create(
      config,
      engine.facts(),
    ) as ScoreTrainingEngine;
    revived.record(trebleTwenty);

    const [turn] = revived.facts().turns;
    expect(turn!.darts).toHaveLength(3);
    expect(turn!.totalScore).toBe(180);
    expect(turn!.completedAt).not.toBeNull();
  });

  it("leaves quick-score behaviour unchanged", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
    ) as ScoreTrainingEngine;

    engine.record(85);

    const [turn] = engine.facts().turns;
    expect(turn!.darts).toHaveLength(0);
    expect(turn!.totalScore).toBe(85);
  });

  it("undoes the third dart of a closed visit back to two, clearing completedAt and totalScore", () => {
    const engine = scoreTrainingEngineFactory.create(
      config,
      undefined,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    const [closed] = engine.facts().turns;
    expect(closed!.completedAt).not.toBeNull();
    expect(closed!.totalScore).toBe(180);

    expect(engine.undo()).toBe(true);

    const [reopened] = engine.facts().turns;
    expect(reopened!.darts).toHaveLength(2);
    expect(reopened!.completedAt).toBeNull();
    expect(reopened!.totalScore).toBe(120);
  });

  describe("wouldComplete", () => {
    const single = {
      maxVisitScore: 180,
      durationType: "ROUNDS",
      durationValue: 1,
      seats: SEATS,
    } as never;

    it("is false before any dart is recorded (single round)", () => {
      const engine = scoreTrainingEngineFactory.create(
        single,
        undefined,
      ) as ScoreTrainingEngine;

      expect(engine.wouldComplete(trebleTwenty)).toBe(false);
    });

    it("is false after the first dart and true after the second (single round)", () => {
      const engine = scoreTrainingEngineFactory.create(
        single,
        undefined,
      ) as ScoreTrainingEngine;

      engine.record(trebleTwenty);
      expect(engine.wouldComplete(trebleTwenty)).toBe(false);

      engine.record(trebleTwenty);
      expect(engine.wouldComplete(trebleTwenty)).toBe(true);
    });

    it("is false on darts 1 and 2 of the second visit and true only on dart 3 (two rounds)", () => {
      const engine = scoreTrainingEngineFactory.create(
        config,
        undefined,
      ) as ScoreTrainingEngine;

      engine.record(trebleTwenty);
      engine.record(trebleTwenty);
      engine.record(trebleTwenty);

      expect(engine.wouldComplete(trebleTwenty)).toBe(false);
      engine.record(trebleTwenty);
      expect(engine.wouldComplete(trebleTwenty)).toBe(false);
      engine.record(trebleTwenty);
      expect(engine.wouldComplete(trebleTwenty)).toBe(true);
    });

    it("does not mutate the fact log", () => {
      const engine = scoreTrainingEngineFactory.create(
        single,
        undefined,
      ) as ScoreTrainingEngine;

      engine.record(trebleTwenty);
      const factsBefore = structuredClone(engine.facts());

      engine.wouldComplete(trebleTwenty);

      expect(engine.facts().turns).toEqual(factsBefore.turns);
    });
  });
});

describe("ScoreTrainingEngine.record — keypad input under VISUAL_BOARD (shape-based dispatch)", () => {
  const trebleTwenty = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    locationX: 0,
    locationY: -102,
  } as const;

  it("a keypad visit total on a VISUAL_BOARD engine produces the same fact-log result as the same input on a QUICK_SCORE engine", () => {
    const visualEngine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
      undefined,
    ) as ScoreTrainingEngine;
    const quickEngine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
    ) as ScoreTrainingEngine;

    visualEngine.record(85);
    quickEngine.record(85);

    const visualTurn = visualEngine.facts().turns.at(-1)!;
    const quickTurn = quickEngine.facts().turns.at(-1)!;
    expect(visualTurn.totalScore).toBe(85);
    expect(visualTurn.darts).toEqual([]);
    expect(visualTurn.totalScore).toBe(quickTurn.totalScore);
    expect(visualTurn.darts).toEqual(quickTurn.darts);
  });

  it("accepts a keypad visit total from a clean VISUAL_BOARD engine, then opens a fresh board-driven turn afterward", () => {
    const engine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
      undefined,
    ) as ScoreTrainingEngine;

    expect(() => engine.record(85)).not.toThrow();
    engine.record(trebleTwenty);

    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns[0]!.totalScore).toBe(85);
    expect(engine.facts().turns[0]!.darts).toEqual([]);
    expect(engine.facts().turns[1]!.darts).toHaveLength(1);
  });

  it("rejects a keypad visit total while a board-recorded turn is still open, and leaves the fact log untouched", () => {
    const engine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
      undefined,
    ) as ScoreTrainingEngine;
    engine.record(trebleTwenty);
    const before = engine.facts();

    expect(() => engine.record(60)).toThrow();
    expect(engine.facts()).toEqual(before);
  });

  it("wouldComplete also refuses a mid-visit keypad total rather than mis-dispatching it as a dart", () => {
    const single = {
      maxVisitScore: 180,
      durationType: "ROUNDS",
      durationValue: 1,
      seats: SEATS,
    } as never;
    const engine = scoreTrainingEngineFactory.create(
      single,
      undefined,
    ) as ScoreTrainingEngine;
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);

    expect(engine.wouldComplete(60)).toBe(false);
  });

  it("undo removes a keypad-recorded turn as a whole unit even on a VISUAL_BOARD engine", () => {
    const engine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
      undefined,
    ) as ScoreTrainingEngine;
    engine.record(85);

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(0);
  });
});

describe("ScoreTrainingEngine.undo — dispatches on the fact log's shape", () => {
  const trebleTwenty = {
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    locationX: 0,
    locationY: -102,
  } as const;

  it("undoing a defaulted (QUICK_SCORE-tagged) engine after two board darts removes exactly one dart and leaves the first intact", () => {
    const engine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(2);

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(1);
    expect(engine.facts().turns.at(-1)!.totalScore).toBe(60);
  });

  it("is an exact inverse across a mixed sequence for an engine tagged QUICK_SCORE (defaulted)", () => {
    const engine = scoreTrainingEngineFactory.create(
      ROUNDS_10,
    ) as ScoreTrainingEngine;

    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    engine.record(trebleTwenty);
    expect(engine.facts().turns).toHaveLength(1);

    engine.record(41);
    expect(engine.facts().turns).toHaveLength(2);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(0);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);

    expect(engine.undo()).toBe(false);
  });
});

describe("ScoreTrainingEngine — 1v1", () => {
  const twoSeats = [
    {
      participantRef: "p1",
      displayName: "A",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "p2",
      displayName: "B",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];
  const twoSeatConfig: Seated<ScoreTrainingSnapshot> = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: twoSeats,
  } as never;

  it("both seats always play out their own full ROUNDS budget, higher total wins", () => {
    const engine = new ScoreTrainingEngine(twoSeatConfig);
    engine.record(20); // p1 round 1
    engine.record(60); // p2 round 1
    let state = engine.state();
    expect(state.status).toBe("IN_PROGRESS");
    engine.record(20); // p1 round 2 — total 40
    state = engine.state();
    expect(state.status).toBe("IN_PROGRESS"); // p2 still has a round left
    state = engine.record(60); // p2 round 2 — total 120
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new ScoreTrainingEngine(twoSeatConfig);
    engine.record(20);
    engine.record(60);
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(
        twoSeats.some((seat) => seat.participantRef === turn.participantRef),
      ).toBe(true);
    }
  });
});

describe("ScoreTrainingEngine — 1v1 completion guard", () => {
  const twoSeats = [
    {
      participantRef: "p1",
      displayName: "A",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "p2",
      displayName: "B",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];
  const decidedConfig: Seated<ScoreTrainingSnapshot> = {
    maxVisitScore: 180,
    durationType: "ROUNDS",
    durationValue: 1,
    seats: twoSeats,
  } as never;

  it("refuses a visit total once a decided 1v1 match is already complete, leaving winningSideKey untouched", () => {
    const engine = new ScoreTrainingEngine(decidedConfig);
    engine.record(20); // p1 round 1
    const decided = engine.record(60); // p2 round 1 — decides the match

    expect(decided.status).toBe("COMPLETE");
    expect(decided.winningSideKey).toBe("B");
    expect(engine.isComplete()).toBe(true);

    expect(() => engine.record(90)).toThrow();

    expect(engine.state().winningSideKey).toBe("B");
    expect(engine.facts().turns).toHaveLength(2);
  });

  it("refuses a dart once a decided 1v1 match is already complete, leaving winningSideKey untouched", () => {
    const trebleTwenty = {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -102,
    } as const;
    const engine = scoreTrainingEngineFactory.create(
      decidedConfig,
    ) as ScoreTrainingEngine;
    engine.record(20); // p1 round 1
    const decided = engine.record(60); // p2 round 1 — decides the match

    expect(decided.status).toBe("COMPLETE");
    expect(decided.winningSideKey).toBe("B");

    expect(() => engine.record(trebleTwenty)).toThrow();

    expect(engine.state().winningSideKey).toBe("B");
    expect(engine.facts().turns).toHaveLength(2);
  });

  it("wouldComplete answers false once the match is already decided, instead of throwing", () => {
    const engine = new ScoreTrainingEngine(decidedConfig);
    engine.record(20);
    engine.record(60);

    expect(engine.isComplete()).toBe(true);
    expect(engine.wouldComplete(50)).toBe(false);
  });
});
