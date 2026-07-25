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
  EngineFacts,
  SinglesTrainingState,
} from "@modules/game/types";
import type { SinglesSnapshot } from "@lib/game/rulesets/types";

const config: SinglesSnapshot = {
  orderMode: "LOW_TO_HIGH",
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
};

function hitObservationFor(
  state: SinglesTrainingState,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  const target = targetAt(numbersPath(), state.targetIndex);
  if (target.kind === "BULL") {
    return {
      hitTargetNumber: 25,
      hitZoneKey: zone === "DOUBLE" ? "INNER_BULL" : "OUTER_BULL",
    };
  }
  return { hitTargetNumber: target.number, hitZoneKey: zone };
}

function missObservationFor(state: SinglesTrainingState): DartObservation {
  const target = targetAt(numbersPath(), state.targetIndex);
  return {
    hitTargetNumber: target.kind === "BULL" ? 25 : target.number,
    hitZoneKey: "MISS",
  };
}

/**
 * Builds `EngineFacts` for 20 completed all-MISS visits on targets 1..20, so
 * an engine created against them rehydrates onto the BULL target.
 */
function facts20TargetsPlayed(): EngineFacts {
  const engine = singlesTrainingEngineFactory.create(config);
  for (let visit = 0; visit < 20; visit++) {
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
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
  it("starts at 0 points on target index 0, in progress", () => {
    expect(initialSinglesTrainingState()).toEqual({
      targetIndex: 0,
      totalPoints: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("applySinglesTrainingDart — ring scoring on a NUMBER target", () => {
  it("scores pointsSingle for a SINGLE hit and keeps the same target", () => {
    const state = initialSinglesTrainingState();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
    });
    expect(next.totalPoints).toBe(1);
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("scores pointsDouble for a DOUBLE hit", () => {
    const state = initialSinglesTrainingState();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
    });
    expect(next.totalPoints).toBe(2);
  });

  it("scores pointsTreble for a TREBLE hit", () => {
    const state = initialSinglesTrainingState();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
    });
    expect(next.totalPoints).toBe(3);
  });

  it("scores 0 points for a MISS but still counts the dart", () => {
    const state = initialSinglesTrainingState();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
    });
    expect(next.totalPoints).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("scores 0 training points when the dart lands on a different number than the target, but the number is a genuine hit", () => {
    const state = initialSinglesTrainingState();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
    });
    expect(next.totalPoints).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("sums a mixed 3-dart visit and advances the target on the 3rd dart", () => {
    let state = initialSinglesTrainingState();
    state = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
    });
    state = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
    });
    state = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
    });
    expect(state.totalPoints).toBe(6);
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applySinglesTrainingDart — path completion", () => {
  it("completes after a full run of TREBLE on every NUMBER target and DOUBLE on BULL", () => {
    let state = initialSinglesTrainingState();
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
  const bullState: SinglesTrainingState = {
    targetIndex: 20,
    totalPoints: 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
  };

  it("scores pointsSingle for an OUTER_BULL hit", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
    });
    expect(next.totalPoints).toBe(1);
  });

  it("scores pointsDouble for an INNER_BULL hit", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
    });
    expect(next.totalPoints).toBe(2);
  });

  it("scores 0 points for a TREBLE hit on BULL (not a physically valid ring, defensive)", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "TREBLE",
    });
    expect(next.totalPoints).toBe(0);
  });

  it("sets status COMPLETE on the bull visit's 3rd dart, not just advancing", () => {
    const twoDartsIn: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 10,
      dartsThisVisit: 2,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(config, twoDartsIn, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
    });
    expect(next.status).toBe("COMPLETE");
    expect(next.dartsThisVisit).toBe(0);
  });

  it("scores 0 points for a MISS on BULL", () => {
    const next = applySinglesTrainingDart(config, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
    });
    expect(next.totalPoints).toBe(0);
  });
});

describe("applySinglesTrainingDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 186,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() =>
      applySinglesTrainingDart(config, completeState, {
        hitTargetNumber: 25,
        hitZoneKey: "OUTER_BULL",
      }),
    ).toThrow();
  });
});

describe("SinglesTrainingEngine — fact log and derived state (Task 7 acceptance)", () => {
  it("stores board score in the fact and derives training points", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.score).toBe(3);
    expect(dart.intendedTargetNumber).toBe(1);
    expect(dart.intendedZoneKey).toBe("SINGLE");
    expect(engine.state().totalPoints).toBe(3);
  });

  it("scores a dart that missed the target as zero training points but keeps the board fact", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record({ hitTargetNumber: 20, hitZoneKey: "TREBLE" });

    expect(engine.facts().turns[0].darts[0].score).toBe(60);
    expect(engine.state().totalPoints).toBe(0);
  });

  it("advances to the next target after three darts", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });

    expect(engine.state().targetIndex).toBe(1);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].totalScore).toBe(3);
  });

  it("maps bull rings to the bull zones and their training points", () => {
    const engine = singlesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record({ hitTargetNumber: 25, hitZoneKey: "INNER_BULL" });

    const dart = engine.facts().turns.at(-1)!.darts.at(-1)!;
    expect(dart.hitZoneKey).toBe("INNER_BULL");
    expect(dart.score).toBe(50);
    expect(engine.state().totalPoints).toBe(2);
  });

  it("completes after the bull visit", () => {
    const engine = singlesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
    engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
    engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });

    expect(engine.isComplete()).toBe(true);
  });

  it("records the intended target and zone on every dart", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    engine.record({ hitTargetNumber: 20, hitZoneKey: "TREBLE" });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.intendedTargetNumber).toBe(1);
    expect(dart.intendedZoneKey).toBe("SINGLE");
  });

  it("rehydrates the derived total points and target from persisted facts", () => {
    const first = singlesTrainingEngineFactory.create(config);
    first.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });
    first.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });
    first.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });

    const resumed = singlesTrainingEngineFactory.create(config, first.facts());
    expect(resumed.state().totalPoints).toBe(9);
    expect(resumed.state().targetIndex).toBe(1);
  });
});

