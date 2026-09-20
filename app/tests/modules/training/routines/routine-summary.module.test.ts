import { describe, it, expect } from "vitest";
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseTuod,
  summariseScoreTraining,
  summariseOneTwentyOne,
} from "@modules/training/routines/routine-summary.module";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
} from "@modules/types";
import type {
  TuodSeatResult,
  ScoreTrainingSeatResult,
  OneTwentyOneSeatResult,
} from "@lib/types";

function dart(
  sequence: number,
  intended: number,
  hit: number | null,
  score: number,
) {
  return {
    sequence,
    intendedTargetNumber: intended,
    intendedZoneKey: null,
    hitTargetNumber: hit,
    hitZoneKey: "SINGLE" as const,
    score,
    locationX: null,
    locationY: null,
  };
}

function factsWith(darts: ReturnType<typeof dart>[]): EngineFacts {
  return {
    stages: [],
    turns: [
      {
        clientKey: "t1",
        sequence: 1,
        participantRef: "pt1",
        stageClientKey: "s1",
        totalScore: 0,
        completedAt: null,
        darts,
      },
    ],
  } as unknown as EngineFacts;
}

const SWITCHING_STATE: SwitchingState = {
  currentTargetNumber: 20,
  targetIndex: 0,
  totalPoints: 7,
  dartsThrown: 4,
  status: "COMPLETE",
};

describe("summariseSwitching", () => {
  it("reports points, darts and the share of darts that hit their intended target", () => {
    const facts = factsWith([
      dart(1, 20, 20, 1),
      dart(2, 19, 19, 3),
      dart(3, 18, 5, 0),
      dart(4, 20, 20, 3),
    ]);

    expect(summariseSwitching(SWITCHING_STATE, facts)).toEqual({
      stepKey: "SWITCHING",
      label: "Switching",
      rows: [
        { label: "Points", value: "7" },
        { label: "Darts", value: "4" },
        { label: "Hit rate", value: "75.00%" },
      ],
    });
  });

  it("reports an em dash rather than 0% when no dart was thrown", () => {
    const state: SwitchingState = {
      ...SWITCHING_STATE,
      totalPoints: 0,
      dartsThrown: 0,
    };

    expect(summariseSwitching(state, factsWith([])).rows[2]).toEqual({
      label: "Hit rate",
      value: "—",
    });
  });
});

describe("summariseDoublePattern", () => {
  it("reads the engine's points as the count of doubles hit", () => {
    const state: DoublePatternState = {
      patternIndex: 0,
      targetWithinPattern: 0,
      currentDoubleNumber: 20,
      totalPoints: 3,
      dartsThrown: 12,
      status: "COMPLETE",
    };

    expect(summariseDoublePattern(state)).toEqual({
      stepKey: "DOUBLE_PATTERN",
      label: "Doubles",
      rows: [
        { label: "Doubles hit", value: "3" },
        { label: "Darts", value: "12" },
        { label: "Hit rate", value: "25.00%" },
      ],
    });
  });

  it("reports an em dash rather than 0% when no dart was thrown", () => {
    const state: DoublePatternState = {
      patternIndex: 0,
      targetWithinPattern: 0,
      currentDoubleNumber: 20,
      totalPoints: 0,
      dartsThrown: 0,
      status: "COMPLETE",
    };

    expect(summariseDoublePattern(state).rows[2]).toEqual({
      label: "Hit rate",
      value: "—",
    });
  });
});

describe("summariseTuod", () => {
  it("reports the target reached and TUOD's own checkout percentage", () => {
    const seat: TuodSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 47,
      checkoutPercentage: "31.25%",
    };

    expect(summariseTuod(seat)).toEqual({
      stepKey: "GAME:TUOD_V1",
      label: "Finishing",
      rows: [
        { label: "Target reached", value: "47" },
        { label: "Checkout %", value: "31.25%" },
      ],
    });
  });

  it("falls back to an em dash when the session recorded no checkout percentage", () => {
    const seat: TuodSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 41,
      checkoutPercentage: null,
    };

    expect(summariseTuod(seat).rows[1]).toEqual({
      label: "Checkout %",
      value: "—",
    });
  });
});

describe("summariseScoreTraining", () => {
  it("reports points and the three-dart average from Score Training's own results seat", () => {
    const seat: ScoreTrainingSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      total: 312,
      threeDartAverage: "52.00",
      firstNineAverage: "48.00",
      highestScore: 60,
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    };

    expect(summariseScoreTraining(seat)).toEqual({
      stepKey: "GAME:SCORE_TRAINING_V1",
      label: "Scoring",
      rows: [
        { label: "Points", value: "312" },
        { label: "Average", value: "52.00" },
      ],
    });
  });
});

describe("summariseOneTwentyOne", () => {
  it("reports the target reached and 121's own checkout percentage", () => {
    const seat: OneTwentyOneSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 105,
      visits: 6,
      average: 17.5,
      checkoutPercentage: "20.00%",
    };

    expect(summariseOneTwentyOne(seat)).toEqual({
      stepKey: "GAME:121_V2",
      label: "121",
      rows: [
        { label: "Target reached", value: "105" },
        { label: "Checkout %", value: "20.00%" },
      ],
    });
  });

  it("falls back to an em dash when the session recorded no checkout percentage", () => {
    const seat: OneTwentyOneSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 105,
      visits: 6,
      average: 17.5,
      checkoutPercentage: null,
    };

    expect(summariseOneTwentyOne(seat).rows[1]).toEqual({
      label: "Checkout %",
      value: "—",
    });
  });
});
