import { describe, it, expect } from "vitest";
import {
  applyBobs27Dart,
  Bobs27Engine,
  bobs27EngineFactory,
  initialBobs27State,
} from "@modules/game/bobs27.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { Bobs27State, DartObservation } from "@modules/types";
import type { Bobs27Snapshot } from "@lib/types";

const config: Bobs27Snapshot = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
};

function hitObservationFor(state: Bobs27State): DartObservation {
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

function missObservationFor(state: Bobs27State): DartObservation {
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
    expect(initialBobs27State(config)).toEqual({
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

    expect(engine.state().score).toBe(29);
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

    expect(engine.state().score).toBe(25);
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
    expect(resumed.state().score).toBe(33);
    expect(resumed.state().targetIndex).toBe(1);
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

    expect(engine.state().status).toBe("LOST");
    expect(engine.isComplete()).toBe(true);
  });
});

describe("Bobs27Engine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));

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
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));

    const [first, second] = engine.facts().turns;
    expect(first.clientKey).not.toBe(second.clientKey);
    expect(first.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("leaves completedAt null until the visit's 3rd dart resolves it", () => {
    const engine = new Bobs27Engine(config);

    engine.record(hitObservationFor(engine.state()));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state()));
    expect(engine.facts().turns[0].completedAt).toBeNull();

    engine.record(hitObservationFor(engine.state()));
    expect(engine.facts().turns[0].completedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T.*Z$/,
    );
  });

  it("numbers darts 1..3 within a turn and turns incrementing across visits", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));

    const [firstTurn, secondTurn] = engine.facts().turns;
    expect(firstTurn.sequence).toBe(1);
    expect(firstTurn.darts.map((dart) => dart.sequence)).toEqual([1, 2, 3]);
    expect(secondTurn.sequence).toBe(2);
    expect(secondTurn.darts.map((dart) => dart.sequence)).toEqual([1]);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));

    engine.facts().turns[0].darts.push(engine.facts().turns[0].darts[0]);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
  });
});

describe("applyBobs27Dart — hit scoring", () => {
  it("adds the target's value immediately on a single hit and keeps the same target", () => {
    const state = initialBobs27State(config);
    const next = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(next.score).toBe(29);
    expect(next.targetIndex).toBe(0);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("adds each hit as it happens across a 3-hit visit, then advances the target", () => {
    let state = initialBobs27State(config);
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
    let state = initialBobs27State(config);
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, hitObservationFor(state));
    expect(state.score).toBe(31);
    expect(state.targetIndex).toBe(1);
  });
});

describe("applyBobs27Dart — full-miss penalty", () => {
  it("does not change the score until the 3rd dart resolves a full-miss visit", () => {
    let state = initialBobs27State(config);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(27);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(27);
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(25);
    expect(state.targetIndex).toBe(1);
  });

  it("drives the score to exactly 0 and ends the game as LOST", () => {
    let state = initialBobs27State({ ...config, startScore: 2 });
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    state = applyBobs27Dart(config, state, missObservationFor(state));
    expect(state.score).toBe(0);
    expect(state.status).toBe("LOST");
  });
});

describe("applyBobs27Dart — path completion and win/loss", () => {
  it("wins after a full-hit run through the entire path", () => {
    let state = initialBobs27State(config);
    for (let visit = 0; visit < 21; visit++) {
      state = applyBobs27Dart(config, state, hitObservationFor(state));
      state = applyBobs27Dart(config, state, hitObservationFor(state));
      state = applyBobs27Dart(config, state, hitObservationFor(state));
    }
    expect(state.status).toBe("WON");
    expect(state.score).toBe(1437);
  });

  it("loses when a full-miss on the bull visit drops the score to 0 or below, even though it is the final visit", () => {
    const bullState: Bobs27State = {
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
    const bullState: Bobs27State = {
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
    const wonState: Bobs27State = {
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
    expect(engine.state().score).toBe(27);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("delegates record to the reducer and exposes updated state via state()", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    expect(engine.state().score).toBe(29);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    expect(engine.state().score).toBe(33);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
  });

  it("reports isComplete and status once the game ends", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("LOST");
  });

  it("wins after a full-hit run through the entire path", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("WON");
    expect(engine.state().score).toBe(1437);
  });

  it("accepts a custom starting score", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 100 });
    expect(engine.state().score).toBe(100);
  });

  it("clears dartsThisVisit when the visit resolves", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    const resolved = engine.record(missObservationFor(engine.state()));

    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
    expect(resolved.dartsThisVisit).toEqual([]);
  });
});

