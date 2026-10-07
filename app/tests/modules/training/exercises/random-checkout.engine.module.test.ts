import { describe, expect, it } from "vitest";
import {
  RANDOM_CHECKOUT_POOL,
  RandomCheckoutEngine,
  drawStartScore,
  foldRandomCheckoutState,
  randomCheckoutEngineFactory,
} from "@modules/training/exercises/random-checkout.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { RandomCheckoutConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const SEED = 774;
const CONFIG: RandomCheckoutConfigData = {
  minStart: 40,
  maxStart: 170,
  drawSeed: SEED,
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const S19 = dart(19, "SINGLE");
const S20 = dart(20, "SINGLE");
const T20 = dart(20, "TREBLE");
const D20 = dart(20, "DOUBLE");
const D10 = dart(10, "DOUBLE");
const D1 = dart(1, "DOUBLE");
const BULL = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

function play(
  engine: RandomCheckoutEngine,
  darts: DartObservation[],
): ReturnType<RandomCheckoutEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("RANDOM_CHECKOUT_POOL", () => {
  it("holds the 124 finishable scores 40-170, ascending", () => {
    expect(RANDOM_CHECKOUT_POOL).toHaveLength(124);
    expect(RANDOM_CHECKOUT_POOL[0]).toBe(40);
    expect(RANDOM_CHECKOUT_POOL.at(-1)).toBe(170);
    expect([...RANDOM_CHECKOUT_POOL]).toEqual(
      [...RANDOM_CHECKOUT_POOL].sort((a, b) => a - b),
    );
  });

  it("excludes the seven scores with no three-dart double-out", () => {
    for (const score of [159, 162, 163, 165, 166, 168, 169]) {
      expect(RANDOM_CHECKOUT_POOL).not.toContain(score);
    }
  });
});

describe("drawStartScore", () => {
  it("is stable for the same seed and index", () => {
    expect(drawStartScore(CONFIG, 3)).toBe(drawStartScore(CONFIG, 3));
  });

  it("always lands in the pool", () => {
    for (let index = 0; index < 200; index++) {
      expect(RANDOM_CHECKOUT_POOL).toContain(drawStartScore(CONFIG, index));
    }
  });

  it("is frozen for RANDOM_CHECKOUT_V1: seed 42 draws 155, 141, 160, 64, 140", () => {
    const config = { ...CONFIG, drawSeed: 42 };
    expect([0, 1, 2, 3, 4].map((n) => drawStartScore(config, n))).toEqual([
      155, 141, 160, 64, 140,
    ]);
  });

  it("spreads across the pool over many seeds", () => {
    const seen = new Set<number>();
    for (let drawSeed = 0; drawSeed < 2000; drawSeed++) {
      seen.add(drawStartScore({ ...CONFIG, drawSeed }, 0));
    }
    expect(seen.size).toBeGreaterThanOrEqual(110);
  });

  it("opens seed 774 with 40, 50, 52", () => {
    expect([0, 1, 2].map((n) => drawStartScore(CONFIG, n))).toEqual([
      40, 50, 52,
    ]);
  });
});

describe("RandomCheckoutEngine", () => {
  it("is registered under RANDOM_CHECKOUT_V1", () => {
    expect(getDartExerciseEngineFactory("RANDOM_CHECKOUT_V1")).toBe(
      randomCheckoutEngineFactory,
    );
  });

  it("rejects a config without a seed", () => {
    expect(
      () =>
        new RandomCheckoutEngine({
          minStart: 40,
          maxStart: 170,
        } as RandomCheckoutConfigData),
    ).toThrow();
  });

  it("starts at the first draw with nothing scored", () => {
    expect(randomCheckoutEngineFactory.create(CONFIG).state()).toEqual({
      startScore: 40,
      remaining: 40,
      dartsInVisit: 0,
      checkouts: 0,
      attempts: 0,
      lastAttempt: null,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts a first-dart checkout and moves to the next draw", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [D20]);

    expect(state.checkouts).toBe(1);
    expect(state.attempts).toBe(1);
    expect(state.lastAttempt).toBe("CHECKOUT");
    expect(state.startScore).toBe(50);
    expect(state.remaining).toBe(50);
    expect(state.dartsInVisit).toBe(0);
  });

  it("counts a checkout on the third dart", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [MISS, MISS, D20]);

    expect(state.checkouts).toBe(1);
    expect(state.attempts).toBe(1);
  });

  it("counts a checkout on the bullseye", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [D20, BULL]);

    expect(state.checkouts).toBe(2);
    expect(state.attempts).toBe(2);
    expect(state.startScore).toBe(52);
  });

  it("does not finish on the outer bull", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    play(engine, [D20]);
    const state = play(engine, [OUTER]);

    expect(state.checkouts).toBe(1);
    expect(state.attempts).toBe(1);
    expect(state.remaining).toBe(25);
    expect(state.dartsInVisit).toBe(1);
  });

  it("busts on reaching 0 without a double", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [S20, S20]);

    expect(state.checkouts).toBe(0);
    expect(state.attempts).toBe(1);
    expect(state.lastAttempt).toBe("FAILED");
    expect(state.startScore).toBe(50);
  });

  it("busts when it would leave 1", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [S19, S20]);

    expect(state.attempts).toBe(1);
    expect(state.lastAttempt).toBe("FAILED");
  });

  it("busts when it would go below 0", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [T20]);

    expect(state.attempts).toBe(1);
    expect(state.lastAttempt).toBe("FAILED");
  });

  it("opens a new turn from the next draw after a bust", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    play(engine, [T20, D10]);

    const turns = engine.facts().turns;
    expect(turns).toHaveLength(2);
    expect(turns[0].darts).toHaveLength(1);
    expect(turns[1].darts).toHaveLength(1);
  });

  it("fails an attempt after three darts without a checkout", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [MISS, MISS, MISS]);

    expect(state.attempts).toBe(1);
    expect(state.checkouts).toBe(0);
    expect(state.lastAttempt).toBe("FAILED");
    expect(state.startScore).toBe(50);
  });

  it("shows the walked remaining on an open attempt", () => {
    const state = play(new RandomCheckoutEngine(CONFIG), [S19]);

    expect(state.startScore).toBe(40);
    expect(state.remaining).toBe(21);
    expect(state.dartsInVisit).toBe(1);
    expect(state.attempts).toBe(0);
  });

  it("stamps completedAt only on a closing dart", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    play(engine, [S19]);
    expect(engine.facts().turns[0].completedAt).toBeNull();
    play(engine, [D1]);
    expect(engine.facts().turns[0].completedAt).toBeDefined();
  });

  it("does not judge an open attempt at expiry but counts its darts", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    play(engine, [D20, S19]);
    engine.expireTimer();

    expect(engine.isComplete()).toBe(true);
    expect(engine.state()).toMatchObject({
      checkouts: 1,
      attempts: 1,
      dartsThrown: 2,
      status: "COMPLETE",
    });
  });

  it("rejects a dart after expiry", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    engine.expireTimer();

    expect(() => engine.record(D20)).toThrow();
  });

  it("never completes on its own", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    for (let i = 0; i < 30; i++) play(engine, [D20]);

    expect(engine.isComplete()).toBe(false);
  });

  it("un-expires on the first undo, then pops a dart", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    play(engine, [S19]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().dartsThrown).toBe(1);
    expect(engine.undo()).toBe(true);
    expect(engine.state().dartsThrown).toBe(0);
  });

  it("restores the earlier start score when undoing across an attempt", () => {
    const engine = new RandomCheckoutEngine(CONFIG);
    play(engine, [D20]);
    expect(engine.state().startScore).toBe(50);

    engine.undo();

    expect(engine.state()).toMatchObject({
      startScore: 40,
      remaining: 40,
      attempts: 0,
      checkouts: 0,
      dartsInVisit: 0,
    });
  });

  it("replays prior facts into the same state", () => {
    const live = new RandomCheckoutEngine(CONFIG);
    play(live, [D20, S20, S19, T20, MISS, MISS]);

    const replayed = randomCheckoutEngineFactory.create(CONFIG, live.facts());

    expect(replayed.state()).toEqual(live.state());
  });

  it("folds facts without an engine", () => {
    const live = new RandomCheckoutEngine(CONFIG);
    play(live, [D20, BULL]);

    expect(foldRandomCheckoutState(live.facts(), CONFIG, false)).toEqual(
      live.state(),
    );
  });

  it("holds no rate on state", () => {
    expect(new RandomCheckoutEngine(CONFIG).state()).not.toHaveProperty("rate");
  });
});
