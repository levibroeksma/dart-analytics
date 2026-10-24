import { describe, expect, it } from "vitest";
import {
  duelWinningSideKey,
  marksPlayAccessors,
} from "@lib/game/marks-play.data";
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
