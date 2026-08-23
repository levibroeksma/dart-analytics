import { describe, it, expect } from "vitest";
import {
  applyDoublesTrainingDart,
  DoublesTrainingEngine,
  doublesTrainingEngineFactory,
  initialDoublesTrainingState,
} from "@modules/game/doubles-training.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  DartObservation,
  DoublesTrainingSeatState,
  EngineFacts,
} from "@modules/types";
import type { DoublesTrainingSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config: Seated<DoublesTrainingSnapshot> = {
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  seats: SEATS,
};

function hitObservationFor(state: DoublesTrainingSeatState): DartObservation {
  const target = targetAt(doublesPath(), state.targetIndex);
  return target.kind === "BULL"
    ? {
        hitTargetNumber: 25,
        hitZoneKey: "INNER_BULL",
        locationX: null,
        locationY: null,
      }
    : {
        hitTargetNumber: target.number,
        hitZoneKey: "DOUBLE",
        locationX: null,
        locationY: null,
      };
}

function missObservationFor(state: DoublesTrainingSeatState): DartObservation {
  const target = targetAt(doublesPath(), state.targetIndex);
  return target.kind === "BULL"
    ? {
        hitTargetNumber: 25,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      }
    : {
        hitTargetNumber: target.number,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      };
}

/** The single configured seat's initial per-seat reducer state. */
function initialSeat(): DoublesTrainingSeatState {
  return initialDoublesTrainingState(config).seats[0];
}

/**
 * Builds `EngineFacts` for 20 completed dart-1-hit visits on targets D1..D20,
 * so an engine created against them rehydrates onto the BULL target.
 */
function facts20TargetsPlayed(): EngineFacts {
  const engine = doublesTrainingEngineFactory.create(config);
  for (let visit = 0; visit < 20; visit++) {
    engine.record(hitObservationFor(engine.state().seats[0]));
  }
  return engine.facts();
}

describe("doublesTrainingEngineFactory", () => {
  it("registers itself under DOUBLES_TRAINING_V1", () => {
    expect(doublesTrainingEngineFactory.rulesetVersionKey).toBe(
      "DOUBLES_TRAINING_V1",
    );
    expect(getEngineFactory("DOUBLES_TRAINING_V1")).toBe(
      doublesTrainingEngineFactory,
    );
  });

  it("builds a DoublesTrainingEngine bound to the ruleset version", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    expect(engine).toBeInstanceOf(DoublesTrainingEngine);
    expect(engine.rulesetVersionKey).toBe("DOUBLES_TRAINING_V1");
  });
});

describe("initialDoublesTrainingState", () => {
  it("starts on target index 0, no darts this visit, no outcomes, in progress, for every configured seat", () => {
    const state = initialDoublesTrainingState(config);
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        targetIndex: 0,
        dartsThisVisit: 0,
        outcomes: [],
        status: "IN_PROGRESS",
      },
    ]);
  });
});

describe("applyDoublesTrainingDart — visit resolution on hit", () => {
  it("ends the visit immediately on a dart-1 hit and advances the target", () => {
    const state = initialSeat();
    const next = applyDoublesTrainingDart(
      config,
      state,
      hitObservationFor(state),
    );
    expect(next.targetIndex).toBe(1);
    expect(next.dartsThisVisit).toBe(0);
    expect(next.outcomes).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 1 },
    ]);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ends the visit on a dart-2 hit after a dart-1 miss", () => {
    let state = initialSeat();
    state = applyDoublesTrainingDart(config, state, missObservationFor(state));
    state = applyDoublesTrainingDart(config, state, hitObservationFor(state));
    expect(state.targetIndex).toBe(1);
    expect(state.outcomes).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 2 },
    ]);
  });

  it("resolves naturally on a dart-3 hit after two misses", () => {
    let state = initialSeat();
    state = applyDoublesTrainingDart(config, state, missObservationFor(state));
    state = applyDoublesTrainingDart(config, state, missObservationFor(state));
    state = applyDoublesTrainingDart(config, state, hitObservationFor(state));
    expect(state.targetIndex).toBe(1);
    expect(state.outcomes).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 3 },
    ]);
  });
});

describe("applyDoublesTrainingDart — visit resolution on full miss", () => {
  it("still advances after all 3 darts miss", () => {
    let state = initialSeat();
    state = applyDoublesTrainingDart(config, state, missObservationFor(state));
    state = applyDoublesTrainingDart(config, state, missObservationFor(state));
    state = applyDoublesTrainingDart(config, state, missObservationFor(state));
    expect(state.targetIndex).toBe(1);
    expect(state.outcomes).toEqual([
      { targetIndex: 0, hit: false, hitDartNumber: null },
    ]);
  });

  it("does not resolve the visit or record an outcome after only 1 miss", () => {
    const state = initialSeat();
    const next = applyDoublesTrainingDart(
      config,
      state,
      missObservationFor(state),
    );
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.outcomes).toEqual([]);
  });
});

