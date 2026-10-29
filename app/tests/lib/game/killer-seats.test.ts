import { describe, it, expect } from "vitest";
import {
  killerSeatResult,
  outOrderNames,
  starterFirstNumbers,
} from "@lib/game/killer-seats";
import type { KillerSeatState } from "@modules/types";
import type { SeatFact } from "@lib/types";

const SEATS: SeatFact[] = [
  {
    participantRef: "p1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER",
  },
  {
    participantRef: "p2",
    displayName: "Guest",
    sideKey: "B",
    participantTypeKey: "GUEST",
  },
];

function seat(overrides: Partial<KillerSeatState> = {}): KillerSeatState {
  return {
    participantRef: "p1",
    sideKey: "A",
    number: 20,
    lives: 2,
    killer: true,
    out: false,
    livesTaken: 3,
    dartsToKiller: 4,
    dartsThrown: 9,
    ...overrides,
  };
}

describe("starterFirstNumbers", () => {
  it("keeps order for starter 0 and swaps for starter 1", () => {
    expect(starterFirstNumbers([20, 19], 0)).toEqual([20, 19]);
    expect(starterFirstNumbers([20, 19], 1)).toEqual([19, 20]);
  });

  it("does not mutate input", () => {
    const input = [20, 19];
    starterFirstNumbers(input, 1);
    expect(input).toEqual([20, 19]);
  });
});

describe("killerSeatResult", () => {
  it("maps seat state to a result", () => {
    expect(killerSeatResult(seat())).toEqual({
      participantRef: "p1",
      sideKey: "A",
      number: 20,
      livesLeft: 2,
      livesTaken: 3,
      dartsToKiller: 4,
      out: false,
    });
  });

  it("keeps null dartsToKiller", () => {
    expect(killerSeatResult(seat({ dartsToKiller: null })).dartsToKiller).toBe(
      null,
    );
  });
});

describe("outOrderNames", () => {
  it("joins display names", () => {
    expect(outOrderNames(["p2"], SEATS)).toBe("Guest");
    expect(outOrderNames(["p2", "p1"], SEATS)).toBe("Guest → Levi");
  });

  it("falls back to the raw participant ref when the seat is missing", () => {
    expect(outOrderNames(["gone", "p1"], SEATS)).toBe("gone → Levi");
  });

  it("is empty for none", () => {
    expect(outOrderNames([], SEATS)).toBe("");
  });
});
