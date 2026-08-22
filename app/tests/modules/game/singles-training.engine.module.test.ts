import { describe, it, expect } from "vitest";
import {
  applySinglesTrainingDart,
  initialSinglesTrainingState,
  SinglesTrainingEngine,
  singlesTrainingEngineFactory,
} from "@modules/game/singles-training.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  SinglesTrainingSeatState,
} from "@modules/types";
import type { SinglesSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config: Seated<SinglesSnapshot> = {
  orderMode: "LOW_TO_HIGH",
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
  seats: SEATS,
};

function hitObservationFor(
  state: SinglesTrainingSeatState,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  const target = targetAt(numbersPath(), state.targetIndex);
  if (target.kind === "BULL") {
    return {
      hitTargetNumber: 25,
      hitZoneKey: zone === "DOUBLE" ? "INNER_BULL" : "OUTER_BULL",
      locationX: null,
      locationY: null,
    };
  }
  return {
    hitTargetNumber: target.number,
    hitZoneKey: zone,
    locationX: null,
    locationY: null,
  };
}

function missObservationFor(state: SinglesTrainingSeatState): DartObservation {
  const target = targetAt(numbersPath(), state.targetIndex);
  return {
    hitTargetNumber: target.kind === "BULL" ? 25 : target.number,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

/** The single configured seat's initial per-seat reducer state. */
function initialSeat(): SinglesTrainingSeatState {
  return initialSinglesTrainingState(config).seats[0];
}

/**
 * Builds `EngineFacts` for 20 completed all-MISS visits on targets 1..20, so
 * an engine created against them rehydrates onto the BULL target.
 */
function facts20TargetsPlayed(): EngineFacts {
  const engine = singlesTrainingEngineFactory.create(config);
  for (let visit = 0; visit < 20; visit++) {
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
  }
  return engine.facts();
}

describe("singlesTrainingEngineFactory", () => {
  it("registers itself under SINGLES_V1", () => {
    expect(singlesTrainingEngineFactory.rulesetVersionKey).toBe("SINGLES_V1");
    expect(getEngineFactory("SINGLES_V1")).toBe(singlesTrainingEngineFactory);
  });

  it("builds a SinglesTrainingEngine bound to the ruleset version", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    expect(engine).toBeInstanceOf(SinglesTrainingEngine);
    expect(engine.rulesetVersionKey).toBe("SINGLES_V1");
  });
});

describe("initialSinglesTrainingState", () => {
  it("starts at 0 points on target index 0, in progress, for every configured seat", () => {
    const state = initialSinglesTrainingState(config);
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        targetIndex: 0,
        totalPoints: 0,
        dartsThisVisit: 0,
        status: "IN_PROGRESS",
      },
    ]);
  });
});

describe("applySinglesTrainingDart — ring scoring on a NUMBER target", () => {
  it("scores pointsSingle for a SINGLE hit and keeps the same target", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(1);
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("scores pointsDouble for a DOUBLE hit", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(2);
  });

  it("scores pointsTreble for a TREBLE hit", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(3);
  });

  it("scores 0 points for a MISS but still counts the dart", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("scores 0 training points when the dart lands on a different number than the target, but the number is a genuine hit", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("sums a mixed 3-dart visit and advances the target on the 3rd dart", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    state = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    state = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(state.totalPoints).toBe(6);
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applySinglesTrainingDart — path completion", () => {
  it("completes after a full run of TREBLE on every NUMBER target and DOUBLE on BULL", () => {
    let state = initialSeat();
    for (let visit = 0; visit < 20; visit++) {
      state = applySinglesTrainingDart(
        config,
        state,
        hitObservationFor(state, "TREBLE"),
      );
      state = applySinglesTrainingDart(
        config,
        state,
        hitObservationFor(state, "TREBLE"),
      );
      state = applySinglesTrainingDart(
        config,
        state,
        hitObservationFor(state, "TREBLE"),
      );
    }
    state = applySinglesTrainingDart(
      config,
      state,
      hitObservationFor(state, "DOUBLE"),
    );
    state = applySinglesTrainingDart(
      config,
      state,
      hitObservationFor(state, "DOUBLE"),
    );
    state = applySinglesTrainingDart(
      config,
      state,
      hitObservationFor(state, "DOUBLE"),
    );
    expect(state.status).toBe("COMPLETE");
    expect(state.totalPoints).toBe(186);
  });
});

describe("applySinglesTrainingDart — BULL target scoring", () => {
  const bullState: SinglesTrainingSeatState = {
    participantRef: "participant-1",
    sideKey: "A",
    targetIndex: 20,
    totalPoints: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };

  it("scores pointsSingle for an OUTER_BULL hit", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(1);
  });

  it("scores pointsDouble for an INNER_BULL hit", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(2);
  });

  it("scores 0 points for a TREBLE hit on BULL (not a physically valid ring, defensive)", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(0);
  });

  it("sets status COMPLETE on the bull visit's 3rd dart, not just advancing", () => {
    const twoDartsIn: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 10,
      dartsThisVisit: 2,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(config, twoDartsIn, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("COMPLETE");
    expect(next.dartsThisVisit).toBe(0);
  });

  it("scores 0 points for a MISS on BULL", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(0);
  });
});

