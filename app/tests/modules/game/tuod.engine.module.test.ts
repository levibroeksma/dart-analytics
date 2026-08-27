import { describe, it, expect } from "vitest";
import {
  applyTuodAttempt,
  initialTuodState,
  TuodEngine,
  tuodEngineFactory,
} from "@modules/game/tuod.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { GameEngine } from "@modules/interfaces";
import type { TuodAttemptInput, TuodState } from "@modules/types";
import type { TuodSnapshot, Seated } from "@lib/types";

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
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "ROUNDS",
    durationValue: 10,
    maxDartsPerTurn: 3,
    seats: SEATS,
  }) satisfies Seated<TuodSnapshot>;

const minutesConfig = () =>
  ({
    ...config(),
    durationType: "MINUTES",
    durationValue: 10,
  }) satisfies Seated<TuodSnapshot>;

type TuodGameEngine = GameEngine<TuodAttemptInput, TuodState>;

const CHECKOUT: TuodAttemptInput = {
  checkedOut: true,
  dartsUsed: 3,
  finishedOnDouble: true,
};

const MISS: TuodAttemptInput = { checkedOut: false, dartsUsed: 3 };

/** A bust is reported exactly as any other failed attempt: no checkout. */
const BUST: TuodAttemptInput = { checkedOut: false, dartsUsed: 2 };

function playAttempts(
  engine: TuodGameEngine,
  inputs: readonly TuodAttemptInput[],
): TuodState {
  let state = engine.state();
  for (const input of inputs) {
    state = engine.record(input);
  }
  return state;
}

describe("tuodEngineFactory", () => {
  it("registers itself under TUOD_V1", () => {
    expect(tuodEngineFactory.rulesetVersionKey).toBe("TUOD_V1");
    expect(getEngineFactory("TUOD_V1")).toBe(tuodEngineFactory);
  });

  it("builds a TuodEngine bound to the ruleset version", () => {
    const engine = tuodEngineFactory.create(config());
    expect(engine).toBeInstanceOf(TuodEngine);
    expect(engine.rulesetVersionKey).toBe("TUOD_V1");
  });
});

describe("initialTuodState", () => {
  it("starts on the configured target with nothing attempted", () => {
    expect(initialTuodState(config())).toEqual({
      activeParticipantRef: SEATS[0].participantRef,
      status: "IN_PROGRESS",
      winningSideKey: null,
      timerExpired: false,
      seats: [
        {
          participantRef: SEATS[0].participantRef,
          sideKey: SEATS[0].sideKey,
          currentTarget: 41,
          attempts: 0,
          successes: 0,
          failures: 0,
        },
      ],
    });
  });

  it("honours a non-default starting target", () => {
    expect(
      initialTuodState({ ...config(), startingTarget: 61 }).seats[0]
        .currentTarget,
    ).toBe(61);
  });
});

describe("applyTuodAttempt", () => {
  it("climbs by the finish bonus on a success", () => {
    const next = applyTuodAttempt(
      config(),
      initialTuodState(config()).seats[0],
      true,
    );
    expect(next.currentTarget).toBe(51);
    expect(next.successes).toBe(1);
    expect(next.failures).toBe(0);
    expect(next.attempts).toBe(1);
  });

  it("drops by the miss penalty on a failure", () => {
    const next = applyTuodAttempt(
      config(),
      initialTuodState(config()).seats[0],
      false,
    );
    expect(next.currentTarget).toBe(40);
    expect(next.successes).toBe(0);
    expect(next.failures).toBe(1);
    expect(next.attempts).toBe(1);
  });

  it("does not mutate the state it folds", () => {
    const before = initialTuodState(config()).seats[0];
    applyTuodAttempt(config(), before, true);
    expect(before).toEqual(initialTuodState(config()).seats[0]);
  });

  it("floors a failure at the double-out minimum instead of dropping below it", () => {
    const near = { ...initialTuodState(config()).seats[0], currentTarget: 3 };
    expect(applyTuodAttempt(config(), near, false).currentTarget).toBe(2);
  });

  it("keeps a failure at the floor once the target is already there", () => {
    const atFloor = {
      ...initialTuodState(config()).seats[0],
      currentTarget: 2,
    };
    expect(applyTuodAttempt(config(), atFloor, false).currentTarget).toBe(2);
  });

  it("still climbs by the finish bonus from the floor on a success", () => {
    const atFloor = {
      ...initialTuodState(config()).seats[0],
      currentTarget: 2,
    };
    expect(applyTuodAttempt(config(), atFloor, true).currentTarget).toBe(12);
  });
});

