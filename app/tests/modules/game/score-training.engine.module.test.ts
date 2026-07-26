import { describe, it, expect } from "vitest";
import {
  ScoreTrainingEngine,
  scoreTrainingEngineFactory,
} from "@modules/game/score-training.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type { ScoreTrainingState } from "@modules/game/types";
import type { ScoreTrainingSnapshot } from "@lib/game/rulesets/types";

const ROUNDS_10: ScoreTrainingSnapshot = {
  durationType: "ROUNDS",
  durationValue: 10,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
};

function minutes(durationValue: number): ScoreTrainingSnapshot {
  return {
    durationType: "MINUTES",
    durationValue,
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
  };
}

describe("scoreTrainingEngineFactory", () => {
  it("registers itself under SCORE_TRAINING_V1", () => {
    expect(scoreTrainingEngineFactory.rulesetVersionKey).toBe(
      "SCORE_TRAINING_V1",
    );
    expect(getEngineFactory("SCORE_TRAINING_V1")).toBe(
      scoreTrainingEngineFactory,
    );
  });

  it("builds a ScoreTrainingEngine bound to the ruleset version", () => {
    const engine = scoreTrainingEngineFactory.create(ROUNDS_10);
    expect(engine).toBeInstanceOf(ScoreTrainingEngine);
    expect(engine.rulesetVersionKey).toBe("SCORE_TRAINING_V1");
  });

  it("rehydrates from persisted facts and continues the sequence", () => {
    const first = scoreTrainingEngineFactory.create(ROUNDS_10);
    first.record(60);
    first.record(45);

    const resumed = scoreTrainingEngineFactory.create(ROUNDS_10, first.facts());
    resumed.record(100);

    expect(resumed.facts().turns).toHaveLength(3);
    expect(resumed.facts().turns.at(-1)?.sequence).toBe(3);
    expect(resumed.undo()).toBe(true);
    expect(resumed.facts().turns).toHaveLength(2);
  });
});

describe("ScoreTrainingEngine.facts", () => {
  it("emits exactly one EXERCISE_BLOCK stage every turn belongs to", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(60);

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

  it("mints a unique clientKey and an ISO completedAt per visit", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(60);
    engine.record(60);

    const [a, b] = engine.facts().turns;
    expect(a.clientKey).not.toBe(b.clientKey);
    expect(a.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(a.stageClientKey).toBe(engine.facts().stages[0].clientKey);
  });

  it("records an incrementing sequence, a quick-score total and no darts", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(20);
    engine.record(30);

    const [first, second] = engine.facts().turns;
    expect(first.sequence).toBe(1);
    expect(first.totalScore).toBe(20);
    expect(first.darts).toEqual([]);
    expect(second.sequence).toBe(2);
  });

  it("returns a detached copy so callers cannot mutate the engine's log", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(60);

    engine.facts().turns.push(engine.facts().turns[0]);
    expect(engine.facts().turns).toHaveLength(1);
  });
});