describe("applySinglesTrainingDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 186,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() =>
      applySinglesTrainingDart(config, completeState, {
        hitTargetNumber: 25,
        hitZoneKey: "OUTER_BULL",
        locationX: null,
        locationY: null,
      }),
    ).toThrow();
  });
});

describe("SinglesTrainingEngine — fact log and derived state (Task 7 acceptance)", () => {
  it("stores board score in the fact and derives training points", () => {
    const engine = singlesTrainingEngineFactory.create(config);
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
    expect(engine.state().seats[0].totalPoints).toBe(3);
  });

  it("scores a dart that missed the target as zero training points but keeps the board fact", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    expect(engine.facts().turns[0].darts[0].score).toBe(60);
    expect(engine.state().seats[0].totalPoints).toBe(0);
  });

  it("advances to the next target after three darts", () => {
    const engine = singlesTrainingEngineFactory.create(config);
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

  it("maps bull rings to the bull zones and their training points", () => {
    const engine = singlesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record({
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns.at(-1)!.darts.at(-1)!;
    expect(dart.hitZoneKey).toBe("INNER_BULL");
    expect(dart.score).toBe(50);
    expect(engine.state().seats[0].totalPoints).toBe(2);
  });

  it("completes after the bull visit", () => {
    const engine = singlesTrainingEngineFactory.create(
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
  });

  it("records no intended target number and no intended zone on every dart — the target is derivable from the visit index instead", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("rehydrates the derived total points and target from persisted facts", () => {
    const first = singlesTrainingEngineFactory.create(config);
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

    const resumed = singlesTrainingEngineFactory.create(config, first.facts());
    expect(resumed.state().seats[0].totalPoints).toBe(9);
    expect(resumed.state().seats[0].targetIndex).toBe(1);
  });
});

describe("SinglesTrainingEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new SinglesTrainingEngine(config);
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
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("leaves completedAt null until the visit's 3rd dart resolves it", () => {
    const engine = new SinglesTrainingEngine(config);

    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  it("is an exact inverse of record over facts() when undo reopens a closed visit", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    const before = engine.facts();

    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.facts().turns[0].completedAt).not.toBeNull();

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("numbers darts 1..3 within a turn and turns incrementing across visits", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

    const [firstTurn, secondTurn] = engine.facts().turns;
    expect(firstTurn.sequence).toBe(1);
    expect(firstTurn.darts.map((dart) => dart.sequence)).toEqual([1, 2, 3]);
    expect(secondTurn.sequence).toBe(2);
    expect(secondTurn.darts.map((dart) => dart.sequence)).toEqual([1]);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("SinglesTrainingEngine — dart location facts", () => {
  it("carries the observation's locationX/locationY onto the dart fact", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: 12.5,
      locationY: -40.25,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBe(12.5);
    expect(dart.locationY).toBe(-40.25);
  });

  it("keeps the dart's location null for a keypad-entered dart", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });
});

describe("SinglesTrainingEngine", () => {
  it("starts at 0 points on target NUMBER 1, not complete", () => {
    const engine = new SinglesTrainingEngine(config);
    expect(engine.state().seats[0].totalPoints).toBe(0);
    expect(
      targetAt(numbersPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "NUMBER",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates record to the reducer and exposes the updated state via state()", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(engine.state().seats[0].totalPoints).toBe(3);
    expect(
      targetAt(numbersPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "NUMBER",
      number: 1,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(engine.state().seats[0].totalPoints).toBe(9);
    expect(
      targetAt(numbersPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "NUMBER",
      number: 2,
    });
  });

  it("reports isComplete once the full path is finished", () => {
    const engine = new SinglesTrainingEngine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
    }
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].totalPoints).toBe(186);
  });
});

describe("SinglesTrainingEngine.wouldComplete", () => {
  it("is false for the 1st and 2nd dart of a visit, regardless of outcome", () => {
    const engine = new SinglesTrainingEngine(config);
    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "SINGLE"),
      ),
    ).toBe(false);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("is false for the 3rd dart when the visit resolves but advances to the next NUMBER target", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "SINGLE"),
      ),
    ).toBe(false);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is true for the 3rd dart on BULL when the run completes the path", () => {
    const engine = singlesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(true);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is false once the game has already ended", () => {
    const engine = singlesTrainingEngineFactory.create(
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
    expect(engine.state().seats[0].status).toBe("COMPLETE");
    expect(
      engine.wouldComplete({
        hitTargetNumber: 25,
        hitZoneKey: "OUTER_BULL",
        locationX: null,
        locationY: null,
      }),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete(
        hitObservationFor(engine.state().seats[0], "SINGLE"),
      ),
    ).toBe(false);

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("SinglesTrainingEngine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new SinglesTrainingEngine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() when it opened a new turn", () => {
    const engine = new SinglesTrainingEngine(config);
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("does not push a phantom dart when record is rejected on a finished session", () => {
    const engine = new SinglesTrainingEngine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
    }
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    expect(engine.isComplete()).toBe(true);

    expect(() =>
      engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE")),
    ).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].totalPoints).toBe(184);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].totalPoints).toBe(182);
  });

  it("reverts a single dart", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].totalPoints).toBe(0);
  });

  it("reverts the 3rd dart of a visit, restoring the mid-visit total, then can still resolve the visit", () => {
    const engine = new SinglesTrainingEngine(config);
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
    const afterThird = engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(afterThird.seats[0].totalPoints).toBe(3);
    expect(afterThird.seats[0].targetIndex).toBe(1);

    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].totalPoints).toBe(2);
    expect(
      targetAt(numbersPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "NUMBER",
      number: 1,
    });

    const resumed = engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(resumed.seats[0].totalPoints).toBe(2);
    expect(resumed.seats[0].targetIndex).toBe(1);
    expect(resumed.seats[0].dartsThisVisit).toBe(0);
  });

  it("reverts the completing dart, allowing the engine to be marked complete again on redo", () => {
    const engine = new SinglesTrainingEngine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "TREBLE"));
    }
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    expect(engine.isComplete()).toBe(false);
    engine.record(hitObservationFor(engine.state().seats[0], "DOUBLE"));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].totalPoints).toBe(186);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].totalPoints).toBe(184);

    const resumed = engine.record(
      hitObservationFor(engine.state().seats[0], "DOUBLE"),
    );
    expect(engine.isComplete()).toBe(true);
    expect(resumed.seats[0].totalPoints).toBe(186);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new SinglesTrainingEngine(config);
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
    expect(engine.state().seats[0].totalPoints).toBe(4);
    expect(
      targetAt(numbersPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "NUMBER",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].totalPoints).toBe(0);
    expect(
      targetAt(numbersPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "NUMBER",
      number: 1,
    });
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = singlesTrainingEngineFactory.create(config);
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

    const resumed = singlesTrainingEngineFactory.create(config, first.facts());
    resumed.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(resumed.state().seats[0].totalPoints).toBe(3);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().seats[0].totalPoints).toBe(2);
  });
});