describe("TuodEngine.record — outcomes", () => {
  it("records a checkout as the target just attempted and climbs", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(CHECKOUT);

    expect(state.seats[0].currentTarget).toBe(51);
    expect(engine.facts().turns[0].totalScore).toBe(41);
  });

  it("records a miss as a zero-scoring turn and drops", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(MISS);

    expect(state.seats[0].currentTarget).toBe(40);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("counts a bust as a failed attempt, applying the same −1", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(BUST);

    expect(state.seats[0].currentTarget).toBe(40);
    expect(state.seats[0].failures).toBe(1);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("treats a checkout not finished on a double as a failed attempt", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record({ checkedOut: true, dartsUsed: 3 });

    expect(state.seats[0].currentTarget).toBe(40);
    expect(state.seats[0].successes).toBe(0);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("treats a checkout explicitly not on a double as a failed attempt", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record({
      checkedOut: true,
      dartsUsed: 3,
      finishedOnDouble: false,
    });

    expect(state.seats[0].currentTarget).toBe(40);
    expect(state.seats[0].successes).toBe(0);
  });

  it("rejects an attempt using more darts than the ruleset allows", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      maxDartsPerTurn: 2,
    });
    expect(() => engine.record(CHECKOUT)).toThrow();
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("refuses to record once the session is complete", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 1 });
    engine.record(MISS);

    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(MISS)).toThrow();
    expect(engine.facts().turns).toHaveLength(1);
  });
});

describe("TuodEngine — ladder floor", () => {
  const floorConfig = () =>
    ({
      ...config(),
      startingTarget: 3,
      durationValue: 50,
    }) satisfies Seated<TuodSnapshot>;

  it("floors a miss at target 3 to 2", () => {
    const engine = tuodEngineFactory.create(floorConfig());
    const state = engine.record(MISS);
    expect(state.seats[0].currentTarget).toBe(2);
  });

  it("keeps a miss at target 2 at 2", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      startingTarget: 2,
      durationValue: 50,
    });
    const state = engine.record(MISS);
    expect(state.seats[0].currentTarget).toBe(2);
  });

  it("stays at 2 through repeated misses at the floor", () => {
    const engine = tuodEngineFactory.create(floorConfig());
    const state = playAttempts(engine, [MISS, MISS, MISS, MISS, MISS]);

    expect(state.seats[0].currentTarget).toBe(2);
    expect(state.seats[0].failures).toBe(5);
  });

  it("still climbs by the finish bonus on a successful checkout at 2", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      startingTarget: 2,
    });
    const state = engine.record(CHECKOUT);

    expect(state.seats[0].currentTarget).toBe(12);
    expect(engine.facts().turns[0].totalScore).toBe(2);
  });

  it("rehydrates the same floored target a live session derived", () => {
    const played = tuodEngineFactory.create(floorConfig());
    playAttempts(played, [MISS, MISS, MISS, CHECKOUT, MISS]);

    const rehydrated = tuodEngineFactory.create(floorConfig(), played.facts());

    expect(rehydrated.state()).toEqual(played.state());
    expect(rehydrated.facts()).toEqual(played.facts());
  });
});

describe("TuodEngine.state — derived by folding facts", () => {
  it("folds a mixed ladder rather than accumulating it", () => {
    const engine = tuodEngineFactory.create(config());
    const state = playAttempts(engine, [CHECKOUT, CHECKOUT, MISS, BUST]);

    expect(state).toEqual({
      activeParticipantRef: SEATS[0].participantRef,
      status: "IN_PROGRESS",
      winningSideKey: null,
      timerExpired: false,
      seats: [
        {
          participantRef: SEATS[0].participantRef,
          sideKey: SEATS[0].sideKey,
          currentTarget: 59,
          attempts: 4,
          successes: 2,
          failures: 2,
        },
      ],
    });
  });

  it("returns a fresh object every call", () => {
    const engine = tuodEngineFactory.create(config());
    engine.record(CHECKOUT);

    expect(engine.state()).not.toBe(engine.state());
    expect(engine.state()).toEqual(engine.state());
  });

  it("rehydrates the whole ladder from persisted facts", () => {
    const played = tuodEngineFactory.create(config());
    playAttempts(played, [CHECKOUT, MISS, CHECKOUT]);

    const rehydrated = tuodEngineFactory.create(config(), played.facts());

    expect(rehydrated.state()).toEqual(played.state());
    expect(rehydrated.facts()).toEqual(played.facts());
  });
});

