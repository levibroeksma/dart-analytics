import { describe, it, expect } from "vitest";
import {
  applyShanghaiDart,
  foldShanghaiState,
  initialShanghaiState,
  ShanghaiEngine,
  shanghaiEngineFactory,
  shanghaiV2EngineFactory,
  zoneBucketOf,
} from "@modules/game/shanghai.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  ShanghaiSeatState,
  TurnFact,
} from "@modules/types";
import type { ShanghaiSnapshot, ShanghaiV2Snapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config: Seated<ShanghaiSnapshot> = { seats: SEATS };

function targetNumberFor(seat: ShanghaiSeatState): number {
  const target = targetAt(numbersPath(), seat.targetIndex);
  if (target.kind === "BULL") throw new Error("unreachable in these tests");
  return target.number;
}

function hitObservationFor(
  seat: ShanghaiSeatState,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  return {
    hitTargetNumber: targetNumberFor(seat),
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

function missObservation(): DartObservation {
  return {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

function offTargetObservationFor(seat: ShanghaiSeatState): DartObservation {
  const number = targetNumberFor(seat);
  const wrongNumber = number === 20 ? 1 : number + 1;
  return {
    hitTargetNumber: wrongNumber,
    hitZoneKey: "TREBLE",
    locationX: null,
    locationY: null,
  };
}

/** 19 completed all-SINGLE-hit rounds (1..19), so an engine created against
 * them rehydrates onto round 20 with no Shanghai triggered along the way. */
function facts19RoundsPlayed(): EngineFacts {
  const engine = shanghaiEngineFactory.create(config);
  for (let round = 0; round < 19; round++) {
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
  }
  return engine.facts();
}

describe("shanghaiEngineFactory", () => {
  it("registers itself under SHANGHAI_V1", () => {
    expect(shanghaiEngineFactory.rulesetVersionKey).toBe("SHANGHAI_V1");
    expect(getEngineFactory("SHANGHAI_V1")).toBe(shanghaiEngineFactory);
  });

  it("builds a ShanghaiEngine bound to the ruleset version", () => {
    const engine = shanghaiEngineFactory.create(config);
    expect(engine).toBeInstanceOf(ShanghaiEngine);
    expect(engine.rulesetVersionKey).toBe("SHANGHAI_V1");
  });
});

describe("zoneBucketOf", () => {
  it("buckets every single-ring zone key as SINGLE", () => {
    expect(zoneBucketOf("SINGLE")).toBe("SINGLE");
    expect(zoneBucketOf("INNER_SINGLE")).toBe("SINGLE");
    expect(zoneBucketOf("OUTER_SINGLE")).toBe("SINGLE");
  });

  it("buckets DOUBLE and TREBLE as themselves", () => {
    expect(zoneBucketOf("DOUBLE")).toBe("DOUBLE");
    expect(zoneBucketOf("TREBLE")).toBe("TREBLE");
  });

  it("buckets both bull zones and MISS as null — none of the three", () => {
    expect(zoneBucketOf("OUTER_BULL")).toBeNull();
    expect(zoneBucketOf("INNER_BULL")).toBeNull();
    expect(zoneBucketOf("MISS")).toBeNull();
  });
});

describe("initialShanghaiState", () => {
  it("starts at round 1 (index 0), zero score, no darts thrown, in progress", () => {
    const state = initialShanghaiState(config);
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 0,
      totalScore: 0,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    });
  });
});

describe("applyShanghaiDart — scoring on the round's own number", () => {
  it("adds face value for a SINGLE hit and records the raw zone", () => {
    const state = initialShanghaiState(config).seats[0];
    const next = applyShanghaiDart(state, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalScore).toBe(1);
    expect(next.dartsThisVisit).toEqual(["SINGLE"]);
    expect(next.targetIndex).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("adds 2x face value for a DOUBLE hit", () => {
    const state = initialShanghaiState(config).seats[0];
    const next = applyShanghaiDart(state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalScore).toBe(2);
  });

  it("adds 3x face value for a TREBLE hit", () => {
    const state = initialShanghaiState(config).seats[0];
    const next = applyShanghaiDart(state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalScore).toBe(3);
  });

  it("scores 0 and records null for a MISS, but still counts the dart", () => {
    const state = initialShanghaiState(config).seats[0];
    const next = applyShanghaiDart(state, missObservation());
    expect(next.totalScore).toBe(0);
    expect(next.dartsThisVisit).toEqual([null]);
  });

  it("scores 0 and records null for a hit on the wrong number, even though it is a genuine board hit", () => {
    const state = initialShanghaiState(config).seats[0];
    const next = applyShanghaiDart(state, offTargetObservationFor(state));
    expect(next.totalScore).toBe(0);
    expect(next.dartsThisVisit).toEqual([null]);
  });

  it("scores 0 for a BULL hit even at round 20's own number 20 (BULL is never the active number)", () => {
    const roundTwenty: ShanghaiSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 19,
      totalScore: 0,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    const next = applyShanghaiDart(roundTwenty, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(next.totalScore).toBe(0);
    expect(next.dartsThisVisit).toEqual([null]);
  });
});

describe("applyShanghaiDart — visit resolution and round advance", () => {
  it("sums a 3-SINGLE visit and advances to the next round when it is not a Shanghai", () => {
    let state = initialShanghaiState(config).seats[0];
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    expect(state.totalScore).toBe(3);
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toEqual([]);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("does not trigger a Shanghai on two singles and a double (missing treble)", () => {
    let state = initialShanghaiState(config).seats[0];
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "DOUBLE"));
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });

  it("a miss or off-target dart in the visit still blocks a Shanghai even alongside single+double", () => {
    let state = initialShanghaiState(config).seats[0];
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "DOUBLE"));
    state = applyShanghaiDart(state, missObservation());
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });
});

describe("applyShanghaiDart — Shanghai instant win, any dart order", () => {
  it.each([
    ["SINGLE", "DOUBLE", "TREBLE"],
    ["DOUBLE", "TREBLE", "SINGLE"],
    ["TREBLE", "SINGLE", "DOUBLE"],
    ["TREBLE", "DOUBLE", "SINGLE"],
  ] as const)("triggers on order %s / %s / %s", (first, second, third) => {
    let state = initialShanghaiState(config).seats[0];
    state = applyShanghaiDart(state, hitObservationFor(state, first));
    state = applyShanghaiDart(state, hitObservationFor(state, second));
    state = applyShanghaiDart(state, hitObservationFor(state, third));
    expect(state.status).toBe("SHANGHAI");
    expect(state.totalScore).toBe(1 + 2 + 3);
    expect(state.dartsThisVisit).toEqual([]);
    expect(state.targetIndex).toBe(0);
  });
});

describe("applyShanghaiDart — completion at round 20", () => {
  it("completes without a Shanghai after round 20 resolves with no triggering combo", () => {
    let state: ShanghaiSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 19,
      totalScore: 570,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    state = applyShanghaiDart(state, missObservation());
    state = applyShanghaiDart(state, missObservation());
    state = applyShanghaiDart(state, missObservation());
    expect(state.status).toBe("COMPLETE");
    expect(state.totalScore).toBe(570);
    expect(state.targetIndex).toBe(19);
  });

  it("reports SHANGHAI, not COMPLETE, when round 20 itself is a Shanghai", () => {
    let state: ShanghaiSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 19,
      totalScore: 570,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "DOUBLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "TREBLE"));
    expect(state.status).toBe("SHANGHAI");
    expect(state.totalScore).toBe(570 + 20 + 40 + 60);
  });
});

describe("applyShanghaiDart — Hard mode (Target Needed)", () => {
  function midGameState(totalScore: number): ShanghaiSeatState {
    return {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 1,
      totalScore,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
  }

  it("halves the running total, round-half-up, when a round lands zero target hits", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(state, missObservation(), "HARD");
    state = applyShanghaiDart(state, missObservation(), "HARD");
    state = applyShanghaiDart(state, missObservation(), "HARD");
    expect(state.totalScore).toBe(8);
    expect(state.targetIndex).toBe(2);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("never halves a round with at least one target hit, however little it scores", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "SINGLE"),
      "HARD",
    );
    state = applyShanghaiDart(state, missObservation(), "HARD");
    state = applyShanghaiDart(state, missObservation(), "HARD");
    expect(state.totalScore).toBe(17);
  });

  it("is a no-op under NORMAL difficulty — a zero-hit round just adds 0, same as today", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(state, missObservation(), "NORMAL");
    state = applyShanghaiDart(state, missObservation(), "NORMAL");
    state = applyShanghaiDart(state, missObservation(), "NORMAL");
    expect(state.totalScore).toBe(15);
  });

  it("defaults to NORMAL when no difficulty argument is passed (every V1 call site unaffected)", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(state, missObservation());
    state = applyShanghaiDart(state, missObservation());
    state = applyShanghaiDart(state, missObservation());
    expect(state.totalScore).toBe(15);
  });

  it("a Shanghai is unaffected by difficulty, since it can never coincide with a zero-hit visit", () => {
    let state = initialShanghaiState(config).seats[0];
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "SINGLE"),
      "HARD",
    );
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "DOUBLE"),
      "HARD",
    );
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "TREBLE"),
      "HARD",
    );
    expect(state.status).toBe("SHANGHAI");
    expect(state.totalScore).toBe(6);
  });
});