describe("applySinglesTrainingDart — order-dependent completion", () => {
  it("does not complete on the first (bull) visit under a HIGH_TO_LOW order", () => {
    const highToLowConfig: Seated<SinglesSnapshot> = {
      ...config,
      orderMode: "HIGH_TO_LOW",
      targetOrder: [
        25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
        1,
      ],
    };
    let state = initialSeat();
    for (let dart = 0; dart < 3; dart++) {
      state = applySinglesTrainingDart(highToLowConfig, state, {
        hitTargetNumber: 25,
        hitZoneKey: "OUTER_BULL",
        locationX: null,
        locationY: null,
      });
    }
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });

  it("completes on the last target of a RANDOM order even though it is not BULL", () => {
    const randomConfig: Seated<SinglesSnapshot> = {
      ...config,
      orderMode: "RANDOM",
      targetOrder: [
        25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20,
      ],
    };
    const twoDartsIn: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 2,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(randomConfig, twoDartsIn, {
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("COMPLETE");
  });
});

describe("SinglesTrainingEngine — 1v1", () => {
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
  const twoSeatConfig: Seated<SinglesSnapshot> = {
    orderMode: "LOW_TO_HIGH",
    targetOrder: Array.from({ length: 20 }, (_, i) => i + 1).concat(25),
    difficulty: "EASY",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
    seats: twoSeats,
  };

  function dart(number: number, zone: DartZoneKey): DartObservation {
    return {
      hitTargetNumber: number,
      hitZoneKey: zone,
      locationX: null,
      locationY: null,
    };
  }

  it("both seats play all 21 targets, higher training-point total wins", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) engine.record(dart(number, "TREBLE")); // p1: max points every visit
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS")); // p2: zero every visit
    }
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
  });

  it("alternates seats strictly A, B, A, B, ... across every visit, never skipping ahead", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    expect(engine.state().activeParticipantRef).toBe("p1");
    for (let d = 0; d < 3; d++) engine.record(dart(1, "MISS"));
    expect(engine.state().activeParticipantRef).toBe("p2");
    for (let d = 0; d < 3; d++) engine.record(dart(1, "MISS"));
    expect(engine.state().activeParticipantRef).toBe("p1");
  });

  it("undo crossing the seat boundary restores the previous active seat, not the next one", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let d = 0; d < 3; d++) engine.record(dart(1, "MISS")); // p1's visit closes
    expect(engine.state().activeParticipantRef).toBe("p2");
    engine.record(dart(1, "MISS")); // p2's 1st dart of a new visit

    expect(engine.undo()).toBe(true); // pops p2's only dart, removing p2's open turn
    expect(engine.state().activeParticipantRef).toBe("p2"); // still p2's turn to play

    expect(engine.undo()).toBe(true); // pops p1's 3rd dart, reopening p1's visit
    expect(engine.state().activeParticipantRef).toBe("p1");
    expect(engine.state().seats[0].dartsThisVisit).toBe(2);
  });

  it("stays IN_PROGRESS once one seat finishes its 21st target while the other has not", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS")); // p1
      if (round < 20) {
        for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS")); // p2
      }
    }
    const state = engine.state();
    expect(state.seats[0].status).toBe("COMPLETE");
    expect(state.seats[1].status).toBe("IN_PROGRESS");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.activeParticipantRef).toBe("p2");
  });

  it("ties when both seats finish with an equal training-point total", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS")); // p1
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS")); // p2
    }
    const state = engine.state();
    expect(state.status).toBe("TIE");
    expect(state.winningSideKey).toBeNull();
  });
});