describe("applyDoublesTrainingDart — path completion", () => {
  it("completes after a dart-1 hit on every one of the 21 targets", () => {
    let state = initialSeat();
    for (let visit = 0; visit < 21; visit++) {
      state = applyDoublesTrainingDart(config, state, hitObservationFor(state));
    }
    expect(state.status).toBe("COMPLETE");
    expect(state.outcomes).toHaveLength(21);
    expect(
      state.outcomes.every((o) => o.hit === true && o.hitDartNumber === 1),
    ).toBe(true);
  });

  it("completes correctly through a mixed pattern of dart-1/2/3 hits and full misses", () => {
    let state = initialSeat();
    for (let visit = 0; visit < 21; visit++) {
      const pattern = visit % 4;
      if (pattern === 0) {
        state = applyDoublesTrainingDart(
          config,
          state,
          hitObservationFor(state),
        );
      } else if (pattern === 1) {
        state = applyDoublesTrainingDart(
          config,
          state,
          missObservationFor(state),
        );
        state = applyDoublesTrainingDart(
          config,
          state,
          hitObservationFor(state),
        );
      } else if (pattern === 2) {
        state = applyDoublesTrainingDart(
          config,
          state,
          missObservationFor(state),
        );
        state = applyDoublesTrainingDart(
          config,
          state,
          missObservationFor(state),
        );
        state = applyDoublesTrainingDart(
          config,
          state,
          hitObservationFor(state),
        );
      } else {
        state = applyDoublesTrainingDart(
          config,
          state,
          missObservationFor(state),
        );
        state = applyDoublesTrainingDart(
          config,
          state,
          missObservationFor(state),
        );
        state = applyDoublesTrainingDart(
          config,
          state,
          missObservationFor(state),
        );
      }
    }
    expect(state.status).toBe("COMPLETE");
    expect(state.outcomes).toHaveLength(21);
    const hitDartNumbers = new Set(state.outcomes.map((o) => o.hitDartNumber));
    expect(hitDartNumbers.size).toBeGreaterThan(1);
  });
});

describe("applyDoublesTrainingDart — BULL visit completion", () => {
  it("completes the session on a bull hit", () => {
    const bullState: DoublesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      dartsThisVisit: 0,
      outcomes: [],
      status: "IN_PROGRESS",
    };
    const next = applyDoublesTrainingDart(
      config,
      bullState,
      hitObservationFor(bullState),
    );
    expect(next.status).toBe("COMPLETE");
    expect(next.outcomes).toEqual([
      { targetIndex: 20, hit: true, hitDartNumber: 1 },
    ]);
  });

  it("completes the session even when the bull visit is a full miss", () => {
    const bullState: DoublesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      dartsThisVisit: 2,
      outcomes: [],
      status: "IN_PROGRESS",
    };
    const next = applyDoublesTrainingDart(
      config,
      bullState,
      missObservationFor(bullState),
    );
    expect(next.status).toBe("COMPLETE");
    expect(next.outcomes).toEqual([
      { targetIndex: 20, hit: false, hitDartNumber: null },
    ]);
  });
});

describe("applyDoublesTrainingDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: DoublesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      dartsThisVisit: 0,
      outcomes: [{ targetIndex: 20, hit: true, hitDartNumber: 1 }],
      status: "COMPLETE",
    };
    expect(() =>
      applyDoublesTrainingDart(config, completeState, {
        hitTargetNumber: 25,
        hitZoneKey: "INNER_BULL",
        locationX: null,
        locationY: null,
      }),
    ).toThrow();
  });
});

