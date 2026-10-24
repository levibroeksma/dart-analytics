import { describe, expect, it } from "vitest";
import {
  duelWinningSideKey,
  marksPlayAccessors,
  marksPreviewSegments,
  marksTapObservation,
  recordMarksMiss,
  recordMarksTap,
  resumeMarksEngine,
  toggleMarksRing,
} from "@lib/game/marks-play.data";
import type { DartObservation } from "@modules/types";
import type { MarksSeatState } from "@modules/types";

const OBJECTIVES = [20, 25, "CAT"] as const;

type TestSeat = MarksSeatState & { points: number };

function seat(
  ref: string,
  marks: number[],
  extra: { points?: number; dartsThrown?: number } = {},
): TestSeat {
  return {
    participantRef: ref,
    sideKey: ref === "p1" ? "A" : "B",
    marks,
    closedAtDart: marks.map(() => null),
    objectiveHits: marks.map(() => 0),
    trebleHits: 0,
    dartsThrown: extra.dartsThrown ?? 0,
    dartsThisVisit: 0,
    status: "IN_PROGRESS",
    points: extra.points ?? 0,
  };
}

const accessors = marksPlayAccessors(OBJECTIVES, String);
const NAMES = { p1: "Levi", p2: "Guest" } as const;

function context(
  seats: TestSeat[] | null,
  winningSideKey: string | null = null,
) {
  return {
    state: () => (seats ? { seats } : null),
    resultsSnapshot: { winningSideKey },
    $store: {
      game: {
        configSnapshot: seats ? { seats } : null,
        seats: (seats ?? []).map((candidate) => ({
          participantRef: candidate.participantRef,
          sideKey: candidate.sideKey,
          displayName:
            NAMES[candidate.participantRef as keyof typeof NAMES] ?? "?",
        })),
      },
    },
  };
}

const rowsFor = (seats: TestSeat[], ref: string | undefined) =>
  accessors.objectiveRowsFor.call(context(seats), ref);

describe("objectiveRowsFor", () => {
  it("leaves the opponent fields and flags off in a solo game", () => {
    const [row] = rowsFor([seat("p1", [3, 0, 0])], "p1");
    expect(row).toEqual({
      label: "20",
      objective: 20,
      marks: 3,
      closed: true,
      opponentMarks: null,
      scoring: false,
      dead: false,
    });
  });

  it("flags a closed number the opponent has open as scoring", () => {
    const [row] = rowsFor([seat("p1", [3, 0, 0]), seat("p2", [1, 0, 0])], "p1");
    expect(row).toMatchObject({
      scoring: true,
      dead: false,
      opponentMarks: 1,
    });
  });

  it("flags a number both seats closed as dead", () => {
    const [row] = rowsFor([seat("p1", [3, 0, 0]), seat("p2", [3, 0, 0])], "p1");
    expect(row).toMatchObject({ scoring: false, dead: true });
  });

  it("never flags a category objective", () => {
    const rows = rowsFor([seat("p1", [0, 0, 3]), seat("p2", [0, 0, 3])], "p1");
    expect(rows[2]).toMatchObject({ scoring: false, dead: false });
  });

  it("returns empty rows for an unknown or missing ref", () => {
    const seats = [seat("p1", [3, 3, 3]), seat("p2", [3, 3, 3])];
    for (const ref of [undefined, "nobody"]) {
      expect(rowsFor(seats, ref)[0]).toMatchObject({
        marks: 0,
        closed: false,
      });
    }
  });
});

describe("duelWinningSideKey", () => {
  const seats = [
    { participantRef: "p1", sideKey: "A" },
    { participantRef: "p2", sideKey: "B" },
  ];

  it("returns the winner's side key", () => {
    expect(duelWinningSideKey({ seats, winnerParticipantRef: "p2" })).toBe("B");
  });

  it("returns null without a winner or for an unknown one", () => {
    expect(
      duelWinningSideKey({ seats, winnerParticipantRef: null }),
    ).toBeNull();
    expect(duelWinningSideKey({ seats, winnerParticipantRef: "x" })).toBeNull();
  });
});

describe("seat accessors", () => {
  const seats = [
    seat("p1", [3, 3, 1], { points: 40, dartsThrown: 9 }),
    seat("p2", [0, 0, 0]),
  ];

  it("reads points, closed count and darts for a seat", () => {
    const ctx = context(seats);
    expect(accessors.pointsFor.call(ctx, "p1")).toBe("40");
    expect(accessors.closedCountFor.call(ctx, "p1")).toBe("2");
    expect(accessors.dartsThrownFor.call(ctx, "p1")).toBe("9");
  });

  it.each([
    [null, "p1"],
    [seats, "nobody"],
    [seats, undefined],
  ])("reads zero for a null state or unknown ref", (value, ref) => {
    const ctx = context(value);
    expect(accessors.pointsFor.call(ctx, ref)).toBe("0");
    expect(accessors.closedCountFor.call(ctx, ref)).toBe("0");
    expect(accessors.dartsThrownFor.call(ctx, ref)).toBe("0");
  });

  it("reads the first seat's darts for the solo count", () => {
    expect(accessors.dartsThrown.call(context(seats))).toBe("9");
    expect(accessors.dartsThrown.call(context(null))).toBe("0");
  });
});

describe("subtitle", () => {
  it("is blank before config loads", () => {
    expect(accessors.subtitle.call(context(null))).toBe("");
  });

  it("reads SOLO for one seat and 1V1 for more", () => {
    expect(accessors.subtitle.call(context([seat("p1", [0, 0, 0])]))).toBe(
      "SOLO · 3 OBJECTIVES",
    );
    expect(
      accessors.subtitle.call(
        context([seat("p1", [0, 0, 0]), seat("p2", [0, 0, 0])]),
      ),
    ).toBe("1V1 · 3 OBJECTIVES");
  });
});

