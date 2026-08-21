import { describe, it, expect } from "vitest";
import {
  applyShanghaiDart,
  initialShanghaiState,
  ShanghaiEngine,
  shanghaiEngineFactory,
} from "@modules/game/shanghai.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  DartObservation,
  EngineFacts,
  ShanghaiState,
} from "@modules/types";
import type { ShanghaiSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config: Seated<ShanghaiSnapshot> = { seats: SEATS };

function targetNumberFor(state: ShanghaiState): number {
  const target = targetAt(numbersPath(), state.targetIndex);
  if (target.kind === "BULL") throw new Error("unreachable in these tests");
  return target.number;
}

function hitObservationFor(
  state: ShanghaiState,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  return {
    hitTargetNumber: targetNumberFor(state),
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

function offTargetObservationFor(state: ShanghaiState): DartObservation {
  const number = targetNumberFor(state);
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
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
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

describe("initialShanghaiState", () => {
  it("starts at round 1 (index 0), zero score, no darts thrown, in progress", () => {
    expect(initialShanghaiState()).toEqual({
      targetIndex: 0,
      totalScore: 0,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    });
  });
});

describe("applyShanghaiDart — scoring on the round's own number", () => {
  it("adds face value for a SINGLE hit and records the raw zone", () => {
    const state = initialShanghaiState();
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
    const state = initialShanghaiState();
    const next = applyShanghaiDart(state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalScore).toBe(2);
  });

  it("adds 3x face value for a TREBLE hit", () => {
    const state = initialShanghaiState();
    const next = applyShanghaiDart(state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalScore).toBe(3);
  });

  it("scores 0 and records null for a MISS, but still counts the dart", () => {
    const state = initialShanghaiState();
    const next = applyShanghaiDart(state, missObservation());
    expect(next.totalScore).toBe(0);
    expect(next.dartsThisVisit).toEqual([null]);
  });

  it("scores 0 and records null for a hit on the wrong number, even though it is a genuine board hit", () => {
    const state = initialShanghaiState();
    const next = applyShanghaiDart(state, offTargetObservationFor(state));
    expect(next.totalScore).toBe(0);
    expect(next.dartsThisVisit).toEqual([null]);
  });

  it("scores 0 for a BULL hit even at round 20's own number 20 (BULL is never the active number)", () => {
    const roundTwenty: ShanghaiState = {
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
    let state = initialShanghaiState();
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    expect(state.totalScore).toBe(3);
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toEqual([]);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("does not trigger a Shanghai on two singles and a double (missing treble)", () => {
    let state = initialShanghaiState();
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "SINGLE"));
    state = applyShanghaiDart(state, hitObservationFor(state, "DOUBLE"));
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });

  it("a miss or off-target dart in the visit still blocks a Shanghai even alongside single+double", () => {
    let state = initialShanghaiState();
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
    let state = initialShanghaiState();
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
    let state: ShanghaiState = {
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
    let state: ShanghaiState = {
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

describe("applyShanghaiDart — terminal state guard", () => {
  it.each(["SHANGHAI", "COMPLETE"] as const)(
    "throws when called on a %s state",
    (status) => {
      const terminal: ShanghaiState = {
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
    expect(engine.state().totalScore).toBe(3);
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
    expect(engine.state().totalScore).toBe(0);
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

    expect(engine.state().targetIndex).toBe(1);
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
    expect(resumed.state().totalScore).toBe(9);
    expect(resumed.state().targetIndex).toBe(1);
  });

  it("completes after round 20 without a Shanghai", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("COMPLETE");
  });
});

describe("ShanghaiEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));

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
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("leaves completedAt null until the visit's 3rd dart resolves it", () => {
    const engine = new ShanghaiEngine(config);

    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(missObservation());
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state(), "TREBLE"));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("ShanghaiEngine.wouldComplete", () => {
  it("is false for the 1st and 2nd dart of a visit, regardless of outcome", () => {
    const engine = new ShanghaiEngine(config);
    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "SINGLE")),
    ).toBe(false);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.wouldComplete(missObservation())).toBe(false);
  });

  it("is true for the 3rd dart when it completes a Shanghai", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "TREBLE")),
    ).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false for the 3rd dart when the visit resolves but only advances to the next round", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "SINGLE")),
    ).toBe(false);
  });

  it("is true for round 20's 3rd dart when it completes the session without a Shanghai", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.wouldComplete(missObservation())).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false once the session has already ended", () => {
    const engine = shanghaiEngineFactory.create(config, facts19RoundsPlayed());
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.state().status).toBe("COMPLETE");
    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "SINGLE")),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "TREBLE")),
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
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("reverts the completing dart of a Shanghai, allowing it to be recompleted on redo", () => {
    const engine = new ShanghaiEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    engine.record(hitObservationFor(engine.state(), "TREBLE"));
    expect(engine.state().status).toBe("SHANGHAI");
    expect(engine.state().totalScore).toBe(6);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().totalScore).toBe(3);

    const resumed = engine.record(hitObservationFor(engine.state(), "TREBLE"));
    expect(resumed.status).toBe("SHANGHAI");
    expect(resumed.totalScore).toBe(6);
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
    expect(engine.state().totalScore).toBe(5);
    expect(engine.state().targetIndex).toBe(1);

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().totalScore).toBe(0);
    expect(engine.state().targetIndex).toBe(0);
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
    expect(resumed.state().totalScore).toBe(3);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().totalScore).toBe(2);
  });
});
