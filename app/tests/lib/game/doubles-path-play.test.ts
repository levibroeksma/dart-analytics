import { describe, it, expect } from "vitest";
import {
  doublesPathTargetLabel,
  doublesPathPreviewSegments,
  doublesPathObservation,
} from "@lib/game/doubles-path-play";
import type { BoardTarget, TurnFact } from "@modules/types";

const NUMBER_TARGET: BoardTarget = { kind: "NUMBER", number: 5 };
const BULL_TARGET: BoardTarget = { kind: "BULL" };

describe("doublesPathTargetLabel", () => {
  it("labels a number target as D<n>", () => {
    expect(doublesPathTargetLabel(NUMBER_TARGET)).toBe("D5");
  });

  it("labels the bull target as BULL", () => {
    expect(doublesPathTargetLabel(BULL_TARGET)).toBe("BULL");
  });
});

describe("doublesPathObservation", () => {
  it("a hit on a number target records DOUBLE at that number", () => {
    expect(doublesPathObservation(NUMBER_TARGET, true)).toEqual({
      hitTargetNumber: 5,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
  });

  it("a hit on the bull records INNER_BULL at target number 25", () => {
    expect(doublesPathObservation(BULL_TARGET, true)).toEqual({
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
  });

  it("a miss records MISS regardless of target", () => {
    expect(doublesPathObservation(NUMBER_TARGET, false)).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(doublesPathObservation(BULL_TARGET, false)).toEqual({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
  });
});

function turnWithDarts(clientKey: string, darts: TurnFact["darts"]): TurnFact {
  return {
    clientKey,
    stageClientKey: "block-1",
    participantRef: "participant-1",
    sequence: 1,
    completedAt: null,
    totalScore: 0,
    darts,
  };
}

describe("doublesPathPreviewSegments", () => {
  it("returns three empty placeholders when there are no turns", () => {
    expect(doublesPathPreviewSegments([], null)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("returns three empty placeholders when the last turn is hidden", () => {
    const turns = [turnWithDarts("t1", [])];
    expect(doublesPathPreviewSegments(turns, "t1")).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("marks a dart that hit its intended target as a hit, an off-target dart as a miss, and pads the rest empty", () => {
    const turns = [
      turnWithDarts("t1", [
        {
          sequence: 1,
          intendedTargetNumber: 5,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: 5,
          hitZoneKey: "DOUBLE",
          score: 10,
          locationX: null,
          locationY: null,
        },
        {
          sequence: 2,
          intendedTargetNumber: 5,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: null,
          hitZoneKey: "MISS",
          score: 0,
          locationX: null,
          locationY: null,
        },
      ]),
    ];
    expect(doublesPathPreviewSegments(turns, null)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
});
