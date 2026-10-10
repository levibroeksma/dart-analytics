import { describe, it, expect } from "vitest";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { oneTwentyOneEngineFactory } from "@modules/game/one-twenty-one.engine.module";
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import { tuodEngineFactory } from "@modules/game/tuod.engine.module";
import {
  budgetedRound,
  contextRowParts,
  sessionContextRow,
} from "@modules/game/session-context.module";
import type { EngineFacts, SessionContextInput } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const fiveOhOne = (legsToWin = 1) => ({
  startingScore: 501,
  legsToWin,
  checkIn: "STRAIGHT_IN" as const,
  checkOut: "DOUBLE_OUT" as const,
  maxDartsPerTurn: 3 as const,
  maxVisitScore: 180,
  seats: SEATS,
});

const tuod = (durationType: "ROUNDS" | "MINUTES", durationValue = 2) => ({
  startingTarget: 41,
  finishBonus: 10,
  missPenalty: 1,
  durationType,
  durationValue,
  maxDartsPerTurn: 3 as const,
  seats: SEATS,
});

const scoreTraining = (
  durationType: "ROUNDS" | "MINUTES",
  durationValue = 3,
) => ({
  durationType,
  durationValue,
  maxDartsPerTurn: 3 as const,
  maxVisitScore: 180,
  seats: SEATS,
});

function input(
  gameTypeKey: string,
  configSnapshot: unknown,
  facts: EngineFacts,
): SessionContextInput {
  return {
    gameTypeKey,
    sessionId: "session-1",
    configSnapshot,
    facts,
    timerExpired: false,
  };
}

describe("sessionContextRow — 501", () => {
  it("fresh session reads Leg 1 · Round 1 and the starting score", () => {
    const engine = fiveOhOneEngineFactory.create(fiveOhOne());
    expect(
      sessionContextRow(input("501", fiveOhOne(), engine.facts())),
    ).toEqual({
      title: "501",
      stage: "Leg 1",
      round: "Round 1",
      value: "501",
    });
  });

  it("two closed visits of 60 read Round 3 and 381", () => {
    const engine = fiveOhOneEngineFactory.create(fiveOhOne());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    expect(
      sessionContextRow(input("501", fiveOhOne(), engine.facts())),
    ).toEqual({
      title: "501",
      stage: "Leg 1",
      round: "Round 3",
      value: "381",
    });
  });

  it("an open visit does not advance the round", () => {
    const engine = fiveOhOneEngineFactory.create(fiveOhOne());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    const row = sessionContextRow(input("501", fiveOhOne(), engine.facts()));
    expect(row?.round).toBe("Round 3");
  });

  it("second leg reads Leg 2 and resets Round", () => {
    const config = fiveOhOne(2);
    const engine = fiveOhOneEngineFactory.create(config);
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 180 });
    engine.record({ scoreAttempted: 101 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(sessionContextRow(input("501", config, engine.facts()))).toEqual({
      title: "501",
      stage: "Leg 2",
      round: "Round 1",
      value: "501",
    });
  });
});

describe("sessionContextRow — 121", () => {
  it("reads Attempt n · Round n and remaining in the attempt", () => {
    const config = { seats: SEATS };
    const engine = oneTwentyOneEngineFactory.create(config);
    engine.record({ scoreAttempted: 60 });
    expect(
      sessionContextRow(input("ONE_TWENTY_ONE", config, engine.facts())),
    ).toEqual({
      title: "121",
      stage: "Attempt 1",
      round: "Round 2",
      value: "61",
    });
  });
});