describe("Bobs27Engine.wouldComplete", () => {
  it("is false for the 1st and 2nd dart of a visit, regardless of outcome", () => {
    const engine = new Bobs27Engine(config);
    expect(engine.wouldComplete(hitObservationFor(engine.state()))).toBe(false);
    engine.record(hitObservationFor(engine.state()));
    expect(engine.wouldComplete(missObservationFor(engine.state()))).toBe(
      false,
    );
  });

  it("is true for the 3rd dart when a full miss would drop the score to 0 or below", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.wouldComplete(missObservationFor(engine.state()))).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false for the 3rd dart when the visit resolves but the game continues", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.wouldComplete(missObservationFor(engine.state()))).toBe(
      false,
    );
  });

  it("is true for the 3rd dart on BULL when the run completes the path", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 20; visit++) {
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
    }
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    expect(engine.wouldComplete(hitObservationFor(engine.state()))).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false once the game has already ended", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.state().status).toBe("LOST");
    expect(engine.wouldComplete(hitObservationFor(engine.state()))).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    expect(engine.wouldComplete(missObservationFor(engine.state()))).toBe(
      false,
    );

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
    engine.record(hitObservationFor(engine.state()));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it extended the open turn", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    const before = engine.facts();
    engine.record(missObservationFor(engine.state()));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("is an exact inverse of record over facts() when it closed the open turn", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    const before = engine.facts();

    engine.record(hitObservationFor(engine.state()));
    expect(engine.facts().turns[0].completedAt).not.toBeNull();

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("does not push a phantom dart when record is rejected on a finished game", () => {
    const engine = new Bobs27Engine(config);
    for (let visit = 0; visit < 21; visit++) {
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
      engine.record(hitObservationFor(engine.state()));
    }
    expect(engine.state().status).toBe("WON");
    expect(engine.state().score).toBe(1437);

    expect(() => engine.record(hitObservationFor(engine.state()))).toThrow();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().score).toBe(1387);
    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(1337);
  });

  it("reverts a single hit", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(27);
  });

  it("reverts the 3rd dart of a full-miss visit, restoring the penalty and the target", () => {
    const engine = new Bobs27Engine(config);
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.state().score).toBe(25);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(27);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 1,
    });
    expect(engine.isComplete()).toBe(false);

    const afterRestoredDart = engine.record(missObservationFor(engine.state()));
    expect(afterRestoredDart.dartsThisVisit).toEqual([]);
    expect(engine.state().score).toBe(25);
  });

  it("reverts a game-ending dart, allowing play to continue afterward", () => {
    const engine = new Bobs27Engine({ ...config, startScore: 1 });
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    engine.record(missObservationFor(engine.state()));
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().score).toBe(1);

    engine.record(hitObservationFor(engine.state()));
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().score).toBe(3);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new Bobs27Engine(config);
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    engine.record(hitObservationFor(engine.state()));
    expect(engine.state().score).toBe(37);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
      kind: "DOUBLE",
      number: 2,
    });

    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().score).toBe(27);
    expect(targetAt(doublesPath(), engine.state().targetIndex)).toEqual({
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
    expect(resumed.state().score).toBe(33);

    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns[0].darts).toHaveLength(2);
    expect(resumed.state().score).toBe(31);
  });
});
