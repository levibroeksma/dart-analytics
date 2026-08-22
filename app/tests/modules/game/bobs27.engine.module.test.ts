import { describe, it, expect } from "vitest";
import {
  applyBobs27Dart,
  Bobs27Engine,
  bobs27EngineFactory,
  initialBobs27State,
} from "@modules/game/bobs27.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  Bobs27SeatState,
  DartObservation,
  EngineFacts,
} from "@modules/types";
import type { Bobs27Snapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config: Seated<Bobs27Snapshot> = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
  seats: SEATS,
};

function hitObservationFor(seat: Bobs27SeatState): DartObservation {
  const target = targetAt(doublesPath(), seat.targetIndex);
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

function missObservationFor(seat: Bobs27SeatState): DartObservation {
  const target = targetAt(doublesPath(), seat.targetIndex);
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

describe("bobs27EngineFactory", () => {
  it("registers itself under BOBS27_V1", () => {
    expect(bobs27EngineFactory.rulesetVersionKey).toBe("BOBS27_V1");
    expect(getEngineFactory("BOBS27_V1")).toBe(bobs27EngineFactory);
  });

  it("builds a Bobs27Engine bound to the ruleset version", () => {
    const engine = bobs27EngineFactory.create(config);
    expect(engine).toBeInstanceOf(Bobs27Engine);
    expect(engine.rulesetVersionKey).toBe("BOBS27_V1");
  });
});

describe("initialBobs27State", () => {
  it("starts at the ruleset's starting score on D1, in progress", () => {
    const state = initialBobs27State(config);
    expect(state.activeParticipantRef).toBe("participant-1");
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 0,
      score: 27,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    });
  });
});

describe("Bobs27Engine — fact log and derived score (Task 6 acceptance)", () => {
  it("derives the running score from the fact log", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().seats[0].score).toBe(29);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(3);
    expect(engine.facts().turns[0].totalScore).toBe(2);
  });

  it("never writes a negative turn total for a full-miss visit", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().seats[0].score).toBe(25);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("records the intended target on every dart", () => {
    const engine = bobs27EngineFactory.create(config);
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

  it("carries the observed dart location onto the recorded fact", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 12.5,
      locationY: -3.25,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBe(12.5);
    expect(dart.locationY).toBe(-3.25);
  });

  it("carries a null location through for an unseen (bounce-out) dart", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });

  it("rehydrates the derived score and target from persisted facts", () => {
    const first = bobs27EngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const resumed = bobs27EngineFactory.create(config, first.facts());
    expect(resumed.state().seats[0].score).toBe(33);
    expect(resumed.state().seats[0].targetIndex).toBe(1);
  });

  it("loses when the score reaches zero or below", () => {
    const engine = bobs27EngineFactory.create({ ...config, startScore: 1 });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(engine.state().seats[0].status).toBe("LOST");
    expect(engine.isComplete()).toBe(true);
  });
});