describe("TuodEngine.facts", () => {
  it("carries one EXERCISE_BLOCK stage and no dart rows", () => {
    const engine = tuodEngineFactory.create(config());
    playAttempts(engine, [CHECKOUT, MISS]);
    const facts = engine.facts();

    expect(facts.stages).toHaveLength(1);
    expect(facts.stages[0].stageTypeKey).toBe("EXERCISE_BLOCK");
    expect(facts.stages[0].parentClientKey).toBeNull();
    for (const turn of facts.turns) {
      expect(turn.darts).toHaveLength(0);
      expect(turn.stageClientKey).toBe(facts.stages[0].clientKey);
    }
  });

  it("stamps completedAt and numbers turns from one", () => {
    const engine = tuodEngineFactory.create(config());
    playAttempts(engine, [CHECKOUT, MISS]);

    expect(engine.facts().turns.map((turn) => turn.sequence)).toEqual([1, 2]);
    for (const turn of engine.facts().turns) {
      expect(turn.completedAt).not.toBeNull();
      expect(turn.clientKey).not.toBe("");
    }
  });

  it("hands out stage records the caller cannot write through", () => {
    const engine = tuodEngineFactory.create(config());
    engine.record(MISS);

    const first = engine.facts().stages[0];
    const second = engine.facts().stages[0];
    expect(second).not.toBe(first);

    first.clientKey = "hijacked";
    expect(engine.facts().stages[0]).toEqual(second);
  });
});

describe("TuodEngine.undo — exact inverse of record", () => {
  it("restores facts() byte for byte, ladder position included", () => {
    const engine = tuodEngineFactory.create(config());
    playAttempts(engine, [CHECKOUT, MISS]);

    const beforeFacts = engine.facts();
    const beforeState = engine.state();

    engine.record(CHECKOUT);
    expect(engine.undo()).toBe(true);

    expect(engine.facts()).toEqual(beforeFacts);
    expect(engine.state()).toEqual(beforeState);
  });

  it("inverts a failure just as exactly as a success", () => {
    const engine = tuodEngineFactory.create(config());
    engine.record(CHECKOUT);

    const beforeFacts = engine.facts();
    engine.record(BUST);
    engine.undo();

    expect(engine.facts()).toEqual(beforeFacts);
    expect(engine.state().seats[0].currentTarget).toBe(51);
  });

  it("undoes back through rehydrated facts to an empty log", () => {
    const played = tuodEngineFactory.create(config());
    playAttempts(played, [CHECKOUT, MISS, CHECKOUT]);

    const engine = tuodEngineFactory.create(config(), played.facts());
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(false);

    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state()).toEqual(initialTuodState(config()));
  });

  it("undoes a miss clamped at the floor back to the exact prior state", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      startingTarget: 3,
      durationValue: 50,
    });
    engine.record(MISS);

    const beforeFacts = engine.facts();
    const beforeState = engine.state();
    expect(beforeState.seats[0].currentTarget).toBe(2);

    engine.record(MISS);
    expect(engine.state().seats[0].currentTarget).toBe(2);
    expect(engine.undo()).toBe(true);

    expect(engine.facts()).toEqual(beforeFacts);
    expect(engine.state()).toEqual(beforeState);
  });
});

