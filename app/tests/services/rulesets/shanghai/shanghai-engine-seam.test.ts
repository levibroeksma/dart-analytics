import { describe, expect, it } from "vitest";
import { ShanghaiEngine } from "@modules/game/shanghai.engine.module";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import {
  shanghaiV2Validator,
  shanghaiV3Validator,
} from "@services/rulesets/shanghai/shanghai.validator";
import type { RulesetValidator } from "@services/interfaces";
import type { BoardTarget } from "@modules/game/types";
import type { ShanghaiV2Snapshot, ShanghaiV3Snapshot } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "participant-2",
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "PLAYER" as const,
  },
];

const profile = skillProfileForLevel(5 as never);

function playToCompletion(engine: ShanghaiEngine, seed: number) {
  for (
    let dartIndex = 0;
    !engine.isComplete() && dartIndex < 400;
    dartIndex++
  ) {
    const state = engine.state();
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    const thrown = throwDart(
      chooseTarget({
        target: (seat.rangeStart + seat.targetIndex) as unknown as BoardTarget,
      }),
      profile,
      createDartRng(seed, dartIndex),
    );
    engine.record({
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    });
  }
  return buildEventsBatch(engine.facts());
}

function validate(
  validator: RulesetValidator,
  batch: ReturnType<typeof buildEventsBatch>,
  config: Record<string, unknown>,
) {
  return validator.validateBatch({
    config,
    batch: batch as never,
    existingTurnCounts: {},
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
  });
}

/**
 * What the Shanghai engine writes, through the validator guarding the upload
 * endpoint. A closed visit persists the seat's score change, not the board sum.
 */
describe("Shanghai engine batch through its validator (VISUAL_BOARD, 1v1)", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`SHANGHAI_V2 NORMAL, seed ${seed}`, () => {
      const config: ShanghaiV2Snapshot & { seats: typeof SEATS } = {
        difficulty: "NORMAL",
        seats: SEATS,
      };
      const engine = new ShanghaiEngine(config, undefined, "SHANGHAI_V2");
      const batch = playToCompletion(engine, seed);
      expect(validate(shanghaiV2Validator, batch, {})).toEqual({ valid: true });
    });

    it(`SHANGHAI_V3 HARD, seed ${seed}`, () => {
      const config: ShanghaiV3Snapshot & { seats: typeof SEATS } = {
        difficulty: "HARD",
        rangeStart: 1,
        rangeEnd: 20,
        instantWin: false,
        seats: SEATS,
      };
      const engine = new ShanghaiEngine(config, undefined, "SHANGHAI_V3");
      const batch = playToCompletion(engine, seed);
      expect(
        validate(shanghaiV3Validator, batch, {
          difficulty: "HARD",
          range_start: 1,
          range_end: 20,
          instant_win: false,
        }),
      ).toEqual({ valid: true });
    });
  }

  it("still rejects a visit total that no target hit explains", () => {
    const engine = new ShanghaiEngine(
      { difficulty: "NORMAL", seats: SEATS } as ShanghaiV2Snapshot & {
        seats: typeof SEATS;
      },
      undefined,
      "SHANGHAI_V2",
    );
    const batch = playToCompletion(engine, 1);
    batch.stages[0]!.turns[0]!.totalScore = 179;
    expect(validate(shanghaiV2Validator, batch, {}).valid).toBe(false);
  });
});
