import { describe, expect, it } from "vitest";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
} from "@services/rulesets/visual-board.validator";

function batchWithDart(dart: Record<string, unknown>) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: "turn-1",
            participantRef: "p1",
            sequence: 1,
            totalScore: Number(dart.score),
            completedAt: "2026-08-05T12:00:00.000Z",
            darts: [dart],
          },
        ],
      },
    ],
  } as never;
}

function batchWithDarts(darts: Record<string, unknown>[], totalScore: number) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: [
          {
            clientKey: "turn-1",
            participantRef: "p1",
            sequence: 1,
            totalScore,
            completedAt: "2026-08-05T12:00:00.000Z",
            darts,
          },
        ],
      },
    ],
  } as never;
}

const trebleTwenty = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  score: 60,
  locationX: 0,
  locationY: -102,
};

const doubleTwenty = {
  sequence: 2,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  score: 40,
  locationX: 0,
  locationY: -166,
};

describe("isVisualBoardCapture", () => {
  it("recognises the analytics visual pair", () => {
    expect(isVisualBoardCapture("ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("rejects the quick-score pair", () => {
    expect(isVisualBoardCapture("RECREATIONAL", "QUICK_SCORE")).toBe(false);
  });
});

describe("validateVisualBoardTurns", () => {
  it("accepts a dart whose coordinate agrees with its zone and score", () => {
    expect(validateVisualBoardTurns(batchWithDart(trebleTwenty))).toEqual({
      valid: true,
    });
  });

  it("rejects a dart whose zone disagrees with its coordinate", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({ ...trebleTwenty, hitZoneKey: "DOUBLE" }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect((result.issues as string[] | undefined)?.[0]).toContain("zone");
  });

  it("rejects a dart whose score disagrees with its coordinate", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({ ...trebleTwenty, score: 20 }),
    );
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect((result.issues as string[] | undefined)?.[0]).toContain("score");
  });

  it("rejects a dart whose target number disagrees with its coordinate", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({ ...trebleTwenty, hitTargetNumber: 5 }),
    );
    expect(result.valid).toBe(false);
  });

  it("accepts a coordinate-less dart as an unseen throw", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
        locationX: null,
        locationY: null,
      }),
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a coordinate-less dart that claims a zone", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "TREBLE",
        score: 0,
        locationX: null,
        locationY: null,
      }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a coordinate-less dart that claims a score", () => {
    const result = validateVisualBoardTurns(
      batchWithDart({
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: null,
        locationY: null,
      }),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a turn total that is not the sum of its counted darts", () => {
    const batch = batchWithDart(trebleTwenty) as unknown as {
      stages: { turns: { totalScore: number }[] }[];
    };
    batch.stages[0]!.turns[0]!.totalScore = 41;
    const result = validateVisualBoardTurns(batch as never);
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect((result.issues as string[] | undefined)?.[0]).toContain(
        "totalScore",
      );
  });

  it("accepts a zero turn total against scoring darts as a bust", () => {
    const batch = batchWithDart(trebleTwenty) as unknown as {
      stages: { turns: { totalScore: number }[] }[];
    };
    batch.stages[0]!.turns[0]!.totalScore = 0;
    expect(validateVisualBoardTurns(batch as never)).toEqual({ valid: true });
  });

  it("accepts a three-dart turn whose total is the sum of its darts", () => {
    const darts = [
      trebleTwenty,
      doubleTwenty,
      { ...trebleTwenty, sequence: 3 },
    ];
    expect(validateVisualBoardTurns(batchWithDarts(darts, 160))).toEqual({
      valid: true,
    });
  });

  it("rejects a three-dart turn total that is not the sum of its darts", () => {
    const darts = [
      trebleTwenty,
      doubleTwenty,
      { ...trebleTwenty, sequence: 3 },
    ];
    const result = validateVisualBoardTurns(batchWithDarts(darts, 161));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect((result.issues as string[] | undefined)?.[0]).toContain(
        "totalScore",
      );
  });

  it("accepts a three-dart turn with a zero total as a bust", () => {
    const darts = [
      trebleTwenty,
      doubleTwenty,
      { ...trebleTwenty, sequence: 3 },
    ];
    expect(validateVisualBoardTurns(batchWithDarts(darts, 0))).toEqual({
      valid: true,
    });
  });

  it("rejects a three-dart turn whose second dart disagrees with its coordinate", () => {
    const darts = [
      trebleTwenty,
      { ...doubleTwenty, hitZoneKey: "TREBLE" },
      { ...trebleTwenty, sequence: 3 },
    ];
    const result = validateVisualBoardTurns(batchWithDarts(darts, 160));
    expect(result.valid).toBe(false);
    if (!result.valid)
      expect((result.issues as string[] | undefined)?.[0]).toContain("zone");
  });
});