describe("ScoreTrainingEngine.record validation", () => {
  it("rejects a visit score above the ruleset cap", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect(() => engine.record(181)).toThrow(/0 and 180/);
    expect(() => engine.record(-1)).toThrow(/0 and 180/);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("rejects a non-integer visit score", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect(() => engine.record(Number.NaN)).toThrow(/0 and 180/);
    expect(() => engine.record(12.5)).toThrow(/0 and 180/);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("bounds the cap by the ruleset config rather than a hardcoded 180", () => {
    const engine = new ScoreTrainingEngine({
      ...ROUNDS_10,
      maxVisitScore: 60,
    });
    expect(() => engine.record(61)).toThrow(/0 and 60/);
    expect(() => engine.record(60)).not.toThrow();
  });
});

describe("ScoreTrainingEngine.isComplete (ROUNDS)", () => {
  it("completes after the configured number of rounds", () => {
    const engine = new ScoreTrainingEngine({
      ...ROUNDS_10,
      durationValue: 2,
    });
    engine.record(60);
    expect(engine.isComplete()).toBe(false);
    engine.record(60);
    expect(engine.isComplete()).toBe(true);
  });
});

describe("ScoreTrainingEngine.isComplete (MINUTES)", () => {
  it("does not complete on a timer expiry before any visit is recorded", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.expireTimer();
    expect(engine.isComplete()).toBe(false);
  });

  it("completes once the timer has expired and at least one visit is recorded", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
  });

  it("completes when the visit is recorded after the timer expired", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.expireTimer();
    engine.record(30);
    expect(engine.isComplete()).toBe(true);
  });

  it("does not complete while the timer has not expired, regardless of visit count", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);
    engine.record(30);
    expect(engine.isComplete()).toBe(false);
  });

  it("starts every session with the timer unexpired, even when rehydrated", () => {
    const seed = new ScoreTrainingEngine(minutes(15));
    seed.record(30);
    const resumed = new ScoreTrainingEngine(minutes(15), seed.facts());
    expect(resumed.state().timerExpired).toBe(false);
    expect(resumed.isComplete()).toBe(false);
  });

  it("ignores a timerExpired written onto a previously returned state object", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);

    const leaked = engine.state();
    leaked.timerExpired = true;

    expect(engine.state().timerExpired).toBe(false);
    expect(engine.isComplete()).toBe(false);
    expect(engine.wouldComplete(45)).toBe(false);
  });
});

describe("ScoreTrainingEngine.wouldComplete", () => {
  it("is false for the visit before the last and true for the last (ROUNDS)", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 3 });
    engine.record(60);
    expect(engine.wouldComplete(60)).toBe(false);
    engine.record(60);
    expect(engine.wouldComplete(60)).toBe(true);
  });

  it("is true for the very first visit when the ruleset is a single round", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 1 });
    expect(engine.wouldComplete(60)).toBe(true);
  });

  it("is false before the timer expires and true after it (MINUTES)", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.record(30);
    expect(engine.wouldComplete(45)).toBe(false);

    engine.expireTimer();
    expect(engine.wouldComplete(45)).toBe(true);
  });

  it("is true for the first visit once the timer has expired (MINUTES)", () => {
    const engine = new ScoreTrainingEngine(minutes(15));
    engine.expireTimer();
    expect(engine.wouldComplete(45)).toBe(true);
  });

  it("is false for a score the ruleset would reject, so the caller surfaces the range error", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 1 });
    expect(engine.wouldComplete(181)).toBe(false);
    expect(engine.wouldComplete(12.5)).toBe(false);
  });

  it("does not mutate the fact log or the live state", () => {
    const engine = new ScoreTrainingEngine({ ...ROUNDS_10, durationValue: 2 });
    engine.record(60);
    const factsBefore = structuredClone(engine.facts());
    const turnCountBefore = (engine.state() as ScoreTrainingState).turnCount;

    expect(engine.wouldComplete(45)).toBe(true);

    expect(engine.facts()).toEqual(factsBefore);
    expect((engine.state() as ScoreTrainingState).turnCount).toBe(
      turnCountBefore,
    );
  });
});

describe("ScoreTrainingEngine.state", () => {
  it("reports the live turn count through record and undo", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect((engine.state() as ScoreTrainingState).turnCount).toBe(0);
    expect((engine.record(40) as ScoreTrainingState).turnCount).toBe(1);
    engine.undo();
    expect((engine.state() as ScoreTrainingState).turnCount).toBe(0);
  });
});

describe("ScoreTrainingEngine.undo", () => {
  it("pops the last turn and returns true; the next record reuses that sequence", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    engine.record(40);
    engine.record(60);
    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    engine.record(50);
    expect(engine.facts().turns.at(-1)?.sequence).toBe(2);
  });

  it("returns false when there is nothing to undo", () => {
    const engine = new ScoreTrainingEngine(ROUNDS_10);
    expect(engine.undo()).toBe(false);
  });
});