describe("shanghaiV2EngineFactory", () => {
  it("registers itself under SHANGHAI_V2", () => {
    expect(shanghaiV2EngineFactory.rulesetVersionKey).toBe("SHANGHAI_V2");
    expect(getEngineFactory("SHANGHAI_V2")).toBe(shanghaiV2EngineFactory);
  });

  it("builds a ShanghaiEngine bound to SHANGHAI_V2, applying Hard-mode halving end to end", () => {
    const hardConfig: Seated<ShanghaiV2Snapshot> = {
      seats: SEATS,
      difficulty: "HARD",
    };
    const engine = shanghaiV2EngineFactory.create(hardConfig);
    expect(engine).toBeInstanceOf(ShanghaiEngine);
    expect(engine.rulesetVersionKey).toBe("SHANGHAI_V2");

    for (let round = 0; round < 2; round++) {
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    }
    expect(engine.state().seats[0].totalScore).toBe(9);

    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.state().seats[0].totalScore).toBe(5);
  });

  it("a SHANGHAI_V2 engine with NORMAL difficulty behaves exactly like V1", () => {
    const normalConfig: Seated<ShanghaiV2Snapshot> = {
      seats: SEATS,
      difficulty: "NORMAL",
    };
    const engine = shanghaiV2EngineFactory.create(normalConfig);
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.state().seats[0].totalScore).toBe(0);
    expect(engine.state().seats[0].targetIndex).toBe(1);
  });
});