describe("DoublesTrainingEngine — fact log and derived state (Task 8 acceptance)", () => {
  it("ends the visit on a hit and records only the darts thrown", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const turn = engine.facts().turns[0];
    expect(turn.darts).toHaveLength(2);
    expect(turn.totalScore).toBe(2);
    expect(engine.state().seats[0].targetIndex).toBe(1);
  });

  it("derives which dart hit from the fact log", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().seats[0].outcomes[0]).toEqual({
      targetIndex: 0,
      hit: true,
      hitDartNumber: 2,
    });
  });

  it("records a full-miss visit as three darts and no hit", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 5,
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

    expect(engine.facts().turns[0].darts).toHaveLength(3);
    expect(engine.state().seats[0].outcomes[0]).toEqual({
      targetIndex: 0,
      hit: false,
      hitDartNumber: null,
    });
    expect(engine.state().seats[0].targetIndex).toBe(1);
  });

  it("records the intended DOUBLE target on every dart, and the dart's own board score", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.intendedTargetNumber).toBe(1);
    expect(dart.intendedZoneKey).toBe("DOUBLE");
    expect(dart.score).toBe(60);
  });

  it("records the actual board score of a miss that lands in a single, not a game-specific value", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.facts().turns[0].darts[0].score).toBe(20);
  });

  it("rehydrates the target and outcomes from persisted facts", () => {
    const first = doublesTrainingEngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const resumed = doublesTrainingEngineFactory.create(config, first.facts());
    expect(resumed.state().seats[0].targetIndex).toBe(1);
    expect(resumed.state().seats[0].outcomes).toHaveLength(1);
  });

  it("completes after the bull visit", () => {
    const engine = doublesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record({
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(engine.isComplete()).toBe(true);
  });

  it("completes the session even when the bull visit is a full miss", () => {
    const engine = doublesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record({
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].outcomes.at(-1)).toEqual({
      targetIndex: 20,
      hit: false,
      hitDartNumber: null,
    });
  });
});

describe("DoublesTrainingEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));

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
    const engine = new DoublesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("stamps completedAt the moment a hit closes the visit, and clears it on undo", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toBeNull();
    const before = engine.facts();

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("stamps completedAt on the 3rd miss that closes a full-miss visit", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  it("numbers darts within a turn from 1, and opens a fresh turn per visit regardless of dart count", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));

    const [firstTurn, secondTurn, thirdTurn] = engine.facts().turns;
    expect(firstTurn.sequence).toBe(1);
    expect(firstTurn.darts.map((dart) => dart.sequence)).toEqual([1, 2, 3]);
    expect(secondTurn.sequence).toBe(2);
    expect(secondTurn.darts.map((dart) => dart.sequence)).toEqual([1]);
    expect(thirdTurn.sequence).toBe(3);
    expect(thirdTurn.darts.map((dart) => dart.sequence)).toEqual([1]);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("DoublesTrainingEngine — dart location facts", () => {
  it("carries the observation's locationX/locationY onto the dart fact", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 5,
      locationY: -132,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-132);
  });

  it("keeps the dart's location null for a keypad-entered dart", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });
});

describe("DoublesTrainingEngine", () => {
  it("starts on target DOUBLE 1, no darts this visit, empty outcomes, not complete", () => {
    const engine = new DoublesTrainingEngine(config);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.state().seats[0].dartsThisVisit).toBe(0);
    expect(engine.state().seats[0].outcomes).toEqual([]);
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates record to the reducer and exposes the updated state via state()", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));

    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
    expect(engine.state().seats[0].outcomes).toEqual([
      { targetIndex: 0, hit: true, hitDartNumber: 2 },
    ]);
  });

  it("reports isComplete once the full 21-visit path is finished", () => {
    const engine = new DoublesTrainingEngine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0]));
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].outcomes).toHaveLength(21);
    expect(engine.facts().turns).toHaveLength(21);
  });
});

describe("DoublesTrainingEngine.wouldComplete", () => {
  it("is false for a dart-1 hit that only advances past a non-BULL target", () => {
    const engine = new DoublesTrainingEngine(config);
    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("is false for a miss that only continues the current visit", () => {
    const engine = new DoublesTrainingEngine(config);
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("is true for a hit on the BULL target", () => {
    const engine = doublesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is true for the 3rd dart when a full miss on BULL still ends the path", () => {
    const engine = doublesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false once the session has already ended", () => {
    const engine = doublesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.state().status).toBe("COMPLETE");
    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(false);

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("DoublesTrainingEngine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new DoublesTrainingEngine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() when it opened a new turn", () => {
    const engine = new DoublesTrainingEngine(config);
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    const before = engine.facts();
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when a hit closed the turn early", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when a third miss closed the turn", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    const before = engine.facts();

    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].targetIndex).toBe(1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state().seats[0].targetIndex).toBe(0);
    expect(engine.state().seats[0].dartsThisVisit).toBe(2);
    expect(engine.state().seats[0].outcomes).toEqual([]);
  });

  it("reopens the visit when undoing a hit that ended it early, rather than leaving it closed", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].targetIndex).toBe(1);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].targetIndex).toBe(0);
    expect(engine.state().seats[0].dartsThisVisit).toBe(1);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(1);

    const resumed = engine.record(missObservationFor(engine.state().seats[0]));
    expect(resumed.seats[0].targetIndex).toBe(0);
    expect(resumed.seats[0].dartsThisVisit).toBe(2);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(2);
  });

  it("does not push a phantom dart when record is rejected on a finished session", () => {
    const engine = doublesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.isComplete()).toBe(true);

    expect(() =>
      engine.record(hitObservationFor(engine.state().seats[0])),
    ).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].outcomes).toHaveLength(20);
  });

  it("reverts a single miss mid-visit, allowing a fresh dart-1 hit afterward", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    const state = engine.record(hitObservationFor(engine.state().seats[0]));
    expect(state.seats[0].outcomes[0]).toEqual({
      targetIndex: 0,
      hit: true,
      hitDartNumber: 1,
    });
  });

  it("reverts the completing dart, allowing the engine to be marked complete again after redo", () => {
    const engine = new DoublesTrainingEngine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0]));
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].outcomes).toHaveLength(21);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].outcomes).toHaveLength(20);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "BULL",
    });

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].outcomes).toHaveLength(21);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
    expect(engine.state().seats[0].outcomes).toHaveLength(1);

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.state().seats[0].outcomes).toHaveLength(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = doublesTrainingEngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const resumed = doublesTrainingEngineFactory.create(config, first.facts());
    resumed.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(resumed.state().seats[0].targetIndex).toBe(1);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(1);
    expect(resumed.state().seats[0].targetIndex).toBe(0);
    expect(resumed.state().seats[0].dartsThisVisit).toBe(1);
  });
});

