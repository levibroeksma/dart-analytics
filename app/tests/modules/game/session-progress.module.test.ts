import { describe, it, expect } from "vitest";
import {
  EMPTY_FACTS,
  summarizeProgress,
} from "@modules/game/session-progress.module";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import {
  oneTwentyOneEngineFactory,
  oneTwentyOneV2EngineFactory,
} from "@modules/game/one-twenty-one.engine.module";
import { cricketEngineFactory } from "@modules/game/cricket.engine.module";
import { tacticsEngineFactory } from "@modules/game/tactics.engine.module";
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { tuodEngineFactory } from "@modules/game/tuod.engine.module";
import { shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";
import {
  aroundTheClockEngineFactory,
  aroundTheClockV2EngineFactory,
} from "@modules/game/around-the-clock.engine.module";
import type { DartObservation, EngineFacts } from "@modules/types";
import type {
  AroundTheClockV2Snapshot,
  FiveOhOneSnapshot,
  SeatFact,
  Seated,
} from "@lib/types";

const YOU: SeatFact = {
  participantRef: "you",
  displayName: "You",
  sideKey: "A",
  participantTypeKey: "PLAYER",
};

const DARTBOT: SeatFact = {
  participantRef: "bot",
  displayName: "Dartbot",
  sideKey: "B",
  participantTypeKey: "DARTBOT",
  dartbot: { level: 5, seed: 1, levelSource: "MANUAL" },
};

const DUO = [YOU, DARTBOT];

const ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

const MISS: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

function single(number: number): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: "SINGLE",
    locationX: null,
    locationY: null,
  };
}

const fiveOhOneConfig: Seated<FiveOhOneSnapshot> = {
  startingScore: 501,
  legsToWin: 3,
  checkIn: "STRAIGHT_IN",
  checkOut: "DOUBLE_OUT",
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
  seats: DUO,
};

const scoreTrainingConfig = {
  durationType: "ROUNDS" as const,
  durationValue: 10,
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
  seats: DUO,
};

const singlesConfig = {
  orderMode: "LOW_TO_HIGH" as const,
  targetOrder: ORDER,
  difficulty: "EASY" as const,
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
  seats: DUO,
};

const doublesConfig = {
  mode: "EASY" as const,
  orderMode: "HIGH_TO_LOW" as const,
  targetOrder: [...ORDER.slice(0, 20).reverse(), 25],
  seats: DUO,
};

const bobs27Config = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
  seats: DUO,
};

const tuodConfig = {
  startingTarget: 41,
  finishBonus: 10,
  missPenalty: 1,
  durationType: "ROUNDS" as const,
  durationValue: 10,
  maxDartsPerTurn: 3,
  seats: DUO,
};

const clockV2Config: Seated<AroundTheClockV2Snapshot> = {
  pathDirection: "HIGH_TO_LOW",
  oddsFirst: false,
  segmentRule: "ANY",
  difficulty: "EASY",
  durationType: "UNTIMED",
  durationValue: null,
  seats: DUO,
};

/** Records `inputs` in order on a fresh engine and returns its fact log. */
function factsAfter<TConfig, TInput>(
  factory: {
    create(config: TConfig): {
      record(input: TInput): unknown;
      facts(): EngineFacts;
    };
  },
  config: TConfig,
  inputs: readonly TInput[],
): EngineFacts {
  const engine = factory.create(config);
  for (const input of inputs) engine.record(input);
  return engine.facts();
}

describe("summarizeProgress — guards", () => {
  it("returns null for an unknown ruleset", () => {
    expect(summarizeProgress("NOPE_V1", {}, EMPTY_FACTS)).toBeNull();
  });

  it("returns null for a malformed config instead of throwing", () => {
    expect(summarizeProgress("501_V1", { seats: "x" }, EMPTY_FACTS)).toBeNull();
  });

  it("returns null for a null config", () => {
    expect(summarizeProgress("501_V1", null, EMPTY_FACTS)).toBeNull();
  });

  it("returns null when the fold throws on facts naming an unknown seat", () => {
    const facts = factsAfter(fiveOhOneEngineFactory, fiveOhOneConfig, [
      { scoreAttempted: 60 },
    ]);
    expect(
      summarizeProgress(
        "501_V1",
        { ...fiveOhOneConfig, seats: [{ ...YOU, participantRef: "other" }] },
        facts,
      ),
    ).toBeNull();
  });

  it("EMPTY_FACTS has no stages and no turns", () => {
    expect(EMPTY_FACTS).toEqual({ stages: [], turns: [] });
  });
});