describe("SinglesTrainingEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new SinglesTrainingEngine(config);
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
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("numbers darts 1..3 within a turn and turns incrementing across visits", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));

    const [firstTurn, secondTurn] = engine.facts().turns;
    expect(firstTurn.sequence).toBe(1);
    expect(firstTurn.darts.map((dart) => dart.sequence)).toEqual([1, 2, 3]);
    expect(secondTurn.sequence).toBe(2);
    expect(secondTurn.darts.map((dart) => dart.sequence)).toEqual([1]);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("SinglesTrainingEngine", () => {
  it("starts at 0 points on target NUMBER 1, not complete", () => {
    const engine = new SinglesTrainingEngine(config);
    expect(engine.state().totalPoints).toBe(0);
    expect(targetAt(numbersPath(), engine.state().targetIndex)).toEqual({
      kind: "NUMBER",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates record to the reducer and exposes the updated state via state()", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });
    expect(engine.state().totalPoints).toBe(3);
    expect(targetAt(numbersPath(), engine.state().targetIndex)).toEqual({
      kind: "NUMBER",
      number: 1,
    });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });
    expect(engine.state().totalPoints).toBe(9);
    expect(targetAt(numbersPath(), engine.state().targetIndex)).toEqual({
      kind: "NUMBER",
      number: 2,
    });
  });

  it("reports isComplete once the full path is finished", () => {
    const engine = new SinglesTrainingEngine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
    }
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().totalPoints).toBe(186);
  });
});

describe("SinglesTrainingEngine.wouldComplete", () => {
  it("is false for the 1st and 2nd dart of a visit, regardless of outcome", () => {
    const engine = new SinglesTrainingEngine(config);
    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "SINGLE")),
    ).toBe(false);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.wouldComplete(missObservationFor(engine.state()))).toBe(
      false,
    );
  });

  it("is false for the 3rd dart when the visit resolves but advances to the next NUMBER target", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "SINGLE")),
    ).toBe(false);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is true for the 3rd dart on BULL when the run completes the path", () => {
    const engine = singlesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.wouldComplete(missObservationFor(engine.state()))).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false once the game has already ended", () => {
    const engine = singlesTrainingEngineFactory.create(
      config,
      facts20TargetsPlayed(),
    );
    engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
    engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
    engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
    expect(engine.state().status).toBe("COMPLETE");
    expect(
      engine.wouldComplete({ hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" }),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete(hitObservationFor(engine.state(), "SINGLE")),
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
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state(), "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("does not push a phantom dart when record is rejected on a finished session", () => {
    const engine = new SinglesTrainingEngine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
    }
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    expect(engine.isComplete()).toBe(true);

    expect(() =>
      engine.record(hitObservationFor(engine.state(), "DOUBLE")),
    ).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().totalPoints).toBe(184);
    expect(engine.undo()).toBe(true);
    expect(engine.state().totalPoints).toBe(182);
  });

  it("reverts a single dart", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    expect(engine.undo()).toBe(true);
    expect(engine.state().totalPoints).toBe(0);
  });

  it("reverts the 3rd dart of a visit, restoring the mid-visit total, then can still resolve the visit", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    const afterThird = engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
    });
    expect(afterThird.totalPoints).toBe(3);
    expect(afterThird.targetIndex).toBe(1);

    expect(engine.undo()).toBe(true);
    expect(engine.state().totalPoints).toBe(2);
    expect(targetAt(numbersPath(), engine.state().targetIndex)).toEqual({
      kind: "NUMBER",
      number: 1,
    });

    const resumed = engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
    expect(resumed.totalPoints).toBe(2);
    expect(resumed.targetIndex).toBe(1);
    expect(resumed.dartsThisVisit).toBe(0);
  });

  it("reverts the completing dart, allowing the engine to be marked complete again on redo", () => {
    const engine = new SinglesTrainingEngine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
      engine.record(hitObservationFor(engine.state(), "TREBLE"));
    }
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    expect(engine.isComplete()).toBe(false);
    engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().totalPoints).toBe(186);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().totalPoints).toBe(184);

    const resumed = engine.record(hitObservationFor(engine.state(), "DOUBLE"));
    expect(engine.isComplete()).toBe(true);
    expect(resumed.totalPoints).toBe(186);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    engine.record({ hitTargetNumber: 2, hitZoneKey: "SINGLE" });
    expect(engine.state().totalPoints).toBe(4);
    expect(targetAt(numbersPath(), engine.state().targetIndex)).toEqual({
      kind: "NUMBER",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().totalPoints).toBe(0);
    expect(targetAt(numbersPath(), engine.state().targetIndex)).toEqual({
      kind: "NUMBER",
      number: 1,
    });
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = singlesTrainingEngineFactory.create(config);
    first.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    first.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });

    const resumed = singlesTrainingEngineFactory.create(config, first.facts());
    resumed.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
    expect(resumed.state().totalPoints).toBe(3);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().totalPoints).toBe(2);
  });
});
