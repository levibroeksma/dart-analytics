import { describe, expect, it } from "vitest";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { fiveOhOneValidator } from "@services/rulesets/five-oh-one/five-oh-one.validator";
import { scoreTrainingValidator } from "@services/rulesets/score-training/score-training.validator";
import type { DartObservation } from "@modules/types";

/**
 * The seam no other test in this repo crosses: what an engine actually writes,
 * run through the validator that guards the endpoint it is uploaded to.
 *
 * Both halves were previously tested alone — engine tests assert the fact log's
 * shape, validator tests hand-build batches — so a disagreement between them
 * was invisible in a green suite. It was not hypothetical: a keypad visit
 * inside a VISUAL_BOARD session produced `darts: []` with a non-zero
 * `totalScore`, which the visual validator rejected, and because a batch is
 * posted whole and all-or-nothing, that lost the entire session at the moment
 * the player finished it.
 */

const FIVE_OH_ONE_CONFIG = {
  startingScore: 501,
  legsToWin: 1,
  checkIn: "STRAIGHT_IN",
  checkOut: "DOUBLE_OUT",
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
};

const SCORE_TRAINING_CONFIG = {
  durationType: "ROUNDS",
  durationValue: 20,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
};

const trebleTwenty: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

const unseen: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

function validate501(
  facts: ReturnType<ReturnType<typeof fiveOhOneEngineFactory.create>["facts"]>,
  captureModeKey: string,
  inputModeKey: string,
) {
  return fiveOhOneValidator.validateBatch({
    config: { max_visit_score: 180 },
    batch: buildEventsBatch("p1", facts) as never,
    existingTurnCount: 0,
    captureModeKey,
    inputModeKey,
  });
}

function validateScoreTraining(
  facts: ReturnType<
    ReturnType<typeof scoreTrainingEngineFactory.create>["facts"]
  >,
  captureModeKey: string,
  inputModeKey: string,
  config: Record<string, unknown> = { max_visit_score: 180 },
) {
  return scoreTrainingValidator.validateBatch({
    config,
    batch: buildEventsBatch("p1", facts) as never,
    existingTurnCount: 0,
    captureModeKey,
    inputModeKey,
  });
}

describe("501 engine output against the 501 validator", () => {
  it("accepts a whole visit entered on the keypad inside a VISUAL_BOARD session", () => {
    const engine = fiveOhOneEngineFactory.create(
      FIVE_OH_ONE_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record({ scoreAttempted: 60 } as never);

    expect(validate501(engine.facts(), "ANALYTICS", "VISUAL_BOARD")).toEqual({
      valid: true,
    });
  });

  it("accepts board darts inside a VISUAL_BOARD session", () => {
    const engine = fiveOhOneEngineFactory.create(
      FIVE_OH_ONE_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record(trebleTwenty as never);
    engine.record(unseen as never);
    engine.record(trebleTwenty as never);

    expect(validate501(engine.facts(), "ANALYTICS", "VISUAL_BOARD")).toEqual({
      valid: true,
    });
  });

  it("accepts a session mixing board darts and a keypad visit", () => {
    const engine = fiveOhOneEngineFactory.create(
      FIVE_OH_ONE_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);
    engine.record({ scoreAttempted: 45 } as never);

    expect(validate501(engine.facts(), "ANALYTICS", "VISUAL_BOARD")).toEqual({
      valid: true,
    });
  });

  it("still refuses a keypad visit above the ruleset's max visit score", () => {
    const engine = fiveOhOneEngineFactory.create(
      FIVE_OH_ONE_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record({ scoreAttempted: 180 } as never);
    const facts = engine.facts();
    facts.turns[0]!.totalScore = 181;

    expect(validate501(facts, "ANALYTICS", "VISUAL_BOARD").valid).toBe(false);
  });

  it("still refuses a dart whose claim disagrees with its coordinate", () => {
    const engine = fiveOhOneEngineFactory.create(
      FIVE_OH_ONE_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record(trebleTwenty as never);
    const facts = engine.facts();
    facts.turns[0]!.darts[0]!.hitZoneKey = "DOUBLE";

    expect(validate501(facts, "ANALYTICS", "VISUAL_BOARD").valid).toBe(false);
  });
});

describe("Score Training engine output against the Score Training validator", () => {
  it("accepts a whole visit entered on the keypad inside a VISUAL_BOARD session", () => {
    const engine = scoreTrainingEngineFactory.create(
      SCORE_TRAINING_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record(41 as never);

    expect(
      validateScoreTraining(engine.facts(), "ANALYTICS", "VISUAL_BOARD"),
    ).toEqual({ valid: true });
  });

  it("accepts board darts inside a VISUAL_BOARD session", () => {
    const engine = scoreTrainingEngineFactory.create(
      SCORE_TRAINING_CONFIG as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record(trebleTwenty as never);
    engine.record(unseen as never);
    engine.record(trebleTwenty as never);

    expect(
      validateScoreTraining(engine.facts(), "ANALYTICS", "VISUAL_BOARD"),
    ).toEqual({ valid: true });
  });

  it("enforces the ROUNDS cap on a visual session, as it does on a quick-score one", () => {
    const engine = scoreTrainingEngineFactory.create(
      { ...SCORE_TRAINING_CONFIG, durationValue: 1 } as never,
      undefined,
      "VISUAL_BOARD",
    );
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);
    engine.record(trebleTwenty as never);

    const config = {
      max_visit_score: 180,
      duration_type: "ROUNDS",
      duration_value: 1,
    };
    const result = validateScoreTraining(
      engine.facts(),
      "ANALYTICS",
      "VISUAL_BOARD",
      config,
    );

    expect(result.valid).toBe(false);
    if (!result.valid)
      expect((result.issues as string[] | undefined)?.[0]).toContain(
        "limited to 1 visits",
      );
  });
});