describe("summarizeProgress — 501_V1", () => {
  it("501 with empty facts against Dartbot", () => {
    expect(summarizeProgress("501_V1", fiveOhOneConfig, EMPTY_FACTS)).toEqual({
      detail: "vs Dartbot · Leg 1 · First to 3 · 0–0",
      big: { value: "501", label: "TO GO" },
    });
  });

  it("reads the player's remaining score after a couple of visits", () => {
    const facts = factsAfter(fiveOhOneEngineFactory, fiveOhOneConfig, [
      { scoreAttempted: 60 },
      { scoreAttempted: 45 },
    ]);
    expect(summarizeProgress("501_V1", fiveOhOneConfig, facts)).toEqual({
      detail: "vs Dartbot · Leg 1 · First to 3 · 0–0",
      big: { value: "441", label: "TO GO" },
    });
  });

  it("counts a won leg and the leg it opens", () => {
    const facts = factsAfter(fiveOhOneEngineFactory, fiveOhOneConfig, [
      { scoreAttempted: 180 },
      { scoreAttempted: 0 },
      { scoreAttempted: 180 },
      { scoreAttempted: 0 },
      { scoreAttempted: 141, finishedOnDouble: true },
    ]);
    expect(summarizeProgress("501_V1", fiveOhOneConfig, facts)).toEqual({
      detail: "vs Dartbot · Leg 2 · First to 3 · 1–0",
      big: { value: "501", label: "TO GO" },
    });
  });

  it("never lists a teammate after vs", () => {
    const teammate: SeatFact = {
      participantRef: "sam",
      displayName: "Sam",
      sideKey: "A",
      participantTypeKey: "GUEST",
    };
    const secondBot: SeatFact = {
      ...DARTBOT,
      participantRef: "bot-2",
      displayName: "Dartbot 2",
    };
    expect(
      summarizeProgress(
        "501_V1",
        { ...fiveOhOneConfig, seats: [YOU, DARTBOT, teammate, secondBot] },
        EMPTY_FACTS,
      ),
    ).toEqual({
      detail: "vs Dartbot & Dartbot 2 · Leg 1 · First to 3 · 0–0",
      big: { value: "501", label: "TO GO" },
    });
  });

  it("drops the opponents and the score when playing solo", () => {
    expect(
      summarizeProgress(
        "501_V1",
        { ...fiveOhOneConfig, seats: [YOU] },
        EMPTY_FACTS,
      ),
    ).toEqual({
      detail: "Leg 1 · First to 3",
      big: { value: "501", label: "TO GO" },
    });
  });
});

describe("summarizeProgress — 121", () => {
  it("121_V1 has no budget, so the attempt stands alone", () => {
    expect(summarizeProgress("121_V1", { seats: DUO }, EMPTY_FACTS)).toEqual({
      detail: "Attempt 1",
      big: { value: "121", label: "TARGET" },
    });
  });

  it("121_V1 stays on the open attempt after a visit each", () => {
    const facts = factsAfter(oneTwentyOneEngineFactory, { seats: DUO }, [
      { scoreAttempted: 60 },
      { scoreAttempted: 45 },
    ]);
    expect(summarizeProgress("121_V1", { seats: DUO }, facts)).toEqual({
      detail: "Attempt 1",
      big: { value: "121", label: "TARGET" },
    });
  });

  it("121_V1 advances the attempt once three visits close it", () => {
    const solo = { seats: [YOU] };
    const facts = factsAfter(oneTwentyOneEngineFactory, solo, [
      { scoreAttempted: 0 },
      { scoreAttempted: 0 },
      { scoreAttempted: 0 },
    ]);
    expect(summarizeProgress("121_V1", solo, facts)?.detail).toBe("Attempt 2");
  });

  it("121_V2 under a ROUNDS budget reads Attempt n of m", () => {
    const config = {
      durationType: "ROUNDS" as const,
      durationValue: 10,
      seats: DUO,
    };
    expect(summarizeProgress("121_V2", config, EMPTY_FACTS)).toEqual({
      detail: "Attempt 1 of 10",
      big: { value: "121", label: "TARGET" },
    });
    const facts = factsAfter(oneTwentyOneV2EngineFactory, config, [
      { scoreAttempted: 60 },
    ]);
    expect(summarizeProgress("121_V2", config, facts)?.detail).toBe(
      "Attempt 1 of 10",
    );
  });
});