describe("applyShanghaiDart — terminal state guard", () => {
  it.each(["SHANGHAI", "COMPLETE"] as const)(
    "throws when called on a %s state",
    (status) => {
      const terminal: ShanghaiSeatState = {
        participantRef: "participant-1",
        sideKey: "A",
        targetIndex: 19,
        totalScore: 570,
        dartsThisVisit: [],
        status,
      };
      expect(() => applyShanghaiDart(terminal, missObservation())).toThrow();
    },
  );
});

describe("ShanghaiEngine — fact log and derived state", () => {
  it("stores the real board score in the fact and derives the round-restricted total separately", () => {
    const engine = shanghaiEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.score).toBe(3);
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
    expect(engine.state().seats[0].totalScore).toBe(3);
  });

  it("keeps the board fact even when the hit scores 0 toward the round total", () => {
    const engine = shanghaiEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.facts().turns[0].darts[0].score).toBe(60);
    expect(engine.state().seats[0].totalScore).toBe(0);
  });

  it("advances to round 2 after three non-Shanghai darts", () => {
    const engine = shanghaiEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().seats[0].targetIndex).toBe(1);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].totalScore).toBe(3);
  });

  it("rehydrates the derived total and round from persisted facts", () => {
    const first = shanghaiEngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    const resumed = shanghaiEngineFactory.create(config, first.facts());
    expect(resumed.state().seats[0].totalScore).toBe(9);
    expect(resumed.state().seats[0].targetIndex).toBe(1);
  });

  it("completes after round 20 without a Shanghai", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].status).toBe("COMPLETE");
  });
});

