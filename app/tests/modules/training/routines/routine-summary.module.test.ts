import { describe, it, expect } from "vitest";
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseTargetScoring,
  summariseSwitchingTargetScoring,
  summariseScoreThreshold,
  summariseBullseyeCheckout,
  summariseBullUp,
  summariseTuod,
  summariseScoreTraining,
  summariseOneTwentyOne,
  summariseAroundTheClock,
} from "@modules/training/routines/routine-summary.module";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
  TargetScoringState,
  SwitchingTargetScoringState,
  ScoreThresholdState,
  BullseyeCheckoutState,
  BullUpState,
} from "@modules/types";
import type {
  TuodSeatResult,
  ScoreTrainingSeatResult,
  OneTwentyOneSeatResult,
  AroundTheClockSeatResult,
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

describe("summariseAroundTheClock", () => {
  it("reports laps, the target reached and accuracy", () => {
    const seat: AroundTheClockSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      turns: 12,
      accuracy: "41.67%",
      totalDarts: 36,
      laps: 1,
      targetAtEnd: "7",
    };

    expect(summariseAroundTheClock(seat)).toEqual({
      stepKey: "GAME:AROUND_THE_CLOCK_V2",
      label: "Around the Clock",
      rows: [
        { label: "Laps", value: "1" },
        { label: "Reached", value: "7" },
        { label: "Accuracy", value: "41.67%" },
      ],
    });
  });

  it("falls back to an em dash when the run was not timed", () => {
    const seat: AroundTheClockSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      turns: 7,
      accuracy: "100.00%",
      totalDarts: 21,
      laps: null,
      targetAtEnd: null,
    };

    expect(summariseAroundTheClock(seat).rows.slice(0, 2)).toEqual([
      { label: "Laps", value: "—" },
      { label: "Reached", value: "—" },
    ]);
  });
});

describe("summariseTargetScoring", () => {
  const STATE: TargetScoringState = {
    currentTargetNumber: 19,
    targetIndex: 1,
    currentChain: 2,
    bestChain: 7,
    markToBeat: null,
    bestChainByTarget: [
      { targetNumber: 20, bestChain: 7 },
      { targetNumber: 19, bestChain: 2 },
      { targetNumber: 25, bestChain: 0 },
    ],
    hits: 6,
    dartsThrown: 8,
    status: "COMPLETE",
  };

  it("reports the best chain, the best per target, darts and hit rate", () => {
    expect(summariseTargetScoring(STATE)).toEqual({
      stepKey: "TARGET_SCORING",
      label: "Target Scoring",
      rows: [
        { label: "Best chain", value: "7" },
        { label: "Best on 20", value: "7" },
        { label: "Best on 19", value: "2" },
        { label: "Best on Bull", value: "0" },
        { label: "Darts", value: "8" },
        { label: "Hit rate", value: "75.00%" },
      ],
    });
  });

  it("reads a dash for the hit rate of an untouched run", () => {
    const summary = summariseTargetScoring({
      ...STATE,
      hits: 0,
      dartsThrown: 0,
    });

    expect(summary.rows.at(-1)).toEqual({ label: "Hit rate", value: "—" });
  });
});

describe("summariseSwitchingTargetScoring", () => {
  const STATE: SwitchingTargetScoringState = {
    currentTargetNumber: 19,
    targetIndex: 1,
    currentChain: 4,
    bestChain: 9,
    markToBeat: 9,
    completedSequences: 2,
    hits: 9,
    dartsThrown: 12,
    status: "COMPLETE",
  };

  it("reports the best chain, sequences, darts and hit rate", () => {
    expect(summariseSwitchingTargetScoring(STATE)).toEqual({
      stepKey: "SWITCHING_TARGET_SCORING",
      label: "Switching Target Scoring",
      rows: [
        { label: "Best chain", value: "9" },
        { label: "Sequences", value: "2" },
        { label: "Darts", value: "12" },
        { label: "Hit rate", value: "75.00%" },
      ],
    });
  });
});

describe("summariseScoreThreshold", () => {
  const STATE: ScoreThresholdState = {
    threshold: 65,
    beats: 3,
    visits: 8,
    lastVisitTotal: 41,
    currentVisitTotal: 20,
    dartsInVisit: 1,
    dartsThrown: 25,
    status: "COMPLETE",
  };

  it("reports beats, visits, beat rate and darts", () => {
    expect(summariseScoreThreshold(STATE)).toEqual({
      stepKey: "SCORE_THRESHOLD",
      label: "65 or More",
      rows: [
        { label: "Beats", value: "3" },
        { label: "Visits", value: "8" },
        { label: "Beat rate", value: "37.50%" },
        { label: "Darts", value: "25" },
      ],
    });
  });

  it("reports a dash for the beat rate before any visit is judged", () => {
    const summary = summariseScoreThreshold({
      ...STATE,
      beats: 0,
      visits: 0,
    });
    expect(summary.rows[2]).toEqual({ label: "Beat rate", value: "—" });
  });
});

describe("summariseBullseyeCheckout", () => {
  const STATE: BullseyeCheckoutState = {
    startScore: 81,
    checkouts: 3,
    visits: 8,
    lastVisitCheckout: false,
    currentLeft: 62,
    dartsInVisit: 1,
    dartsThrown: 25,
    status: "COMPLETE",
  };

  it("reports checkouts, visits, checkout rate and darts", () => {
    expect(summariseBullseyeCheckout(STATE)).toEqual({
      stepKey: "BULLSEYE_CHECKOUT",
      label: "Bullseye Checkouts",
      rows: [
        { label: "Checkouts", value: "3" },
        { label: "Visits", value: "8" },
        { label: "Checkout rate", value: "37.50%" },
        { label: "Darts", value: "25" },
      ],
    });
  });

  it("shows no rate before any visit is judged", () => {
    const rows = summariseBullseyeCheckout({
      ...STATE,
      checkouts: 0,
      visits: 0,
    }).rows;
    expect(rows[2]).toEqual({ label: "Checkout rate", value: "—" });
  });
});

describe("summariseBullUp", () => {
  const STATE: BullUpState = {
    throws: 4,
    bullseyes: 1,
    bulls: 2,
    lastTier: "MISS",
    dartsThrown: 4,
    status: "COMPLETE",
  };

  it("reports throws, bullseyes, bulls and both rates", () => {
    expect(summariseBullUp(STATE)).toEqual({
      stepKey: "BULL_UP",
      label: "Bull Up Practice",
      rows: [
        { label: "Throws", value: "4" },
        { label: "Bullseyes", value: "1" },
        { label: "Bulls", value: "2" },
        { label: "Bullseye rate", value: "25.00%" },
        { label: "Bull rate", value: "50.00%" },
      ],
    });
  });

  it("shows no rate before the first throw", () => {
    expect(
      summariseBullUp({
        ...STATE,
        throws: 0,
        bullseyes: 0,
        bulls: 0,
        lastTier: null,
        dartsThrown: 0,
      }).rows,
    ).toEqual([
      { label: "Throws", value: "0" },
      { label: "Bullseyes", value: "0" },
      { label: "Bulls", value: "0" },
      { label: "Bullseye rate", value: "—" },
      { label: "Bull rate", value: "—" },
    ]);
  });
});
