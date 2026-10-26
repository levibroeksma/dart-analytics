import { describe, expect, it } from "vitest";
import { Bobs27Engine } from "@modules/game/bobs27.engine.module";
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import { bobs27Validator } from "@services/rulesets/bobs27/bobs27.validator";
import { aroundTheClockValidator } from "@services/rulesets/around-the-clock/around-the-clock.validator";
import {
  singlesTrainingValidator,
  singlesTrainingV2Validator,
} from "@services/rulesets/singles-training/singles-training.validator";
import { doublesTrainingValidator } from "@services/rulesets/doubles-training/doubles-training.validator";
import type { RulesetValidator } from "@services/interfaces";
import type { BoardTarget } from "@modules/types";
import type { RulesetVersionKey } from "@lib/types";

const seats = ["A", "B"].map((sideKey, i) => ({
  participantRef: `participant-${i + 1}`,
  displayName: `P${i + 1}`,
  sideKey,
  participantTypeKey: "PLAYER" as const,
}));
const ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const POINTS = { pointsSingle: 1, pointsDouble: 2, pointsTreble: 3 };
const profile = skillProfileForLevel(5 as never);
const MAX_DARTS = 400;

type Recorder = {
  record(observation: never): unknown;
  isComplete(): boolean;
  facts(): Parameters<typeof buildEventsBatch>[0];
};

/**
 * Plays an engine with seeded, game-agnostic landings, then keeps only the
 * visits that closed: an open visit is never uploaded.
 */
function closedVisitsBatch(engine: Recorder, seed: number) {
  for (let i = 0; i < MAX_DARTS && !engine.isComplete(); i++) {
    const aim = (1 + ((i * 7 + seed) % 20)) as unknown as BoardTarget;
    const thrown = throwDart(
      chooseTarget({ target: aim }),
      profile,
      createDartRng(seed, i),
    );
    engine.record({
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    } as never);
  }
  const facts = engine.facts();
  return buildEventsBatch({
    ...facts,
    turns: facts.turns.filter((turn) => turn.completedAt !== null),
  });
}

function validateVisual(
  validator: RulesetValidator,
  batch: ReturnType<typeof buildEventsBatch>,
) {
  return validator.validateBatch({
    config: {},
    batch: batch as never,
    existingTurnCounts: {},
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
  });
}

const CASES: {
  name: string;
  validator: RulesetValidator;
  build: () => Recorder;
}[] = [
  {
    name: "Bob's 27 V1",
    validator: bobs27Validator,
    build: () =>
      new Bobs27Engine({
        startScore: 27,
        bullHitValue: 50,
        missPenaltyMultiplier: 1,
        seats,
      }) as never,
  },
  {
    name: "Around the Clock V1",
    validator: aroundTheClockValidator,
    build: () => new AroundTheClockEngine({ seats }) as never,
  },
  {
    name: "Singles Training V1",
    validator: singlesTrainingValidator,
    build: () =>
      new SinglesTrainingEngine(
        {
          orderMode: "LOW_TO_HIGH",
          targetOrder: ORDER,
          difficulty: "EASY",
          ...POINTS,
          seats,
        },
        undefined,
        "SINGLES_V1" as RulesetVersionKey,
      ) as never,
  },
  {
    name: "Singles Training V2 hard",
    validator: singlesTrainingV2Validator,
    build: () =>
      new SinglesTrainingEngine(
        {
          orderMode: "LOW_TO_HIGH",
          targetOrder: ORDER,
          difficulty: "HARD",
          ...POINTS,
          seats,
        },
        undefined,
        "SINGLES_V2" as RulesetVersionKey,
      ) as never,
  },
  {
    name: "Doubles Training V1",
    validator: doublesTrainingValidator,
    build: () =>
      new DoublesTrainingEngine({
        mode: "EASY",
        orderMode: "LOW_TO_HIGH",
        targetOrder: ORDER,
        seats,
      }) as never,
  },
];

/**
 * What each shell-built engine writes for a 1v1 VISUAL_BOARD session, through
 * the validator guarding its upload endpoint. None sets `closedVisitTotal`,
 * so a visit's total is its board sum, which the shared check accepts.
 */
describe("engine visit totals against the visual-board validator", () => {
  for (const { name, validator, build } of CASES) {
    for (const seed of [1, 2, 3]) {
      it(`${name}, seed ${seed}`, () => {
        const batch = closedVisitsBatch(build(), seed);
        expect(
          batch.stages.flatMap((stage) => stage.turns).length,
        ).toBeGreaterThan(0);
        expect(validateVisual(validator, batch)).toEqual({ valid: true });
      });
    }
  }
});