describe("ShanghaiEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

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

  it("mints a unique clientKey and an ISO completedAt per turn", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("leaves completedAt null until the visit's 3rd dart resolves it", () => {
    const engine = new ShanghaiEngine(config);

    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(missObservation());
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("ShanghaiEngine.wouldComplete", () => {
  it("is false for the 1st and 2nd dart of a visit, regardless of outcome", () => {
    const engine = new ShanghaiEngine(config);
    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "SINGLE"),
      ),
    ).toBe(false);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.wouldComplete(missObservation())).toBe(false);
  });

  it("is true for the 3rd dart when it completes a Shanghai", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "TREBLE"),
      ),
    ).toBe(true);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is false for the 3rd dart when the visit resolves but only advances to the next round", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "SINGLE"),
      ),
    ).toBe(false);
  });

  it("is true for round 20's 3rd dart when it completes the session without a Shanghai", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.wouldComplete(missObservation())).toBe(true);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is false once the session has already ended", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.state().seats[0].status).toBe("COMPLETE");
    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "SINGLE"),
      ),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "TREBLE"),
      ),
    ).toBe(true);

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("ShanghaiEngine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new ShanghaiEngine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() when it opened a new turn", () => {
    const engine = new ShanghaiEngine(config);
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("reverts the completing dart of a Shanghai, allowing it to be recompleted on redo", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
    expect(engine.state().seats[0].status).toBe("SHANGHAI");
    expect(engine.state().seats[0].totalScore).toBe(6);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].totalScore).toBe(3);

    const resumed = engine.record(
      hitObservationFor(engine.state().seats[0], "TREBLE"),
    );
    expect(resumed.seats[0].status).toBe("SHANGHAI");
    expect(resumed.seats[0].totalScore).toBe(6);
  });

  it("does not push a phantom dart when record is rejected on a finished session", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.isComplete()).toBe(true);

    expect(() => engine.record(missObservation())).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
  });

  it("walks back across multiple rounds with repeated undos", () => {
    const engine = new ShanghaiEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 2,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(engine.state().seats[0].totalScore).toBe(5);
    expect(engine.state().seats[0].targetIndex).toBe(1);

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].totalScore).toBe(0);
    expect(engine.state().seats[0].targetIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = shanghaiEngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    const resumed = shanghaiEngineFactory.create(config, first.facts());
    resumed.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(resumed.state().seats[0].totalScore).toBe(3);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().seats[0].totalScore).toBe(2);
  });
});

