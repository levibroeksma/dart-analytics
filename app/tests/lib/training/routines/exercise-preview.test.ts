import { describe, it, expect } from "vitest";
import {
  visitPreview,
  bullUpPreview,
  cycleFrom,
  exerciseFamily,
  judgeDart,
  visitLabelsFor,
  windowIndex,
  windowPage,
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
  const eight = ["1", "2", "3", "4", "5", "6", "7", "8"];

  it("shows only the six-slot page of a long visit that holds the next dart", () => {
    const turns = [turn(Array.from({ length: 6 }, () => dart()))];
    expect(
      visitPreview({ turns, visitLabels: () => eight, judge: () => "hit" }),
    ).toEqual([
      { status: "empty", label: "7" },
      { status: "empty", label: "8" },
    ]);
  });

  it("keeps a finished long visit on the page of its last dart", () => {
    const turns = [turn(Array.from({ length: 8 }, () => dart()))];
    expect(
      visitPreview({ turns, visitLabels: () => eight, judge: () => "hit" }),
    ).toEqual([
      { status: "hit", label: "20" },
      { status: "hit", label: "20" },
    ]);
  });

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

describe("windowPage", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

  it("returns a list of up to six items whole", () => {
    expect(windowPage([20, 19, 18], 2)).toEqual([20, 19, 18]);
  });

  it("returns the six-item page holding the focus index", () => {
    expect(windowPage(items, 0)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(windowPage(items, 5)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(windowPage(items, 6)).toEqual([7, 8, 9, 10, 11, 12]);
  });

  it("returns a short last page", () => {
    expect(windowPage(items, 13)).toEqual([13, 14]);
  });

  it("clamps an out-of-range focus to the list", () => {
    expect(windowPage(items, 99)).toEqual([13, 14]);
    expect(windowPage(items, -1)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("windowIndex", () => {
  it("is the focus index's position within its six-item page", () => {
    expect(windowIndex(0)).toBe(0);
    expect(windowIndex(5)).toBe(5);
    expect(windowIndex(6)).toBe(0);
    expect(windowIndex(13)).toBe(1);
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

describe("exerciseFamily", () => {
  const none = {
    switchingEngine: null,
    doublePatternEngine: null,
    targetScoringEngine: null,
    switchingTargetScoringEngine: null,
    scoreThresholdEngine: null,
    bullseyeCheckoutEngine: null,
    checkoutSequenceEngine: null,
    randomCheckoutEngine: null,
  };
  const engine = {} as never;

  it("is null while no exercise engine is open", () => {
    expect(exerciseFamily(none)).toBeNull();
  });

  it.each([
    ["switchingEngine", "switching"],
    ["doublePatternEngine", "doublePattern"],
    ["targetScoringEngine", "targetScoring"],
    ["switchingTargetScoringEngine", "switchingTargetScoring"],
    ["scoreThresholdEngine", "freeAim"],
    ["checkoutSequenceEngine", "freeAim"],
    ["randomCheckoutEngine", "freeAim"],
    ["bullseyeCheckoutEngine", "bullseye"],
  ] as const)("maps %s to %s", (key, family) => {
    expect(exerciseFamily({ ...none, [key]: engine })).toBe(family);
  });
});

describe("judgeDart", () => {
  const onBoard = dart({ hitTargetNumber: 20, hitZoneKey: "SINGLE" });
  const off = dart({ hitTargetNumber: null, hitZoneKey: "MISS" });

  it("switching: a hit is the intended number", () => {
    expect(judgeDart("switching", dart({ intendedTargetNumber: 20 }))).toBe(
      "hit",
    );
    expect(judgeDart("switching", dart({ intendedTargetNumber: 19 }))).toBe(
      "miss",
    );
  });

  it("doublePattern: only the intended double is a hit", () => {
    const double = dart({
      intendedTargetNumber: 20,
      hitZoneKey: "DOUBLE",
    });
    expect(judgeDart("doublePattern", double)).toBe("hit");
    expect(
      judgeDart(
        "doublePattern",
        dart({ intendedTargetNumber: 20, hitZoneKey: "SINGLE" }),
      ),
    ).toBe("miss");
  });

  it("targetScoring: the target's own ring scores, a double is a miss", () => {
    expect(
      judgeDart(
        "targetScoring",
        dart({ intendedTargetNumber: 20, hitZoneKey: "TREBLE" }),
      ),
    ).toBe("hit");
    expect(
      judgeDart(
        "targetScoring",
        dart({ intendedTargetNumber: 20, hitZoneKey: "DOUBLE" }),
      ),
    ).toBe("miss");
    expect(judgeDart("targetScoring", dart())).toBe("miss");
  });

  it("switchingTargetScoring: judged as targetScoring", () => {
    const treble = dart({ intendedTargetNumber: 20, hitZoneKey: "TREBLE" });
    const double = dart({ intendedTargetNumber: 20, hitZoneKey: "DOUBLE" });
    expect(judgeDart("switchingTargetScoring", treble)).toBe("hit");
    expect(judgeDart("switchingTargetScoring", double)).toBe("miss");
  });

  it("freeAim: a dart on the board is a value, off it a miss", () => {
    expect(judgeDart("freeAim", onBoard)).toBe("value");
    expect(judgeDart("freeAim", off)).toBe("miss");
  });

  it("bullseye: setup darts are values, the bull-aimed dart hits only the bullseye", () => {
    expect(judgeDart("bullseye", onBoard)).toBe("value");
    expect(judgeDart("bullseye", off)).toBe("miss");
    const aimed = { intendedZoneKey: "INNER_BULL" } as const;
    expect(
      judgeDart("bullseye", dart({ ...aimed, hitZoneKey: "INNER_BULL" })),
    ).toBe("hit");
    expect(
      judgeDart("bullseye", dart({ ...aimed, hitZoneKey: "OUTER_BULL" })),
    ).toBe("miss");
  });
});

describe("visitLabelsFor", () => {
  const base = {
    config: null,
    visitIndex: 0,
    currentTargetNumber: undefined,
    targetIndex: 0,
    dartsInOpenVisit: 0,
  };

  it("has no captions without a family, or for free-aim and bullseye", () => {
    const blank = [undefined, undefined, undefined];
    expect(visitLabelsFor(null, base)).toEqual(blank);
    expect(visitLabelsFor("freeAim", base)).toEqual(blank);
    expect(visitLabelsFor("bullseye", base)).toEqual(blank);
  });

  it("switching: one caption per target; none without a config", () => {
    expect(
      visitLabelsFor("switching", {
        ...base,
        config: { targets: [20, 19, 25] },
      }),
    ).toEqual(["20", "19", "25"]);
    expect(visitLabelsFor("switching", base)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("doublePattern: the visit's own pattern, cycling", () => {
    const config = {
      patterns: [
        [16, 8],
        [20, 10, 5],
      ],
    };
    const labels = (visitIndex: number) =>
      visitLabelsFor("doublePattern", { ...base, config, visitIndex });
    expect(labels(0)).toEqual(["D16", "D8"]);
    expect(labels(1)).toEqual(["D20", "D10", "D5"]);
    expect(labels(2)).toEqual(["D16", "D8"]);
    expect(visitLabelsFor("doublePattern", base)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    expect(
      visitLabelsFor("doublePattern", { ...base, config: { patterns: [] } }),
    ).toEqual([undefined, undefined, undefined]);
  });

  it("targetScoring: three captions of the current target, the bull as Bull", () => {
    expect(
      visitLabelsFor("targetScoring", { ...base, currentTargetNumber: 25 }),
    ).toEqual(["Bull", "Bull", "Bull"]);
    expect(
      visitLabelsFor("targetScoring", { ...base, currentTargetNumber: 19 }),
    ).toEqual(["19", "19", "19"]);
  });

  it("switchingTargetScoring: the sequence cycles from the open visit's first target", () => {
    const config = { targets: [20, 19, 25] };
    const labels = (targetIndex: number, dartsInOpenVisit: number) =>
      visitLabelsFor("switchingTargetScoring", {
        ...base,
        config,
        targetIndex,
        dartsInOpenVisit,
      });
    expect(labels(0, 0)).toEqual(["20", "19", "Bull"]);
    expect(labels(1, 1)).toEqual(["20", "19", "Bull"]);
    expect(labels(0, 2)).toEqual(["19", "Bull", "20"]);
    expect(visitLabelsFor("switchingTargetScoring", base)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});