describe("TuodEngine.wouldComplete — pure", () => {
  it("leaves facts() unchanged", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 2 });
    engine.record(MISS);

    const before = engine.facts();
    engine.wouldComplete(CHECKOUT);
    engine.wouldComplete(MISS);

    expect(engine.facts()).toEqual(before);
    expect(engine.facts().turns).toHaveLength(1);
  });

  it("does not change the ladder when probing a miss already at the floor", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      startingTarget: 2,
      durationValue: 50,
    });
    engine.record(MISS);

    const before = engine.state();
    engine.wouldComplete(MISS);

    expect(engine.state()).toEqual(before);
    expect(before.seats[0].currentTarget).toBe(2);
  });

  it("is true for the attempt that reaches the configured round count", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 2 });
    expect(engine.wouldComplete(MISS)).toBe(false);

    engine.record(MISS);
    expect(engine.wouldComplete(MISS)).toBe(true);
  });

  it("is false for an attempt record() would reject", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      durationValue: 1,
      maxDartsPerTurn: 2,
    });
    expect(engine.wouldComplete(CHECKOUT)).toBe(false);
  });

  it("is false once the session is already complete", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 1 });
    engine.record(MISS);
    expect(engine.wouldComplete(MISS)).toBe(false);
  });
});

describe("TuodEngine completion", () => {
  it("ends a ROUNDS session after the configured attempt count", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 3 });
    engine.record(MISS);
    engine.record(MISS);
    expect(engine.isComplete()).toBe(false);

    engine.record(CHECKOUT);
    expect(engine.isComplete()).toBe(true);
  });

  it("ends a MINUTES session only once the timer is explicitly expired", () => {
    const engine = new TuodEngine(minutesConfig());
    engine.record(MISS);
    expect(engine.isComplete()).toBe(false);

    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().timerExpired).toBe(true);
  });

  it("does not end a MINUTES session whose timer expired before any attempt", () => {
    const engine = new TuodEngine(minutesConfig());
    engine.expireTimer();
    expect(engine.isComplete()).toBe(false);
  });
});

describe("TUOD checkout dart counts", () => {
  it("rejects a checkout claiming fewer darts than the target's route needs", () => {
    const engine = tuodEngineFactory.create(config());
    expect(() =>
      engine.record({
        checkedOut: true,
        finishedOnDouble: true,
        dartsUsed: 1,
      }),
    ).toThrow(/at least 2 darts/);
  });

  it("rejects more darts at a double than the attempt used", () => {
    const engine = tuodEngineFactory.create(config());
    expect(() =>
      engine.record({
        checkedOut: true,
        finishedOnDouble: true,
        dartsUsed: 2,
        dartsAtDouble: 3,
      }),
    ).toThrow(/at a double/);
  });

  it("rejects more darts than the ruleset allows", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      maxDartsPerTurn: 2,
    });
    expect(() =>
      engine.record({
        checkedOut: true,
        finishedOnDouble: true,
        dartsUsed: 3,
      }),
    ).toThrow(/at most 2 darts/);
  });

  it("leaves the fact log untouched when a claim is rejected", () => {
    const engine = tuodEngineFactory.create(config());
    expect(() =>
      engine.record({
        checkedOut: true,
        finishedOnDouble: true,
        dartsUsed: 1,
      }),
    ).toThrow();
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("checks the counts against the target the attempt is thrown at", () => {
    const engine = tuodEngineFactory.create(config());
    engine.record(CHECKOUT);
    expect(engine.state().seats[0].currentTarget).toBe(51);
    expect(() =>
      engine.record({
        checkedOut: true,
        finishedOnDouble: true,
        dartsUsed: 1,
      }),
    ).toThrow(/Checking out 51/);
  });

  it("never checks the counts on a failed attempt", () => {
    const engine = tuodEngineFactory.create(config());
    expect(() =>
      engine.record({ checkedOut: false, dartsUsed: 1 }),
    ).not.toThrow();
  });
});

import type { DartObservation } from "@modules/types";

const boardConfig = () =>
  ({ ...config(), startingTarget: 40 }) satisfies Seated<TuodSnapshot>;

/** D20 — 20 doubled, the board's own coordinate for it (see one-twenty-one.engine.module.test.ts). */
const DOUBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  locationX: 0,
  locationY: -166,
};

/** T20 — 60, an overshoot against a target of 40. */
const TREBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

/** S1 — 1, leaves 39 remaining: neither a bust nor a finish, just a thrown dart. */
const SINGLE_1: DartObservation = {
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  locationX: 15,
  locationY: -46,
};

/** An unseen dart: no coordinate, scores 0, changes nothing. */
const UNSEEN: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

