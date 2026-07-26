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
import type { TuodSnapshot } from "@lib/types";

const config = () =>
  ({
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "ROUNDS",
    durationValue: 10,
    maxDartsPerTurn: 3,
  }) satisfies TuodSnapshot;

const minutesConfig = () =>
  ({
    ...config(),
    durationType: "MINUTES",
    durationValue: 10,
  }) satisfies TuodSnapshot;

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
      currentTarget: 41,
      attempts: 0,
      successes: 0,
      failures: 0,
      timerExpired: false,
    });
  });

  it("honours a non-default starting target", () => {
    expect(
      initialTuodState({ ...config(), startingTarget: 61 }).currentTarget,
    ).toBe(61);
  });
});

describe("applyTuodAttempt", () => {
  it("climbs by the finish bonus on a success", () => {
    const next = applyTuodAttempt(config(), initialTuodState(config()), true);
    expect(next.currentTarget).toBe(51);
    expect(next.successes).toBe(1);
    expect(next.failures).toBe(0);
    expect(next.attempts).toBe(1);
  });

  it("drops by the miss penalty on a failure", () => {
    const next = applyTuodAttempt(config(), initialTuodState(config()), false);
    expect(next.currentTarget).toBe(40);
    expect(next.successes).toBe(0);
    expect(next.failures).toBe(1);
    expect(next.attempts).toBe(1);
  });

  it("does not mutate the state it folds", () => {
    const before = initialTuodState(config());
    applyTuodAttempt(config(), before, true);
    expect(before).toEqual(initialTuodState(config()));
  });

  it("rejects a success claimed on a target below the double-out minimum", () => {
    const stranded = { ...initialTuodState(config()), currentTarget: 1 };
    expect(() => applyTuodAttempt(config(), stranded, true)).toThrow();
  });

  it("lets the ladder keep falling below the double-out minimum on failures", () => {
    const stranded = { ...initialTuodState(config()), currentTarget: 1 };
    expect(applyTuodAttempt(config(), stranded, false).currentTarget).toBe(0);
  });
});

describe("TuodEngine.record — outcomes", () => {
  it("records a checkout as the target just attempted and climbs", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(CHECKOUT);

    expect(state.currentTarget).toBe(51);
    expect(engine.facts().turns[0].totalScore).toBe(41);
  });

  it("records a miss as a zero-scoring turn and drops", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(MISS);

    expect(state.currentTarget).toBe(40);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("counts a bust as a failed attempt, applying the same −1", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(BUST);

    expect(state.currentTarget).toBe(40);
    expect(state.failures).toBe(1);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("treats a checkout not finished on a double as a failed attempt", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record({ checkedOut: true, dartsUsed: 3 });

    expect(state.currentTarget).toBe(40);
    expect(state.successes).toBe(0);
    expect(engine.facts().turns[0].totalScore).toBe(0);
  });

  it("treats a checkout explicitly not on a double as a failed attempt", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record({
      checkedOut: true,
      dartsUsed: 3,
      finishedOnDouble: false,
    });

    expect(state.currentTarget).toBe(40);
    expect(state.successes).toBe(0);
  });

  it("rejects an attempt using more darts than the ruleset allows", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      maxDartsPerTurn: 2,
    });
    expect(() => engine.record(CHECKOUT)).toThrow();
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rejects a claimed checkout once the ladder is below the double-out minimum", () => {
    const engine = tuodEngineFactory.create({
      ...config(),
      startingTarget: 2,
      durationValue: 50,
    });
    engine.record(MISS);

    expect(engine.state().currentTarget).toBe(1);
    expect(() => engine.record(CHECKOUT)).toThrow();
    expect(engine.facts().turns).toHaveLength(1);
  });

  it("refuses to record once the session is complete", () => {
    const engine = tuodEngineFactory.create({ ...config(), durationValue: 1 });
    engine.record(MISS);

    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record(MISS)).toThrow();
    expect(engine.facts().turns).toHaveLength(1);
  });
});

describe("TuodEngine.state — derived by folding facts", () => {
  it("folds a mixed ladder rather than accumulating it", () => {
    const engine = tuodEngineFactory.create(config());
    const state = playAttempts(engine, [CHECKOUT, CHECKOUT, MISS, BUST]);

    expect(state).toEqual({
      currentTarget: 59,
      attempts: 4,
      successes: 2,
      failures: 2,
      timerExpired: false,
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
    expect(engine.state().currentTarget).toBe(51);
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