describe("summarizeProgress — CRICKET_V1 / TACTICS_V1", () => {
  it("CRICKET_V1 counts the darts thrown", () => {
    const config = { seats: [YOU] };
    expect(summarizeProgress("CRICKET_V1", config, EMPTY_FACTS)).toEqual({
      detail: "Solo · 7 objectives",
      big: { value: "0", label: "DARTS" },
    });
    const facts = factsAfter(cricketEngineFactory, config, [single(20), MISS]);
    expect(summarizeProgress("CRICKET_V1", config, facts)).toEqual({
      detail: "Solo · 7 objectives",
      big: { value: "2", label: "DARTS" },
    });
  });

  it("TACTICS_V1 counts the darts thrown", () => {
    const config = { seats: [YOU] };
    expect(summarizeProgress("TACTICS_V1", config, EMPTY_FACTS)).toEqual({
      detail: "Solo · 9 objectives",
      big: { value: "0", label: "DARTS" },
    });
    const facts = factsAfter(tacticsEngineFactory, config, [
      single(20),
      single(19),
      MISS,
    ]);
    expect(summarizeProgress("TACTICS_V1", config, facts)).toEqual({
      detail: "Solo · 9 objectives",
      big: { value: "3", label: "DARTS" },
    });
  });
});

describe("summarizeProgress — SCORE_TRAINING_V1", () => {
  it("reads Round n of m and the active seat's points", () => {
    expect(
      summarizeProgress("SCORE_TRAINING_V1", scoreTrainingConfig, EMPTY_FACTS),
    ).toEqual({
      detail: "Round 1 of 10",
      big: { value: "0", label: "POINTS" },
    });
    const facts = factsAfter(
      scoreTrainingEngineFactory,
      scoreTrainingConfig,
      [60, 45],
    );
    expect(
      summarizeProgress("SCORE_TRAINING_V1", scoreTrainingConfig, facts),
    ).toEqual({
      detail: "Round 2 of 10",
      big: { value: "60", label: "POINTS" },
    });
  });

  it("drops the budget under MINUTES", () => {
    expect(
      summarizeProgress(
        "SCORE_TRAINING_V1",
        { ...scoreTrainingConfig, durationType: "MINUTES", durationValue: 5 },
        EMPTY_FACTS,
      )?.detail,
    ).toBe("Round 1");
  });
});

describe("summarizeProgress — SINGLES / DOUBLES_TRAINING", () => {
  it("SINGLES_V1 reads the order mode and the active target", () => {
    expect(summarizeProgress("SINGLES_V1", singlesConfig, EMPTY_FACTS)).toEqual(
      {
        detail: "Low → High",
        big: { value: "1", label: "TARGET" },
      },
    );
    const facts = factsAfter(singlesTrainingEngineFactory, singlesConfig, [
      single(1),
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
    ]);
    expect(summarizeProgress("SINGLES_V1", singlesConfig, facts)).toEqual({
      detail: "Low → High",
      big: { value: "2", label: "TARGET" },
    });
  });

  it("SINGLES_V2 and SINGLES_V3 share the V1 summary", () => {
    const random = { ...singlesConfig, orderMode: "RANDOM" as const };
    expect(summarizeProgress("SINGLES_V2", random, EMPTY_FACTS)?.detail).toBe(
      "Random",
    );
    expect(
      summarizeProgress(
        "SINGLES_V3",
        { ...singlesConfig, scoringMode: "STANDARD" },
        EMPTY_FACTS,
      ),
    ).toEqual({ detail: "Low → High", big: { value: "1", label: "TARGET" } });
  });

  it("leaves the detail blank for an order mode it does not know", () => {
    expect(
      summarizeProgress(
        "DOUBLES_TRAINING_V1",
        { ...doublesConfig, orderMode: "SPIRAL" },
        EMPTY_FACTS,
      ),
    ).toEqual({ detail: "", big: { value: "D20", label: "TARGET" } });
  });

  it("DOUBLES_TRAINING_V1 labels the target as a double", () => {
    expect(
      summarizeProgress("DOUBLES_TRAINING_V1", doublesConfig, EMPTY_FACTS),
    ).toEqual({
      detail: "High → Low",
      big: { value: "D20", label: "TARGET" },
    });
    const facts = factsAfter(doublesTrainingEngineFactory, doublesConfig, [
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
    ]);
    expect(
      summarizeProgress("DOUBLES_TRAINING_V1", doublesConfig, facts),
    ).toEqual({
      detail: "High → Low",
      big: { value: "D19", label: "TARGET" },
    });
  });
});

describe("summarizeProgress — BOBS27_V1", () => {
  it("reads Double n of 21 and the active seat's score", () => {
    expect(summarizeProgress("BOBS27_V1", bobs27Config, EMPTY_FACTS)).toEqual({
      detail: "Double 1 of 21",
      big: { value: "27", label: "POINTS" },
    });
    const facts = factsAfter(bobs27EngineFactory, bobs27Config, [
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
    ]);
    expect(summarizeProgress("BOBS27_V1", bobs27Config, facts)).toEqual({
      detail: "Double 2 of 21",
      big: { value: "25", label: "POINTS" },
    });
  });
});

