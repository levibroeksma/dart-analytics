import { describe, it, expect } from "vitest";
import {
  summariseSwitching,
  summariseDoublePattern,
  summariseFinishing,
} from "@modules/training/routines/routine-summary.module";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
} from "@modules/types";
import type { TuodSeatResult } from "@lib/types";

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

describe("summariseFinishing", () => {
  it("reports the target reached and TUOD's own double accuracy", () => {
    const seat: TuodSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 47,
      doubleAccuracy: "31.25%",
    };

    expect(summariseFinishing(seat)).toEqual({
      stepKey: "GAME",
      label: "Finishing",
      rows: [
        { label: "Target reached", value: "47" },
        { label: "Double accuracy", value: "31.25%" },
      ],
    });
  });

  it("falls back to an em dash when the session recorded no double accuracy", () => {
    const seat: TuodSeatResult = {
      participantRef: "pt1",
      sideKey: "A",
      target: 41,
      doubleAccuracy: null,
    };

    expect(summariseFinishing(seat).rows[1]).toEqual({
      label: "Double accuracy",
      value: "—",
    });
  });
});
