import { describe, expect, it } from "vitest";
import {
  closedCountText,
  dartsThrownText,
  duelWinningSideKey,
  markRowsFor,
  marksResultsTitle,
  marksSubtitle,
  seatByRef,
  seatPointsText,
} from "@lib/game/marks-play.data";
import type { MarksSeatState } from "@modules/types";

const OBJECTIVES = [20, 25, "CAT"] as const;

function seat(
  ref: string,
  marks: number[],
  extra: { points?: number; dartsThrown?: number } = {},
): MarksSeatState & { points: number } {
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

const rowsFor = (seats: ReturnType<typeof seat>[], ref: string | undefined) =>
  markRowsFor({ seats }, ref, OBJECTIVES, String);

describe("markRowsFor", () => {
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

describe("seat accessors", () => {
  const state = {
    seats: [
      seat("p1", [3, 3, 1], { points: 40, dartsThrown: 9 }),
      seat("p2", [0, 0, 0]),
    ],
  };

  it("finds a seat by participant ref", () => {
    expect(seatByRef(null, "p1")).toBeUndefined();
    expect(seatByRef(state, "p2")?.participantRef).toBe("p2");
  });

  it("reads points, closed count and darts for a seat", () => {
    expect(seatPointsText(state, "p1")).toBe("40");
    expect(closedCountText(state, "p1")).toBe("2");
    expect(dartsThrownText(state, "p1")).toBe("9");
  });

  it.each([
    [null, "p1"],
    [state, "nobody"],
    [state, undefined],
  ])("reads zero for a null state or unknown ref", (value, ref) => {
    expect(seatPointsText(value, ref)).toBe("0");
    expect(closedCountText(value, ref)).toBe("0");
    expect(dartsThrownText(value, ref)).toBe("0");
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

describe("marksSubtitle", () => {
  it("reads SOLO for one seat and 1V1 for more", () => {
    expect(marksSubtitle(1, 7)).toBe("SOLO · 7 OBJECTIVES");
    expect(marksSubtitle(2, 9)).toBe("1V1 · 9 OBJECTIVES");
  });
});

describe("marksResultsTitle", () => {
  const solo = [{ participantRef: "p1", sideKey: "A", displayName: "Levi" }];
  const duel = [
    ...solo,
    { participantRef: "p2", sideKey: "B", displayName: "Guest" },
  ];

  it("celebrates the close-out in a solo game", () => {
    expect(marksResultsTitle(solo, null)).toBe("Closed out!");
  });

  it("names the winner of a duel", () => {
    expect(marksResultsTitle(duel, "B")).toBe("Guest wins!");
  });

  it("falls back to Game over without a winner", () => {
    expect(marksResultsTitle(duel, null)).toBe("Game over");
  });
});
