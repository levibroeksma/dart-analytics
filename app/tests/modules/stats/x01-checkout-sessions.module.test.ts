import { describe, expect, it } from "vitest";
import { checkoutVisitsFromRows } from "@modules/stats/x01-checkout-sessions.module";
import type { X01CheckoutDartRow } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "HOME",
    participantTypeKey: "PLAYER",
  },
];

function row(overrides: Partial<X01CheckoutDartRow>): X01CheckoutDartRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    configuration: {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      seats: SEATS,
    },
    stageId: "stage-1",
    stageSequence: 1,
    stageTypeKey: "LEG",
    parentStageId: null,
    turnId: "turn-1",
    turnSequence: 1,
    turnTotalScore: 60,
    turnCompletedAt: "2026-09-19T10:00:00.000Z",
    participantId: "participant-1",
    dartNumber: 1,
    hitTargetNumber: 20,
    hitZoneKey: "TREBLE",
    score: 60,
    ...overrides,
  };
}

describe("checkoutVisitsFromRows", () => {
  it("returns nothing for no rows", () => {
    expect(checkoutVisitsFromRows([])).toEqual([]);
  });

  it("opens a 501 leg's first visit on the configured starting score", () => {
    const visits = checkoutVisitsFromRows([row({})]);
    expect(visits).toEqual([
      {
        startingRemaining: 501,
        darts: [expect.objectContaining({ score: 60 })],
      },
    ]);
  });

  it("does not let a busted visit's darts move the next visit's remaining", () => {
    const visits = checkoutVisitsFromRows([
      row({}),
      row({
        turnId: "turn-2",
        turnSequence: 2,
        turnTotalScore: 0,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
      }),
      row({
        turnId: "turn-3",
        turnSequence: 3,
        turnTotalScore: 0,
        dartNumber: 1,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
      }),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([
      501, 441, 441,
    ]);
  });

  it("keeps two sessions' ladders separate", () => {
    const visits = checkoutVisitsFromRows([
      row({}),
      row({
        sessionId: "session-2",
        stageId: "stage-2",
        turnId: "turn-9",
        turnSequence: 1,
      }),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501, 501]);
  });

  it("contributes no visits for a 501 session with no stored configuration", () => {
    const visits = checkoutVisitsFromRows([row({ configuration: null })]);
    expect(visits).toEqual([]);
  });

  it("contributes no visits for a TUOD session with no stored configuration", () => {
    const visits = checkoutVisitsFromRows([
      row({
        sessionId: "session-tuod",
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        configuration: null,
        stageId: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
      }),
    ]);
    expect(visits).toEqual([]);
  });

  it("does not let a null-config session suppress its neighbours in the same batch", () => {
    const visits = checkoutVisitsFromRows([
      row({
        sessionId: "session-null",
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        configuration: null,
        stageId: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
      }),
      row({}),
    ]);
    expect(visits.map((visit) => visit.startingRemaining)).toEqual([501]);
  });
});
