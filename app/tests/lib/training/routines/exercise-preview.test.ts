import { describe, it, expect } from "vitest";
import {
  visitPreview,
  bullUpPreview,
  cycleFrom,
} from "@lib/training/routines/exercise-preview";
import type { DartFact, TurnFact } from "@modules/types";

function dart(overrides: Partial<DartFact> = {}): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "SINGLE",
    score: 20,
    locationX: 0,
    locationY: -120,
    ...overrides,
  };
}

function turn(darts: DartFact[]): TurnFact {
  return {
    clientKey: "t1",
    stageClientKey: "block-1",
    participantRef: "participant-1",
    sequence: 1,
    completedAt: null,
    totalScore: 0,
    darts,
  };
}

describe("visitPreview", () => {
  it("labels a hit with its zone and empties with their upcoming targets", () => {
    const turns = [
      turn([
        dart({
          hitZoneKey: "TREBLE",
          hitTargetNumber: 20,
          intendedTargetNumber: 20,
        }),
      ]),
    ];
    expect(
      visitPreview({
        turns,
        visitLabels: () => ["T20", "T19", "T18"],
        judge: () => "hit",
      }),
    ).toEqual([
      { status: "hit", label: "T20" },
      { status: "empty", label: "T19" },
      { status: "empty", label: "T18" },
    ]);
  });

  it("captions a miss MISS and a free-aim dart with its value", () => {
    const turns = [
      turn([
        dart({ hitZoneKey: "SINGLE", hitTargetNumber: 20 }),
        dart({ hitZoneKey: "MISS", hitTargetNumber: null }),
      ]),
    ];
    expect(
      visitPreview({
        turns,
        visitLabels: () => [undefined, undefined, undefined],
        judge: (d) => (d.hitZoneKey === "MISS" ? "miss" : "value"),
      }),
    ).toEqual([
      { status: "value", label: "20" },
      { status: "miss" },
      { status: "empty", label: undefined },
    ]);
  });

  it("sizes each visit by its own labels", () => {
    const labels = (k: number) =>
      k === 0 ? ["D16", "D8"] : ["D20", "D10", "D5"];
    const twoDarts = [
      turn([
        dart({
          hitZoneKey: "DOUBLE",
          hitTargetNumber: 16,
          intendedTargetNumber: 16,
        }),
        dart({
          hitZoneKey: "DOUBLE",
          hitTargetNumber: 8,
          intendedTargetNumber: 8,
        }),
      ]),
    ];
    expect(
      visitPreview({
        turns: twoDarts,
        visitLabels: labels,
        judge: () => "hit",
      }),
    ).toHaveLength(2);
    const nextVisit = [
      ...twoDarts,
      turn([
        dart({
          hitZoneKey: "DOUBLE",
          hitTargetNumber: 20,
          intendedTargetNumber: 20,
        }),
      ]),
    ];
    expect(
      visitPreview({
        turns: nextVisit,
        visitLabels: labels,
        judge: () => "hit",
      }),
    ).toEqual([
      { status: "hit", label: "D20" },
      { status: "empty", label: "D10" },
      { status: "empty", label: "D5" },
    ]);
  });

  it("shows the first visit's empty slots before any dart", () => {
    expect(
      visitPreview({
        turns: [],
        visitLabels: () => ["20", "19"],
        judge: () => "hit",
      }),
    ).toEqual([
      { status: "empty", label: "20" },
      { status: "empty", label: "19" },
    ]);
  });
});

describe("bullUpPreview", () => {
  it("is one slot naming the next throw", () => {
    expect(bullUpPreview(42)).toEqual([{ status: "empty", label: "THROW 43" }]);
  });
});

describe("cycleFrom", () => {
  it("wraps around the list", () => {
    expect(cycleFrom([20, 19, 18], 2, 3)).toEqual([18, 20, 19]);
  });

  it("wraps a negative start", () => {
    expect(cycleFrom([20, 19, 18], -1, 2)).toEqual([18, 20]);
  });
});