describe("Bobs27Engine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new Bobs27Engine(config);
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
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("leaves completedAt null until the visit's 3rd dart resolves it", () => {
    const engine = new Bobs27Engine(config);

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  it("numbers darts 1..3 within a turn and turns incrementing across visits", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));

    const [firstTurn, secondTurn] = engine.facts().turns;
    expect(firstTurn.sequence).toBe(1);
    expect(firstTurn.darts.map((dart) => dart.sequence)).toEqual([1, 2, 3]);
    expect(secondTurn.sequence).toBe(2);
    expect(secondTurn.darts.map((dart) => dart.sequence)).toEqual([1]);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("applyBobs27Dart — hit scoring", () => {
  it("adds the target's value immediately on a single hit and keeps the same target", () => {
    const state = initialBobs27State(config).seats[0];
    const next = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(next.score).toBe(29);
    expect(next.targetIndex).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("adds each hit as it happens across a 3-hit visit, then advances the target", () => {
    let state = initialBobs27State(config).seats[0];
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(29);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(31);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(33);
    expect(state.targetIndex).toBe(1);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("does not penalize a visit with at least one hit", () => {
    let state = initialBobs27State(config).seats[0];
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(31);
    expect(state.targetIndex).toBe(1);
  });
});

describe("applyBobs27Dart — full-miss penalty", () => {
  it("does not change the score until the 3rd dart resolves a full-miss visit", () => {
    let state = initialBobs27State(config).seats[0];
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(27);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(27);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(25);
    expect(state.targetIndex).toBe(1);
  });

  it("drives the score to exactly 0 and ends the game as LOST", () => {
    let state = initialBobs27State({ ...config, startScore: 2 }).seats[0];
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(0);
    expect(state.status).toBe("LOST");
  });
});

describe("applyBobs27Dart — path completion and win/loss", () => {
  it("wins after a full-hit run through the entire path", () => {
    let state = initialBobs27State(config).seats[0];
    for (let visit = 0; visit < 21; visit++) {
      state = applyBobs27Dart(config, state, hitObservationFor(state));
      state = applyBobs27Dart(config, state, hitObservationFor(state));
      state = applyBobs27Dart(config, state, hitObservationFor(state));
    }
    expect(state.status).toBe("WON");
    expect(state.score).toBe(1437);
  });

  it("loses when a full-miss on the bull visit drops the score to 0 or below, even though it is the final visit", () => {
    const bullState: Bobs27SeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      score: 50,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    let state = applyBobs27Dart(
      config,
      bullState,
      missObservationFor(bullState),
    );
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(0);
    expect(state.status).toBe("LOST");
  });

  it("wins when a full-miss on the bull visit leaves the score positive", () => {
    const bullState: Bobs27SeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      score: 100,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
    let state = applyBobs27Dart(
      config,
      bullState,
      missObservationFor(bullState),
    );
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(50);
    expect(state.status).toBe("WON");
  });

  it("throws when called on a state that already has a WON or LOST status", () => {
    const wonState: Bobs27SeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      score: 10,
      dartsThisVisit: [],
      status: "WON",
    };
    expect(() =>
      applyBobs27Dart(config, wonState, hitObservationFor(wonState)),
    ).toThrow();
  });
});

describe("Bobs27Engine", () => {
  it("starts at score 27 on target D1, in progress", () => {
    const engine = new Bobs27Engine(config);
    expect(engine.state().seats[0].score).toBe(27);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("delegates record to the reducer and exposes updated state via state()", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].score).toBe(29);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].score).toBe(33);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
  });

  it("reports isComplete and status once the game ends", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].status).toBe("LOST");
  });

  it("wins after a full-hit run through the entire path", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0]));
      engine.record(hitObservationFor(engine.state().seats[0]));
      engine.record(hitObservationFor(engine.state().seats[0]));
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().seats[0].status).toBe("WON");
    expect(engine.state().seats[0].score).toBe(1437);
  });

  it("accepts a custom starting score", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 100 });
    expect(engine.state().seats[0].score).toBe(100);
  });

  it("clears dartsThisVisit when the visit resolves", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    const resolved = engine.record(missObservationFor(engine.state().seats[0]));

    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
    expect(resolved.seats[0].dartsThisVisit).toEqual([]);
  });
});

describe("Bobs27Engine.wouldComplete", () => {
  it("is false for the 1st and 2nd dart of a visit, regardless of outcome", () => {
    const engine = new Bobs27Engine(config);
    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(false);
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("is true for the 3rd dart when a full miss would drop the score to 0 or below", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(true);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is false for the 3rd dart when the visit resolves but the game continues", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("is true for the 3rd dart on BULL when the run completes the path", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0]));
      engine.record(hitObservationFor(engine.state().seats[0]));
      engine.record(hitObservationFor(engine.state().seats[0]));
    }
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(true);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");
  });

  it("is false once the game has already ended", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].status).toBe("LOST");
    expect(
      engine.wouldComplete(hitObservationFor(engine.state().seats[0])),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(
      engine.wouldComplete(missObservationFor(engine.state().seats[0])),
    ).toBe(false);

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("Bobs27Engine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new Bobs27Engine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() when it opened a new turn", () => {
    const engine = new Bobs27Engine(config);
    const before = engine.facts();
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    const before = engine.facts();
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it closed the open turn", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    const before = engine.facts();

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.facts().turns[0].completedAt).not.toBeNull();

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("does not push a phantom dart when record is rejected on a finished game", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state().seats[0]));
      engine.record(hitObservationFor(engine.state().seats[0]));
      engine.record(hitObservationFor(engine.state().seats[0]));
    }
    expect(engine.state().seats[0].status).toBe("WON");
    expect(engine.state().seats[0].score).toBe(1437);

    expect(() =>
      engine.record(hitObservationFor(engine.state().seats[0])),
    ).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].score).toBe(1387);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].score).toBe(1337);
  });

  it("reverts a single hit", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].score).toBe(27);
  });

  it("reverts the 3rd dart of a full-miss visit, restoring the penalty and the target", () => {
    const engine = new Bobs27Engine(config);
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].score).toBe(25);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].score).toBe(27);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);

    const afterRestoredDart = engine.record(
      missObservationFor(engine.state().seats[0]),
    );
    expect(afterRestoredDart.seats[0].dartsThisVisit).toEqual([]);
    expect(engine.state().seats[0].score).toBe(25);
  });

  it("reverts a game-ending dart, allowing play to continue afterward", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    engine.record(missObservationFor(engine.state().seats[0]));
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].score).toBe(1);

    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].score).toBe(3);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    engine.record(hitObservationFor(engine.state().seats[0]));
    expect(engine.state().seats[0].score).toBe(37);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().seats[0].score).toBe(27);
    expect(
      targetAt(doublesPath(), engine.state().seats[0].targetIndex),
    ).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = bobs27EngineFactory.create(config);
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    first.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const resumed = bobs27EngineFactory.create(config, first.facts());
    resumed.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(resumed.state().seats[0].score).toBe(33);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().seats[0].score).toBe(31);
  });
});