describe("TuodEngine.record — dart-by-dart (VISUAL_BOARD)", () => {
  it("checks out on a single dart landing exactly on the target's double", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    const state = engine.record(DOUBLE_20);

    expect(state.seats[0].currentTarget).toBe(50);
    expect(state.seats[0].successes).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(40);
    expect(turn.completedAt).not.toBeNull();
    expect(turn.darts).toHaveLength(1);
    expect(turn.darts[0]).toMatchObject({
      hitZoneKey: "DOUBLE",
      hitTargetNumber: 20,
      score: 40,
      locationX: 0,
      locationY: -166,
    });
  });

  it("busts on a single dart that overshoots the target", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    const state = engine.record(TREBLE_20);

    expect(state.seats[0].currentTarget).toBe(39);
    expect(state.seats[0].failures).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(0);
    expect(turn.darts[0].score).toBe(60);
  });

  it("builds a visit dart-by-dart across multiple record() calls, closing on checkout", () => {
    // Uses the default config() (startingTarget 41, odd) rather than
    // boardConfig() (40, even): a SINGLE_1 (odd) followed by a DOUBLE_20
    // (even) can only reach exactly 0 remaining from an odd target — 41 - 1
    // - 40 = 0 — since a single double dart always contributes an even
    // score.
    const engine = tuodEngineFactory.create(config());
    engine.record(SINGLE_1);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();

    const state = engine.record(DOUBLE_20);
    expect(state.seats[0].currentTarget).toBe(51);
    const turn = engine.facts().turns[0];
    expect(turn.completedAt).not.toBeNull();
    expect(turn.darts).toHaveLength(2);
    expect(turn.totalScore).toBe(41);
  });

  it("records a miss when the visit runs out of darts without checking out", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    engine.record(SINGLE_1);
    const state = engine.record(SINGLE_1);

    expect(state.seats[0].currentTarget).toBe(39);
    expect(state.seats[0].failures).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.totalScore).toBe(0);
    expect(turn.darts).toHaveLength(3);
  });

  it("busts immediately after dart 2 when the remainder is odd — no double can ever finish it, so dart 3 is never thrown", () => {
    // Default config() (startingTarget 41, odd): two SINGLE_1 darts leave a
    // 39 remainder, which is odd — no double scores an odd number, so the
    // visit is unfinishable with the one dart left and must close right away
    // instead of waiting for a third dart.
    const engine = tuodEngineFactory.create(config());
    engine.record(SINGLE_1);
    const state = engine.record(SINGLE_1);

    expect(state.seats[0].currentTarget).toBe(40);
    expect(state.seats[0].failures).toBe(1);
    const turn = engine.facts().turns[0];
    expect(turn.completedAt).not.toBeNull();
    expect(turn.totalScore).toBe(0);
    expect(turn.darts).toHaveLength(2);
  });

  it("does not bust early after dart 1 on an odd remainder — two darts still remain", () => {
    const engine = tuodEngineFactory.create(config());
    engine.record(SINGLE_1);

    const turn = engine.facts().turns[0];
    expect(turn.completedAt).toBeNull();
    expect(turn.darts).toHaveLength(1);
  });

  it("records an unseen dart as a scoreless, real dart row", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(UNSEEN);

    const turn = engine.facts().turns[0];
    expect(turn.darts[0]).toMatchObject({
      hitZoneKey: "MISS",
      hitTargetNumber: null,
      score: 0,
      locationX: null,
      locationY: null,
    });
  });

  it("refuses a keypad total while a board visit is open", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    expect(() => engine.record(MISS)).toThrow(/open (visit|attempt)/);
  });

  it("refuses to record a dart once the session is complete", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    engine.record(DOUBLE_20);
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(DOUBLE_20)).toThrow();
  });
});

describe("TuodEngine.undo — dart-shaped turns", () => {
  it("pops one dart, reopening the visit, without discarding the whole attempt", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);
    engine.record(DOUBLE_20);

    expect(engine.undo()).toBe(true);
    const turn = engine.facts().turns[0];
    expect(turn.darts).toHaveLength(1);
    expect(turn.completedAt).toBeNull();
    expect(turn.totalScore).toBe(1);
  });

  it("pops the whole turn once its last dart is undone", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(SINGLE_1);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("restores facts() byte for byte after recording and undoing a dart", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    engine.record(DOUBLE_20);

    const beforeFacts = engine.facts();
    const beforeState = engine.state();

    engine.record(SINGLE_1);
    expect(engine.undo()).toBe(true);

    expect(engine.facts()).toEqual(beforeFacts);
    expect(engine.state()).toEqual(beforeState);
  });
});

