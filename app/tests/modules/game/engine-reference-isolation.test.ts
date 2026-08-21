import { describe, expect, it } from "vitest";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { tuodEngineFactory } from "@modules/game/tuod.engine.module";
import type { GameEngine } from "@modules/interfaces";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

/**
 * Nothing an engine hands out may alias its internals. `state()` must be a
 * derived value and `facts()` must be a detached copy — including the stage
 * records, which four engines used to return straight from a module-level
 * constant. `game.store.ts` copies the stage array but not the objects in it,
 * so a shared constant ends up inside an Alpine `$persist` proxy (D120), and a
 * caller writing to a returned `state()` silently changes engine behaviour in
 * one game and no-ops in the other four.
 */
type EngineCase = [string, () => GameEngine<unknown, unknown>];

const engines: EngineCase[] = [
  [
    "Score Training",
    () => {
      const engine = scoreTrainingEngineFactory.create({
        durationType: "ROUNDS",
        durationValue: 3,
        maxDartsPerTurn: 3,
        maxVisitScore: 180,
        seats: SEATS,
      });
      engine.record(45);
      return engine;
    },
  ],
  [
    "Bob's 27",
    () => {
      const engine = bobs27EngineFactory.create({
        startScore: 27,
        bullHitValue: 50,
        missPenaltyMultiplier: 1,
        seats: SEATS,
      });
      engine.record({
        hitTargetNumber: 1,
        hitZoneKey: "DOUBLE",
        locationX: null,
        locationY: null,
      });
      return engine;
    },
  ],
  [
    "Singles Training",
    () => {
      const engine = singlesTrainingEngineFactory.create({
        orderMode: "LOW_TO_HIGH",
        targetOrder: [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          25,
        ],
        difficulty: "EASY",
        pointsSingle: 1,
        pointsDouble: 2,
        pointsTreble: 3,
        seats: SEATS,
      });
      engine.record({
        hitTargetNumber: 1,
        hitZoneKey: "SINGLE",
        locationX: null,
        locationY: null,
      });
      return engine;
    },
  ],
  [
    "Doubles Training",
    () => {
      const engine = doublesTrainingEngineFactory.create({
        mode: "EASY",
        orderMode: "LOW_TO_HIGH",
        targetOrder: [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          25,
        ],
        seats: SEATS,
      });
      engine.record({
        hitTargetNumber: 1,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
      return engine;
    },
  ],
  [
    "501",
    () => {
      const engine = fiveOhOneEngineFactory.create({
        startingScore: 501,
        legsToWin: 2,
        checkIn: "STRAIGHT_IN",
        checkOut: "DOUBLE_OUT",
        maxDartsPerTurn: 3,
        maxVisitScore: 180,
        seats: SEATS,
      });
      engine.record({ scoreAttempted: 60 });
      return engine;
    },
  ],
  [
    "TUOD",
    () => {
      const engine = tuodEngineFactory.create({
        startingTarget: 41,
        finishBonus: 10,
        missPenalty: 1,
        durationType: "ROUNDS",
        durationValue: 10,
        maxDartsPerTurn: 3,
        seats: SEATS,
      });
      engine.record({ checkedOut: false, dartsUsed: 3 });
      return engine;
    },
  ],
];

describe("every engine hands out derived values, never live internals", () => {
  it.each(engines)(
    "%s: state() returns a fresh object per call",
    (_n, build) => {
      const engine = build();

      const first = engine.state();
      const second = engine.state();

      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    },
  );

  it.each(engines)(
    "%s: facts() returns stage records the caller cannot write through",
    (_n, build) => {
      const engine = build();

      const first = engine.facts().stages[0];
      const second = engine.facts().stages[0];
      expect(second).not.toBe(first);

      first.clientKey = "hijacked";
      first.sequence = 99;

      expect(engine.facts().stages[0]).toEqual(second);
    },
  );

  it.each(engines)(
    "%s: facts() returns turn records the caller cannot write through",
    (_n, build) => {
      const engine = build();

      const first = engine.facts().turns[0];
      const second = engine.facts().turns[0];
      expect(second).not.toBe(first);

      first.totalScore = -999;
      first.sequence = 99;

      expect(engine.facts().turns[0]).toEqual(second);
    },
  );
});