describe("resultsTitle", () => {
  const solo = [seat("p1", [3, 3, 3])];
  const duel = [seat("p1", [0, 0, 0]), seat("p2", [0, 0, 0])];

  it("celebrates the close-out in a solo game", () => {
    expect(accessors.resultsTitle.call(context(solo))).toBe("Closed out!");
  });

  it("names the winner of a duel", () => {
    expect(accessors.resultsTitle.call(context(duel, "B"))).toBe("Guest wins!");
  });

  it("falls back to Game over without a winner", () => {
    expect(accessors.resultsTitle.call(context(duel, null))).toBe("Game over");
  });
});

describe("marksTapObservation", () => {
  it.each([
    [20, "SINGLE", { hitTargetNumber: 20, hitZoneKey: "SINGLE" }],
    [15, "TREBLE", { hitTargetNumber: 15, hitZoneKey: "TREBLE" }],
    [7, "DOUBLE", { hitTargetNumber: 7, hitZoneKey: "DOUBLE" }],
    [25, "SINGLE", { hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" }],
    [25, "DOUBLE", { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" }],
  ] as const)("maps %i + %s", (number, ring, expected) => {
    expect(marksTapObservation(number, ring)).toEqual({
      ...expected,
      locationX: null,
      locationY: null,
    });
  });

  it("rejects a treble bull", () => {
    expect(() => marksTapObservation(25, "TREBLE")).toThrow(
      "The bull has no treble ring.",
    );
  });
});

describe("toggleMarksRing", () => {
  it("selects a ring, and a second tap returns to SINGLE", () => {
    const ctx = { ring: "SINGLE" as const } as { ring: "SINGLE" | "DOUBLE" };
    toggleMarksRing(ctx, "DOUBLE");
    expect(ctx.ring).toBe("DOUBLE");
    toggleMarksRing(ctx, "DOUBLE");
    expect(ctx.ring).toBe("SINGLE");
  });
});

function tapContext(
  over: Partial<{ engine: unknown; finished: boolean }> = {},
) {
  const committed: DartObservation[] = [];
  return {
    committed,
    engine: {} as unknown,
    finished: false,
    ring: "TREBLE" as "SINGLE" | "DOUBLE" | "TREBLE",
    commitDart: async (o: DartObservation) => {
      committed.push(o);
    },
    ...over,
  };
}

describe("recordMarksTap", () => {
  it("commits the tapped number with the selected ring, then resets the ring", async () => {
    const ctx = tapContext();
    await recordMarksTap(ctx, 20);
    expect(ctx.committed).toEqual([marksTapObservation(20, "TREBLE")]);
    expect(ctx.ring).toBe("SINGLE");
  });

  it("records a single bull for a treble-bull tap", async () => {
    const ctx = tapContext();
    await recordMarksTap(ctx, 25);
    expect(ctx.committed[0].hitZoneKey).toBe("OUTER_BULL");
  });

  it("ignores a tap with no engine or a finished game", async () => {
    const noEngine = tapContext({ engine: null });
    await recordMarksTap(noEngine, 20);
    const done = tapContext({ finished: true });
    await recordMarksTap(done, 20);
    expect(noEngine.committed).toEqual([]);
    expect(done.committed).toEqual([]);
  });
});

describe("recordMarksMiss", () => {
  it("commits a miss and resets the ring", async () => {
    const ctx = tapContext();
    await recordMarksMiss(ctx);
    expect(ctx.committed).toEqual([
      {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      },
    ]);
    expect(ctx.ring).toBe("SINGLE");
  });

  it("ignores a miss once finished", async () => {
    const ctx = tapContext({ finished: true });
    await recordMarksMiss(ctx);
    expect(ctx.committed).toEqual([]);
  });
});

describe("marksPreviewSegments", () => {
  const dart = (n: number | null): DartObservation => ({
    hitTargetNumber: n,
    hitZoneKey: n === null ? "MISS" : "SINGLE",
    locationX: null,
    locationY: null,
  });
  const turn = (key: string, done: boolean, darts: DartObservation[]) =>
    ({ clientKey: key, completedAt: done ? "t" : null, darts }) as never;

  it("shows hit and miss for the open visit, padded to three", () => {
    const segments = marksPreviewSegments(
      [turn("a", false, [dart(20), dart(null)])],
      null,
      (o) => o.hitTargetNumber !== null,
    );
    expect(segments).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

  it("is empty while the open visit is the hidden one", () => {
    const segments = marksPreviewSegments(
      [turn("a", false, [dart(20)])],
      "a",
      () => true,
    );
    expect(segments).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});

describe("resumeMarksEngine", () => {
  class FakeEngine {}
  const isFake = (engine: unknown): engine is FakeEngine =>
    engine instanceof FakeEngine;
  const game = (over: object) =>
    ({
      configSnapshot: {},
      rulesetVersionKey: "CRICKET_V1",
      stages: [],
      turns: [],
      ...over,
    }) as never;

  it("returns null without a snapshot or for a non-resumable ruleset", () => {
    const resumable = new Set(["CRICKET_V1"]) as never;
    expect(
      resumeMarksEngine(game({ configSnapshot: null }), resumable, isFake),
    ).toBeNull();
    expect(
      resumeMarksEngine(
        game({ rulesetVersionKey: "501_V2" }),
        resumable,
        isFake,
      ),
    ).toBeNull();
  });
});