/**
 * Self-review regression (Task 17): confirms the per-seat `status` guard the
 * brief's `record()` already carries is sufficient to keep a decided 1v1
 * match's fact log immutable — no separate match-level guard (unlike
 * `ScoreTrainingEngine.isMatchDecided()` or `TuodEngine`'s `isComplete()`
 * check) is needed, because every seat carries its own genuine `status` and
 * both seats always take the identical, fixed number of visits (21) in
 * strict alternation with no race/instant-win shortcut. Once the match is
 * COMPLETE/TIE, EVERY seat is COMPLETE by the fold's own `allComplete`
 * definition, so whichever seat `activeSeat()` names next is necessarily
 * COMPLETE too, and `record()`'s existing per-seat check throws — this is
 * the mirror image of `AroundTheClockEngine`, which needs no separate guard
 * for the same reason, and the opposite of `ShanghaiEngine`, whose race
 * short-circuit needs one because a race can end the match while the OTHER
 * seat's own status still reads `IN_PROGRESS`. Singles Training composes no
 * `raceWinner` — score-compare only — so that gap does not apply here.
 */
describe("SinglesTrainingEngine — 1v1 completion guard", () => {
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
  const twoSeatConfig: Seated<SinglesSnapshot> = {
    orderMode: "LOW_TO_HIGH",
    targetOrder: Array.from({ length: 20 }, (_, i) => i + 1).concat(25),
    difficulty: "EASY",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
    seats: twoSeats,
  };

  function dart(number: number, zone: DartZoneKey): DartObservation {
    return {
      hitTargetNumber: number,
      hitZoneKey: zone,
      locationX: null,
      locationY: null,
    };
  }

  it("throws on a stray record() once both seats have completed, leaving the fact log untouched", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS"));
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS"));
    }
    expect(engine.state().status).toBe("TIE");
    const factsBefore = engine.facts();

    expect(() => engine.record(dart(1, "MISS"))).toThrow();

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state().status).toBe("TIE");
  });

  it("wouldComplete is false once the match has already been decided by score-compare", () => {
    const engine = new SinglesTrainingEngine(twoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const number = round < 20 ? round + 1 : 25;
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS"));
      for (let d = 0; d < 3; d++) engine.record(dart(number, "MISS"));
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.wouldComplete(dart(1, "MISS"))).toBe(false);
  });
});