describe("applyDoublesTrainingDart — order-dependent completion", () => {
  it("does not complete on the first (bull) visit under a HIGH_TO_LOW order", () => {
    const highToLowConfig: Seated<DoublesTrainingSnapshot> = {
      ...config,
      orderMode: "HIGH_TO_LOW",
      targetOrder: [
        25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
        1,
      ],
    };
    const state = initialDoublesTrainingState(highToLowConfig).seats[0];
    const next = applyDoublesTrainingDart(highToLowConfig, state, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.targetIndex).toBe(1);
  });

  it("completes on the last target of a RANDOM order even though it is not BULL", () => {
    const randomConfig: Seated<DoublesTrainingSnapshot> = {
      ...config,
      orderMode: "RANDOM",
      targetOrder: [
        25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20,
      ],
    };
    const state: DoublesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      dartsThisVisit: 0,
      outcomes: [],
      status: "IN_PROGRESS",
    };
    const next = applyDoublesTrainingDart(randomConfig, state, {
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("COMPLETE");
  });
});

describe("DoublesTrainingEngine — 1v1", () => {
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
  const twoSeatConfig: Seated<DoublesTrainingSnapshot> = {
    mode: "EASY",
    orderMode: "LOW_TO_HIGH",
    targetOrder: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ],
    seats: twoSeats,
  };

  it("both seats play all 21 targets, most doubles hit wins", () => {
    const engine = new DoublesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      const zone = round < 20 ? "DOUBLE" : "INNER_BULL";
      engine.record({
        hitTargetNumber: number,
        hitZoneKey: zone,
        locationX: null,
        locationY: null,
      }); // p1: hits dart 1 every visit
      engine.record({
        hitTargetNumber: number,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      }); // p2 dart 1
      engine.record({
        hitTargetNumber: number,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      }); // p2 dart 2
      engine.record({
        hitTargetNumber: number,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      }); // p2 dart 3: visit resolves as a miss
    }
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.seats[0].outcomes.filter((o) => o.hit).length).toBe(21);
    expect(state.seats[1].outcomes.filter((o) => o.hit).length).toBe(0);
    expect(state.winningSideKey).toBe("A");
  });

  it("ties when both seats finish with an equal doubles-hit count", () => {
    const engine = new DoublesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) {
        engine.record({
          hitTargetNumber: number,
          hitZoneKey: "MISS",
          locationX: null,
          locationY: null,
        }); // p1
      }
      for (let d = 0; d < 3; d++) {
        engine.record({
          hitTargetNumber: number,
          hitZoneKey: "MISS",
          locationX: null,
          locationY: null,
        }); // p2
      }
    }
    const state = engine.state();
    expect(state.status).toBe("TIE");
    expect(state.winningSideKey).toBeNull();
  });
});

describe("Doubles Training dart intention", () => {
  it("stamps the current double as the intended target, whatever was hit", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 7,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    const first = targetAt(doublesPath(config.targetOrder), 0);
    const dart = engine.facts().turns[0].darts[0];
    expect(dart.intendedTargetNumber).toBe(
      first.kind === "BULL" ? 25 : first.number,
    );
    expect(dart.intendedZoneKey).toBe(
      first.kind === "BULL" ? "INNER_BULL" : "DOUBLE",
    );
  });

  it("undo removes the visit entirely once its only dart goes", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 7,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toEqual([]);
    expect(engine.undo()).toBe(false);
  });
});