describe("ShanghaiEngine — 1v1", () => {
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
  const twoSeatConfig: Seated<ShanghaiSnapshot> = { seats: twoSeats };

  function dart(number: number, zone: DartZoneKey): DartObservation {
    return {
      hitTargetNumber: number,
      hitZoneKey: zone,
      locationX: null,
      locationY: null,
    };
  }

  /**
   * `activeSeat`'s "the thrower keeps the turn until it resolves" rule (see
   * `seat-rota.module.ts`) means a seat's own visit always plays out in full
   * (3 darts) before the turn passes — a seat never sees the other seat's
   * dart land inside its own open visit. So the natural per-visit rotation
   * here is p1's round 1, then p2's round 1, then p1's round 2 (where the
   * Shanghai lands) — p2 is left "mid-round" in the sense that the match
   * ends before its own round 2 turn ever comes up, not mid-visit.
   */
  it("ends the whole match the instant one seat hits a Shanghai, even mid-round for the other seat", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 1
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 2
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 3: not a Shanghai, advances p1 to round 2
    engine.record(dart(1, "MISS")); // p2 round 1, dart 1
    engine.record(dart(1, "MISS")); // p2 round 1, dart 2
    engine.record(dart(1, "MISS")); // p2 round 1, dart 3: not a Shanghai, advances p2 to round 2
    engine.record(dart(2, "SINGLE")); // p1 round 2, dart 1
    engine.record(dart(2, "DOUBLE")); // p1 round 2, dart 2
    const state = engine.record(dart(2, "TREBLE")); // p1 round 2, dart 3: single+double+treble on 2 = Shanghai
    expect(state.seats[0].status).toBe("SHANGHAI");
    expect(state.seats[1].status).toBe("IN_PROGRESS");
    expect(state.seats[1].targetIndex).toBe(1);
    expect(state.status).toBe("SHANGHAI");
    expect(state.winningSideKey).toBe("A");
  });

  it("resolves by total score once both seats finish all 20 rounds without a Shanghai", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    // Every visit for both seats misses every dart at every round — both finish at score 0, a tie.
    for (let round = 0; round < 20; round++) {
      for (let dartNum = 0; dartNum < 3; dartNum++)
        engine.record(dart(round + 1, "MISS"));
      for (let dartNum = 0; dartNum < 3; dartNum++)
        engine.record(dart(round + 1, "MISS"));
    }
    const state = engine.state();
    expect(state.status).toBe("TIE");
    expect(state.winningSideKey).toBeNull();
  });

  it("resolves by total score in favor of the higher scorer once both finish without a Shanghai", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    for (let round = 0; round < 20; round++) {
      engine.record(dart(round + 1, "SINGLE"));
      engine.record(dart(round + 1, "MISS"));
      engine.record(dart(round + 1, "MISS"));
      engine.record(dart(round + 1, "MISS"));
      engine.record(dart(round + 1, "MISS"));
      engine.record(dart(round + 1, "MISS"));
    }
    const state = engine.state();
    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.seats[1].status).toBe("COMPLETE");
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
  });

  /**
   * The instant-Shanghai short circuit is exactly the gap Bob's 27 (Task 5)
   * and 121 (Task 7) had to guard against: it can end the WHOLE match on one
   * seat's own visit while the OTHER seat's own `status` still reads
   * `IN_PROGRESS` (that seat never got to finish the round the match ended
   * on). A guard that only checks the active seat's own status would miss
   * this — the trailing seat's own next turn would sail through record().
   */
  it("rejects recording another dart for the trailing seat once the match has ended via an instant Shanghai", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 1
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 2
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 3: advances p1 to round 2
    engine.record(dart(1, "MISS")); // p2 round 1, dart 1
    engine.record(dart(1, "MISS")); // p2 round 1, dart 2
    engine.record(dart(1, "MISS")); // p2 round 1, dart 3: advances p2 to round 2
    engine.record(dart(2, "SINGLE")); // p1 round 2, dart 1
    engine.record(dart(2, "DOUBLE")); // p1 round 2, dart 2
    const won = engine.record(dart(2, "TREBLE")); // p1's Shanghai ends the match
    expect(won.status).toBe("SHANGHAI");
    expect(won.activeParticipantRef).toBe("p2");
    expect(won.seats[1].status).toBe("IN_PROGRESS");

    expect(() => engine.record(dart(2, "SINGLE"))).toThrow(/ended/);

    const after = engine.state();
    expect(after.status).toBe("SHANGHAI");
    expect(after.winningSideKey).toBe("A");
  });

  /**
   * Isolates the same gap for `wouldComplete`, constructed directly
   * (bypassing `record()`'s own guard, mirroring
   * `one-twenty-one.engine.module.test.ts`'s equivalent case): p1 has
   * already won the match outright via a Shanghai on round 1, while p2 —
   * built independently the same way, one all-SINGLE round per turn — has
   * separately climbed all the way to round 20 with 2 darts already thrown
   * this visit. Evaluated in isolation, p2's next dart WOULD complete its
   * own path (round 20, 3rd dart, no Shanghai); this is the exact shape that
   * must NOT read as "would complete the match" once the match is already
   * decided.
   */
  it("wouldComplete is false for the trailing seat's own completing dart once the match has already ended via an instant Shanghai", () => {
    function soloFacts(participantRef: string, sideKey: string): TurnFact[] {
      const soloConfig: Seated<ShanghaiSnapshot> = {
        seats: [
          {
            participantRef,
            displayName: sideKey,
            sideKey,
            participantTypeKey: "GUEST" as const,
          },
        ],
      };
      const engine = shanghaiEngineFactory.create(soloConfig);
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE")); // Shanghai on round 1
      return engine.facts().turns;
    }

    function soloFactsNearlyDone(
      participantRef: string,
      sideKey: string,
    ): TurnFact[] {
      const soloConfig: Seated<ShanghaiSnapshot> = {
        seats: [
          {
            participantRef,
            displayName: sideKey,
            sideKey,
            participantTypeKey: "GUEST" as const,
          },
        ],
      };
      const engine = shanghaiEngineFactory.create(soloConfig);
      for (let round = 0; round < 19; round++) {
        engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
        engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
        engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
      }
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE")); // round 20, dart 1
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE")); // round 20, dart 2 (visit stays open)
      return engine.facts().turns;
    }

    const prior: EngineFacts = {
      stages: [],
      turns: [...soloFacts("p1", "A"), ...soloFactsNearlyDone("p2", "B")],
    };
    const engine = shanghaiEngineFactory.create(twoSeatConfig, prior);
    const before = engine.state();
    expect(before.status).toBe("SHANGHAI");
    expect(before.activeParticipantRef).toBe("p2");
    expect(before.seats[1].status).toBe("IN_PROGRESS");
    expect(before.seats[1].targetIndex).toBe(19);

    expect(
      engine.wouldComplete(hitObservationFor(before.seats[1], "SINGLE")),
    ).toBe(false);
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    engine.record(dart(1, "MISS"));
    engine.record(dart(1, "MISS"));
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(
        twoSeats.some((seat) => seat.participantRef === turn.participantRef),
      ).toBe(true);
    }
  });

  /**
   * `undo()` needs no 1v1-specific change — it always pops the tail of
   * `this.turns`, and `deriveState()` recomputes the active seat from facts
   * every time, so reverting a Shanghai's completing dart un-decides the
   * whole match exactly as popping any other dart un-resolves a visit.
   */
  it("undo reverts an instant-Shanghai match decision, un-deciding the whole match and restoring the winning seat's own turn", () => {
    const engine = new ShanghaiEngine(twoSeatConfig);
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 1
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 2
    engine.record(dart(1, "SINGLE")); // p1 round 1, dart 3: advances p1 to round 2
    engine.record(dart(1, "MISS")); // p2 round 1, dart 1
    engine.record(dart(1, "MISS")); // p2 round 1, dart 2
    engine.record(dart(1, "MISS")); // p2 round 1, dart 3: advances p2 to round 2
    engine.record(dart(2, "SINGLE")); // p1 round 2, dart 1
    engine.record(dart(2, "DOUBLE")); // p1 round 2, dart 2
    engine.record(dart(2, "TREBLE")); // p1's Shanghai ends the match
    expect(engine.state().status).toBe("SHANGHAI");

    expect(engine.undo()).toBe(true);

    const after = engine.state();
    expect(after.status).toBe("IN_PROGRESS");
    expect(after.winningSideKey).toBeNull();
    expect(after.activeParticipantRef).toBe("p1");
    expect(after.seats[0].status).toBe("IN_PROGRESS");
    expect(after.seats[0].dartsThisVisit).toEqual(["SINGLE", "DOUBLE"]);

    const resumed = engine.record(dart(2, "TREBLE"));
    expect(resumed.status).toBe("SHANGHAI");
    expect(resumed.winningSideKey).toBe("A");
  });
});

describe("foldShanghaiState — solo session", () => {
  it("reproduces initialShanghaiState for an empty fact log", () => {
    const facts: EngineFacts = { stages: [], turns: [] };
    expect(foldShanghaiState(facts, config)).toEqual(
      initialShanghaiState(config),
    );
  });
});

describe("Shanghai dart facts", () => {
  it("records no intention — the round's own number is derivable", () => {
    const engine = new ShanghaiEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
    expect(dart.score).toBe(3);
    expect(engine.facts().turns[0].totalScore).toBe(3);
  });

  it("undo pops one dart, reopens the visit and restores its total", () => {
    const engine = new ShanghaiEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.undo()).toBe(true);
    const turn = engine.facts().turns[0];
    expect(turn.darts).toHaveLength(1);
    expect(turn.totalScore).toBe(1);
    expect(turn.completedAt).toBeNull();
  });
});

describe("ShanghaiEngine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = shanghaiEngineFactory.create(config);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
