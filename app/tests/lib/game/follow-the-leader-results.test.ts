import { describe, it, expect } from "vitest";
import {
  followTheLeaderResultsSnapshot,
  followTheLeaderSeatResult,
} from "@lib/game/follow-the-leader-results";
import type {
  FollowTheLeaderSeatState,
  FollowTheLeaderState,
} from "@modules/types";

function seat(
  overrides: Partial<FollowTheLeaderSeatState> = {},
): FollowTheLeaderSeatState {
  return {
    participantRef: "p1",
    sideKey: "A",
    lives: 2,
    out: false,
    dartsThrown: 7,
    ...overrides,
  } as FollowTheLeaderSeatState;
}

function state(
  overrides: Partial<FollowTheLeaderState> = {},
): FollowTheLeaderState {
  return {
    status: "COMPLETE",
    winningSideKey: "A",
    outOrder: ["p2"],
    seats: [
      seat(),
      seat({ participantRef: "p2", sideKey: "B", lives: 0, out: true }),
    ],
    ...overrides,
  } as FollowTheLeaderState;
}

describe("followTheLeaderSeatResult", () => {
  it("maps lives and out flag", () => {
    expect(followTheLeaderSeatResult(seat())).toEqual({
      participantRef: "p1",
      sideKey: "A",
      livesLeft: 2,
      out: false,
    });
  });

  it("keeps an out seat at zero lives", () => {
    expect(
      followTheLeaderSeatResult(seat({ lives: 0, out: true })),
    ).toMatchObject({ livesLeft: 0, out: true });
  });
});

describe("followTheLeaderResultsSnapshot", () => {
  it("win: names winner, out order and lives per seat, winner included", () => {
    expect(followTheLeaderResultsSnapshot(state())).toEqual({
      status: "COMPLETE",
      winningSideKey: "A",
      outOrder: ["p2"],
      seats: [
        { participantRef: "p1", sideKey: "A", livesLeft: 2, out: false },
        { participantRef: "p2", sideKey: "B", livesLeft: 0, out: true },
      ],
    });
  });

  it("abandoned: no winner, nobody out", () => {
    const snapshot = followTheLeaderResultsSnapshot(
      state({
        status: "IN_PROGRESS",
        winningSideKey: null,
        outOrder: [],
        seats: [
          seat({ lives: 3 }),
          seat({ participantRef: "p2", sideKey: "B", lives: 3 }),
        ],
      }),
    );
    expect(snapshot.winningSideKey).toBeNull();
    expect(snapshot.outOrder).toEqual([]);
    expect(snapshot.seats.map((s) => s.livesLeft)).toEqual([3, 3]);
  });

  it("copies the out order", () => {
    const input = state();
    const snapshot = followTheLeaderResultsSnapshot(input);
    snapshot.outOrder.push("x");
    expect(input.outOrder).toEqual(["p2"]);
  });
});