describe("Bobs27Engine — 1v1", () => {
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
  const twoSeatConfig: Seated<Bobs27Snapshot> = {
    startScore: 27,
    bullHitValue: 50,
    missPenaltyMultiplier: 1,
    seats: twoSeats,
  };

  function missDart(): DartObservation {
    return {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
  }

  it("alternates the active seat visit by visit", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    expect(engine.state().activeParticipantRef).toBe("p1");
    engine.record(missDart());
    engine.record(missDart());
    engine.record(missDart());
    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("ends the match the instant one seat busts to zero or below, the other seat wins", () => {
    // startScore 27, D1's value is boardScore(1, "DOUBLE") * missPenaltyMultiplier
    // = 2 * 1 = 2 per missed visit; a miss never advances targetIndex, so
    // every visit for both seats keeps missing D1. Seats strictly alternate
    // (activeSeat has no completion predicate for Bob's 27 — the match ends
    // before it would matter), so after each seat's Nth own visit both are
    // tied at 27 - 2N. p1 (seat 0) throws its own Nth visit first each round
    // and crosses zero at N = 14 (27 - 28 = -1), one visit before p2 would.
    const engine = new Bobs27Engine(twoSeatConfig);
    let state = engine.state();
    while (state.status === "IN_PROGRESS") {
      engine.record(missDart());
      engine.record(missDart());
      engine.record(missDart());
      state = engine.state();
    }
    expect(state.seats[0].status).toBe("LOST");
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    engine.record(missDart());
    engine.record(missDart());
    engine.record(missDart());
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(
        twoSeats.some((seat) => seat.participantRef === turn.participantRef),
      ).toBe(true);
    }
  });

  it("undo across a match-ending dart un-ends the match", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    let state = engine.state();
    while (state.status === "IN_PROGRESS") {
      engine.record(missDart());
      state = engine.state();
    }
    engine.undo();
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().winningSideKey).toBeNull();
  });

  it("rejects recording another dart for the surviving seat once the match has completed", () => {
    const engine = new Bobs27Engine(twoSeatConfig);
    let state = engine.state();
    while (state.status === "IN_PROGRESS") {
      engine.record(missDart());
      state = engine.state();
    }
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
    expect(state.activeParticipantRef).toBe("p2");

    expect(() => engine.record(missDart())).toThrow(/ended/);

    const after = engine.state();
    expect(after.status).toBe("COMPLETE");
    expect(after.winningSideKey).toBe("B");
  });

  it("wouldComplete is false for the surviving seat's resolving dart once the match has completed", () => {
    // Facts constructed directly (bypassing record()) so the scenario holds
    // regardless of record()'s own guard: p1 has already busted its opening
    // visit (match COMPLETE, B wins) while p2 sits on a 2-dart open visit
    // whose 3rd miss would, taken in isolation, also bust p2 — the exact
    // shape that must NOT read as "would complete the game" once the match
    // is already decided.
    const bustConfig: Seated<Bobs27Snapshot> = {
      ...twoSeatConfig,
      startScore: 1,
    };
    const missDartFact = (sequence: number) => ({
      sequence,
      intendedTargetNumber: 1,
      intendedZoneKey: "DOUBLE" as const,
      hitTargetNumber: 1,
      hitZoneKey: "MISS" as const,
      score: 0,
      locationX: null,
      locationY: null,
    });
    const prior: EngineFacts = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [
        {
          clientKey: "t1",
          stageClientKey: "block-1",
          participantRef: "p1",
          sequence: 1,
          completedAt: "2026-08-22T00:00:00.000Z",
          totalScore: 0,
          darts: [missDartFact(1), missDartFact(2), missDartFact(3)],
        },
        {
          clientKey: "t2",
          stageClientKey: "block-1",
          participantRef: "p2",
          sequence: 2,
          completedAt: null,
          totalScore: 0,
          darts: [missDartFact(1), missDartFact(2)],
        },
      ],
    };

    const engine = new Bobs27Engine(bustConfig, prior);
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B");
    expect(state.activeParticipantRef).toBe("p2");
    expect(state.seats.find((seat) => seat.sideKey === "B")!.status).toBe(
      "IN_PROGRESS",
    );

    expect(engine.wouldComplete(missDart())).toBe(false);
  });
});