describe("summarizeProgress — TUOD_V1", () => {
  it("reads Attempt n of m and the active seat's target", () => {
    expect(summarizeProgress("TUOD_V1", tuodConfig, EMPTY_FACTS)).toEqual({
      detail: "Attempt 1 of 10",
      big: { value: "41", label: "TARGET" },
    });
    const facts = factsAfter(tuodEngineFactory, tuodConfig, [
      { checkedOut: false },
      { checkedOut: false },
    ]);
    expect(summarizeProgress("TUOD_V1", tuodConfig, facts)).toEqual({
      detail: "Attempt 2 of 10",
      big: { value: "40", label: "TARGET" },
    });
  });
});

describe("summarizeProgress — SHANGHAI", () => {
  it("SHANGHAI_V1 reads Round n of 20 and the round's number", () => {
    const config = { seats: DUO };
    expect(summarizeProgress("SHANGHAI_V1", config, EMPTY_FACTS)).toEqual({
      detail: "Round 1 of 20",
      big: { value: "1", label: "TARGET" },
    });
    const facts = factsAfter(shanghaiEngineFactory, config, [
      single(1),
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
    ]);
    expect(summarizeProgress("SHANGHAI_V1", config, facts)).toEqual({
      detail: "Round 2 of 20",
      big: { value: "2", label: "TARGET" },
    });
  });

  it("SHANGHAI_V2 shares the summary", () => {
    expect(
      summarizeProgress(
        "SHANGHAI_V2",
        { difficulty: "HARD", seats: DUO },
        EMPTY_FACTS,
      )?.detail,
    ).toBe("Round 1 of 20");
  });
});

describe("summarizeProgress — AROUND_THE_CLOCK", () => {
  it("AROUND_THE_CLOCK_V1 reads the lap and the 1 → 20 path", () => {
    expect(
      summarizeProgress("AROUND_THE_CLOCK_V1", { seats: DUO }, EMPTY_FACTS),
    ).toEqual({
      detail: "Lap 1 · 1 → 20",
      big: { value: "1", label: "TARGET" },
    });
  });

  it("AROUND_THE_CLOCK_V2 follows the configured path", () => {
    expect(
      summarizeProgress("AROUND_THE_CLOCK_V2", clockV2Config, EMPTY_FACTS),
    ).toEqual({
      detail: "Lap 1 · 20 → 1",
      big: { value: "20", label: "TARGET" },
    });
    const facts = factsAfter(aroundTheClockV2EngineFactory, clockV2Config, [
      single(20),
      MISS,
      MISS,
      MISS,
      MISS,
      MISS,
    ]);
    expect(
      summarizeProgress("AROUND_THE_CLOCK_V2", clockV2Config, facts),
    ).toEqual({
      detail: "Lap 1 · 20 → 1",
      big: { value: "19", label: "TARGET" },
    });
  });
});

describe("summarizeProgress — the end of a path", () => {
  it("a finished Around the Clock seat stays on BULL", () => {
    const solo = { seats: [YOU] };
    const facts = factsAfter(aroundTheClockEngineFactory, solo, [
      ...ORDER.slice(0, 20).map(single),
      { ...single(25), hitZoneKey: "OUTER_BULL" as const },
    ]);
    expect(summarizeProgress("AROUND_THE_CLOCK_V1", solo, facts)).toEqual({
      detail: "Lap 1 · 1 → 20",
      big: { value: "BULL", label: "TARGET" },
    });
  });

  it("a finished Doubles Training seat stays on BULL", () => {
    const solo = { ...doublesConfig, seats: [YOU] };
    const hits = solo.targetOrder.map((number): DartObservation =>
      number === 25
        ? { ...single(25), hitZoneKey: "INNER_BULL" }
        : { ...single(number), hitZoneKey: "DOUBLE" },
    );
    const facts = factsAfter(doublesTrainingEngineFactory, solo, hits);
    expect(summarizeProgress("DOUBLES_TRAINING_V1", solo, facts)?.big).toEqual({
      value: "BULL",
      label: "TARGET",
    });
  });

  it("reads big as null when the seat's index is past its path", () => {
    expect(
      summarizeProgress(
        "SINGLES_V1",
        { ...singlesConfig, targetOrder: [] },
        EMPTY_FACTS,
      ),
    ).toEqual({ detail: "Low → High", big: null });
  });
});