describe("sessionContextRow — TUOD", () => {
  const miss = { checkedOut: false, dartsUsed: 3 } as const;

  it("ROUNDS caps Round at N", () => {
    const config = tuod("ROUNDS", 2);
    const engine = tuodEngineFactory.create(config);
    engine.record(miss);
    engine.record(miss);
    const row = sessionContextRow(input("TUOD", config, engine.facts()));
    expect(row?.round).toBe("Round 2 of 2");
  });

  it("ROUNDS reads the next round while budget remains", () => {
    const config = tuod("ROUNDS", 10);
    const engine = tuodEngineFactory.create(config);
    engine.record(miss);
    const row = sessionContextRow(input("TUOD", config, engine.facts()));
    expect(row).toEqual({
      title: "TUOD",
      stage: null,
      round: "Round 2 of 10",
      value: "40",
    });
  });

  it("MINUTES reads Round n with no budget", () => {
    const config = tuod("MINUTES", 10);
    const engine = tuodEngineFactory.create(config);
    engine.record(miss);
    const row = sessionContextRow(input("TUOD", config, engine.facts()));
    expect(row?.round).toBe("Round 2");
  });
});

describe("sessionContextRow — Score training", () => {
  it("reads Round n of N and the total scored", () => {
    const config = scoreTraining("ROUNDS", 3);
    const engine = scoreTrainingEngineFactory.create(config);
    engine.record(60);
    engine.record(45);
    expect(
      sessionContextRow(input("SCORE_TRAINING", config, engine.facts())),
    ).toEqual({
      title: "Score training",
      stage: null,
      round: "Round 3 of 3",
      value: "105",
    });
  });

  it("MINUTES reads Round n", () => {
    const config = scoreTraining("MINUTES", 5);
    const engine = scoreTrainingEngineFactory.create(config);
    engine.record(60);
    const row = sessionContextRow(
      input("SCORE_TRAINING", config, engine.facts()),
    );
    expect(row?.round).toBe("Round 2");
  });
});

describe("sessionContextRow — guard and fallbacks", () => {
  const engine = fiveOhOneEngineFactory.create(fiveOhOne());
  const base = input("501", fiveOhOne(), engine.facts());

  it("skips the fold when expectedSessionId differs", () => {
    expect(
      sessionContextRow(base, { expectedSessionId: "session-2" }),
    ).toBeNull();
  });

  it("falls back to the title alone on a mismatch", () => {
    expect(
      sessionContextRow(base, {
        expectedSessionId: "session-2",
        fallbackTitle: "501",
      }),
    ).toEqual({ title: "501", stage: null, round: null, value: null });
  });

  it("folds when expectedSessionId matches", () => {
    expect(
      sessionContextRow(base, { expectedSessionId: "session-1" })?.value,
    ).toBe("501");
  });

  it("never folds when expectedSessionId is null", () => {
    expect(sessionContextRow(base, { expectedSessionId: null })).toBeNull();
  });

  it("returns null for an unmapped game", () => {
    expect(sessionContextRow({ ...base, gameTypeKey: "CRICKET" })).toBeNull();
  });

  it("returns null for a null config, or the fallback title", () => {
    const noConfig = { ...base, configSnapshot: null };
    expect(sessionContextRow(noConfig)).toBeNull();
    expect(sessionContextRow(noConfig, { fallbackTitle: "Cricket" })).toEqual({
      title: "Cricket",
      stage: null,
      round: null,
      value: null,
    });
  });
});

describe("contextRowParts", () => {
  it("drops null fields and keeps order", () => {
    expect(
      contextRowParts({
        title: "501",
        stage: null,
        round: "Round 3",
        value: "x",
      }),
    ).toEqual(["501", "Round 3"]);
  });

  it("returns an empty list for no row", () => {
    expect(contextRowParts(null)).toEqual([]);
  });
});

describe("budgetedRound", () => {
  it("reads Round n of m against a ROUNDS budget, held at the last round", () => {
    expect(
      budgetedRound({ durationType: "ROUNDS", durationValue: 10 }, 2),
    ).toBe("Round 3 of 10");
    expect(
      budgetedRound({ durationType: "ROUNDS", durationValue: 10 }, 10),
    ).toBe("Round 10 of 10");
  });

  it("drops the budget under any other duration", () => {
    expect(
      budgetedRound({ durationType: "MINUTES", durationValue: 5 }, 0),
    ).toBe("Round 1");
    expect(budgetedRound({ durationType: "TARGET" }, 4)).toBe("Round 5");
  });
});