describe("TuodEngine.wouldComplete — dart path, pure", () => {
  it("is true for a dart that checks out the last permitted attempt", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    expect(engine.wouldComplete(DOUBLE_20)).toBe(true);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("is true for a dart that busts the last permitted attempt", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    expect(engine.wouldComplete(TREBLE_20)).toBe(true);
  });

  it("is false for a dart that neither resolves the visit nor is the last permitted attempt", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 2,
    });
    expect(engine.wouldComplete(SINGLE_1)).toBe(false);
  });

  it("is true for the 3rd dart of the last permitted attempt even without a checkout", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    engine.record(SINGLE_1);
    engine.record(SINGLE_1);
    expect(engine.wouldComplete(SINGLE_1)).toBe(true);
  });

  it("is true for the 2nd dart of the last permitted attempt when it leaves an unfinishable odd remainder", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 1 });
    engine.record(SINGLE_1);
    expect(engine.wouldComplete(SINGLE_1)).toBe(true);
  });

  it("does not mutate the fact log", () => {
    const engine = tuodEngineFactory.create({
      ...boardConfig(),
      durationValue: 1,
    });
    const before = engine.facts();
    engine.wouldComplete(DOUBLE_20);
    expect(engine.facts()).toEqual(before);
  });
});

describe("TuodEngine — 1v1", () => {
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
  const twoSeatConfig: Seated<TuodSnapshot> = {
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    maxDartsPerTurn: 3,
    durationType: "ROUNDS",
    durationValue: 2,
    seats: twoSeats,
  };

  it("both seats always play out their own full ROUNDS budget before the match resolves", () => {
    const engine = new TuodEngine(twoSeatConfig);
    engine.record({ checkedOut: false }); // p1 round 1: fail
    engine.record({ checkedOut: false }); // p2 round 1: fail
    let state = engine.state();
    expect(state.status).toBe("IN_PROGRESS");
    engine.record({ checkedOut: false }); // p1 round 2: fail
    state = engine.state();
    expect(state.status).toBe("IN_PROGRESS"); // p2 still has a round left
    state = engine.record({ checkedOut: true, finishedOnDouble: true }); // p2 round 2: success, climbs to 51
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("B"); // p2's 51 beats p1's 40 (41 - 1)
  });

  it("hands the last round to the seat that still has one, its completion predicate agreeing with lockstep alternation", () => {
    const engine = new TuodEngine(twoSeatConfig);
    engine.record({ checkedOut: false }); // p1 round 1
    engine.record({ checkedOut: false }); // p2 round 1
    engine.record({ checkedOut: false }); // p1 round 2 — p1's budget is now spent

    expect(engine.state().activeParticipantRef).toBe("p2");
  });

  it("stamps every turn's participantRef with a seat present in seats[]", () => {
    const engine = new TuodEngine(twoSeatConfig);
    engine.record({ checkedOut: false });
    engine.record({ checkedOut: false });
    const facts = engine.facts();
    for (const turn of facts.turns) {
      expect(
        twoSeats.some((seat) => seat.participantRef === turn.participantRef),
      ).toBe(true);
    }
  });
});

describe("TUOD mixed-input undo", () => {
  it("pops a whole keypad attempt as one unit", () => {
    const engine = new TuodEngine(config());
    engine.record(CHECKOUT);
    engine.record(CHECKOUT);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toEqual([]);
    expect(engine.undo()).toBe(false);
  });

  it("pops a board attempt one dart at a time, reopening it", () => {
    const engine = new TuodEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(engine.facts().turns[0].darts).toHaveLength(2);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
    expect(engine.facts().turns[0].completedAt).toBeNull();
  });

  it("refuses a keypad attempt while a board attempt is still open", () => {
    const engine = new TuodEngine(config());
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(() => engine.record(CHECKOUT)).toThrow(/Finish the open attempt/);
  });
});

describe("TuodEngine final-dart odd-remainder early bust", () => {
  it("busts on the visit's 2nd dart when only an odd remainder is left with one dart to go", () => {
    const engine = tuodEngineFactory.create(config());

    engine.record(SINGLE_1);
    const state = engine.record(SINGLE_1);

    expect(state.seats[0].failures).toBe(1);
  });
});
