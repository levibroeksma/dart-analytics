import { describe, it, expect } from "vitest";
import {
  visitPreview,
  bullUpPreview,
  cycleFrom,
  exerciseFamily,
  judgeDart,
  visitLabelsFor,
  chipPage,
  windowIndex,
  windowPage,
} from "@lib/training/routines/exercise-preview";
import type { DartFact, DartZoneKey, TurnFact } from "@modules/types";

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

describe("chipPage", () => {
  const halveIt = [
    "20",
    "16",
    "Any\u00a0double",
    "17",
    "18",
    "Any\u00a0treble",
    "19",
    "20",
    "BULL",
  ];

  it("fills a page with short labels up to six", () => {
    const labels = ["20", "19", "18", "17", "16", "15", "14", "13"];

    expect(chipPage(labels, 0)).toEqual({
      chips: labels.slice(0, 6),
      index: 0,
    });
    expect(chipPage(labels, 7)).toEqual({ chips: ["14", "13"], index: 1 });
  });

  it("fits six three-character labels on one page", () => {
    const labels = ["D20", "D19", "D18", "D17", "D16", "D15", "D14"];

    expect(chipPage(labels, 5).chips).toHaveLength(6);
  });

  it("breaks a page early when wide labels would overflow the row", () => {
    expect(chipPage(halveIt, 0).chips).toEqual(halveIt.slice(0, 5));
    expect(chipPage(halveIt, 4)).toEqual({
      chips: halveIt.slice(0, 5),
      index: 4,
    });
  });

  it("starts the next page at the label that did not fit", () => {
    expect(chipPage(halveIt, 5)).toEqual({
      chips: halveIt.slice(5),
      index: 0,
    });
    expect(chipPage(halveIt, 8)).toEqual({ chips: halveIt.slice(5), index: 3 });
  });

  it("clamps an out-of-range focus to the list", () => {
    expect(chipPage(halveIt, 99).chips).toEqual(halveIt.slice(5));
    expect(chipPage(halveIt, -1).index).toBe(0);
  });

  it("returns nothing for an empty list", () => {
    expect(chipPage([], 0)).toEqual({ chips: [], index: 0 });
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
    switchingChainEngine: null,
    scoreThresholdEngine: null,
    bullseyeCheckoutEngine: null,
    checkoutSequenceEngine: null,
    randomCheckoutEngine: null,
    hitCountEngine: null,
    switchbladeEngine: null,
    doublesLockEngine: null,
    halveItEngine: null,
    snakesLaddersEngine: null,
  };
  const engine = {} as never;

  it("is null while no exercise engine is open", () => {
    expect(exerciseFamily(none)).toBeNull();
  });

  it.each([
    ["switchingEngine", "switching"],
    ["doublePatternEngine", "doublePattern"],
    ["targetScoringEngine", "targetScoring"],
    ["switchingChainEngine", "switchingChain"],
    ["scoreThresholdEngine", "freeAim"],
    ["checkoutSequenceEngine", "freeAim"],
    ["randomCheckoutEngine", "freeAim"],
    ["bullseyeCheckoutEngine", "bullseye"],
  ] as const)("maps %s to %s", (key, family) => {
    expect(exerciseFamily({ ...none, [key]: engine })).toBe(family);
  });

  it("maps hitCountEngine to hitCount", () => {
    expect(exerciseFamily({ ...none, hitCountEngine: engine })).toBe(
      "hitCount",
    );
  });

  it("maps switchbladeEngine to switchblade", () => {
    expect(exerciseFamily({ ...none, switchbladeEngine: engine })).toBe(
      "switchblade",
    );
  });

  it("maps the open Doubles Lock engine to its family", () => {
    expect(exerciseFamily({ ...none, doublesLockEngine: {} as never })).toBe(
      "doublesLock",
    );
  });

  it("maps the open Snakes & Ladders engine to the hitCount family", () => {
    expect(exerciseFamily({ ...none, snakesLaddersEngine: {} as never })).toBe(
      "hitCount",
    );
  });

  it("maps the open Halve-It engine to its family", () => {
    expect(exerciseFamily({ ...none, halveItEngine: {} as never })).toBe(
      "halveIt",
    );
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

  it("switchingChain: judged as targetScoring", () => {
    const treble = dart({ intendedTargetNumber: 20, hitZoneKey: "TREBLE" });
    const double = dart({ intendedTargetNumber: 20, hitZoneKey: "DOUBLE" });
    expect(judgeDart("switchingChain", treble)).toBe("hit");
    expect(judgeDart("switchingChain", double)).toBe("miss");
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

  it("switchingChain: the sequence cycles from the open visit's first target", () => {
    const config = { targets: [20, 19, 25] };
    const labels = (targetIndex: number, dartsInOpenVisit: number) =>
      visitLabelsFor("switchingChain", {
        ...base,
        config,
        targetIndex,
        dartsInOpenVisit,
      });
    expect(labels(0, 0)).toEqual(["20", "19", "Bull"]);
    expect(labels(1, 1)).toEqual(["20", "19", "Bull"]);
    expect(labels(0, 2)).toEqual(["19", "Bull", "20"]);
    expect(visitLabelsFor("switchingChain", base)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("Hit Count preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
    intendedZoneKey: DartZoneKey,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey,
    }) as DartFact;

  it("judges a hit only in the intended bed", () => {
    expect(judgeDart("hitCount", aimed(20, "TREBLE", 20, "TREBLE"))).toBe(
      "hit",
    );
    expect(judgeDart("hitCount", aimed(20, "SINGLE", 20, "TREBLE"))).toBe(
      "miss",
    );
    expect(
      judgeDart("hitCount", aimed(25, "OUTER_BULL", 25, "INNER_BULL")),
    ).toBe("miss");
  });

  it("captions every slot with the current target", () => {
    expect(
      visitLabelsFor("hitCount", {
        config: null,
        visitIndex: 0,
        currentTargetNumber: undefined,
        currentTargetLabel: "T19",
        targetIndex: 1,
        dartsInOpenVisit: 0,
      }),
    ).toEqual(["T19", "T19", "T19"]);
  });
});

describe("SwitchBlade preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
    intendedZoneKey: DartZoneKey,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey,
    }) as DartFact;

  it("judges a hit on the slot's number in any ring, either bull on 25", () => {
    expect(judgeDart("switchblade", aimed(20, "SINGLE", 20, "TREBLE"))).toBe(
      "hit",
    );
    expect(judgeDart("switchblade", aimed(19, "TREBLE", 20, "TREBLE"))).toBe(
      "miss",
    );
    expect(
      judgeDart("switchblade", aimed(25, "OUTER_BULL", 25, "INNER_BULL")),
    ).toBe("hit");
  });

  it("captions the round's three slots, wrapping every five rounds", () => {
    const input = (visitIndex: number) => ({
      config: {},
      visitIndex,
      currentTargetNumber: undefined,
      targetIndex: 0,
      dartsInOpenVisit: 0,
    });
    expect(visitLabelsFor("switchblade", input(1))).toEqual([
      "T20",
      "T20",
      "T19",
    ]);
    expect(visitLabelsFor("switchblade", input(4))).toEqual([
      "T20",
      "T20",
      "BULL",
    ]);
    expect(visitLabelsFor("switchblade", input(5))).toEqual([
      "T20",
      "T20",
      "T20",
    ]);
  });
});

describe("Doubles Lock preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey: "DOUBLE",
    }) as DartFact;

  it("judges a hit only in the intended double", () => {
    expect(judgeDart("doublesLock", aimed(20, "DOUBLE", 20))).toBe("hit");
    expect(judgeDart("doublesLock", aimed(20, "SINGLE", 20))).toBe("miss");
    expect(judgeDart("doublesLock", aimed(19, "DOUBLE", 20))).toBe("miss");
  });

  it("captions the visit with the current double", () => {
    expect(
      visitLabelsFor("doublesLock", {
        config: {},
        visitIndex: 0,
        currentTargetNumber: undefined,
        currentTargetLabel: "D18",
        targetIndex: 0,
        dartsInOpenVisit: 0,
      }),
    ).toEqual(["D18", "D18", "D18"]);
  });
});

describe("Halve-It preview", () => {
  const thrown = (hitTargetNumber: number | null, hitZoneKey: DartZoneKey) =>
    dart({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber: null,
      intendedZoneKey: null,
    });

  it("judges each visit against its own round's target", () => {
    expect(judgeDart("halveIt", thrown(20, "TREBLE"), 0)).toBe("hit");
    expect(judgeDart("halveIt", thrown(5, "SINGLE"), 0)).toBe("miss");
    expect(judgeDart("halveIt", thrown(25, "INNER_BULL"), 2)).toBe("hit");
    expect(judgeDart("halveIt", thrown(25, "OUTER_BULL"), 2)).toBe("miss");
    expect(judgeDart("halveIt", thrown(25, "OUTER_BULL"), 8)).toBe("hit");
  });

  it("judges a wrapped visit against 20", () => {
    expect(judgeDart("halveIt", thrown(20, "SINGLE"), 9)).toBe("hit");
    expect(judgeDart("halveIt", thrown(25, "INNER_BULL"), 9)).toBe("miss");
  });

  it("captions the visit with its round's target", () => {
    const input = {
      config: {},
      currentTargetNumber: undefined,
      targetIndex: 0,
      dartsInOpenVisit: 0,
    };
    expect(visitLabelsFor("halveIt", { ...input, visitIndex: 2 })).toEqual([
      "Any double",
      "Any double",
      "Any double",
    ]);
    expect(visitLabelsFor("halveIt", { ...input, visitIndex: 17 })).toEqual([
      "BULL",
      "BULL",
      "BULL",
    ]);
  });

  it("visitPreview hands each dart's visit index to the judge", () => {
    const seen: number[] = [];
    visitPreview({
      turns: [turn([dart()]), turn([dart()])],
      visitLabels: () => ["a", "b", "c"],
      judge: (_dart, _index, visitIndex) => {
        seen.push(visitIndex);
        return "hit";
      },
    });
    expect(seen).toEqual([1]);
  });
});

describe("Snakes & Ladders preview", () => {
  const aimed = (
    hitTargetNumber: number | null,
    hitZoneKey: DartZoneKey,
    intendedTargetNumber: number,
    intendedZoneKey: DartZoneKey,
  ) =>
    ({
      hitTargetNumber,
      hitZoneKey,
      intendedTargetNumber,
      intendedZoneKey,
    }) as DartFact;

  it("judges a bullseye at the bull level as a hit and the outer bull as a miss", () => {
    expect(
      judgeDart("hitCount", aimed(25, "INNER_BULL", 25, "INNER_BULL")),
    ).toBe("hit");
    expect(
      judgeDart("hitCount", aimed(25, "OUTER_BULL", 25, "INNER_BULL")),
    ).toBe("miss");
  });

  it("judges only the intended double", () => {
    expect(judgeDart("hitCount", aimed(7, "DOUBLE", 7, "DOUBLE"))).toBe("hit");
    expect(judgeDart("hitCount", aimed(7, "DOUBLE", 8, "DOUBLE"))).toBe("miss");
  });

  it("captions every slot with the current level", () => {
    expect(
      visitLabelsFor("hitCount", {
        config: null,
        visitIndex: 0,
        currentTargetNumber: undefined,
        currentTargetLabel: "D4",
        targetIndex: 3,
        dartsInOpenVisit: 0,
      }),
    ).toEqual(["D4", "D4", "D4"]);
  });
});
