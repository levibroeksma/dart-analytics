import { describe, it, expect } from "vitest";
import { matchWinnerName } from "@lib/game/match-result-text";

const SEATS = [
  { participantRef: "p1", sideKey: "A", displayName: "Levi" },
  { participantRef: "p2", sideKey: "B", displayName: "Opponent" },
];

describe("matchWinnerName", () => {
  it("returns the winning seat's display name", () => {
    expect(matchWinnerName(SEATS, "B")).toBe("Opponent");
  });

  it("returns undefined when winningSideKey is null", () => {
    expect(matchWinnerName(SEATS, null)).toBeUndefined();
  });

  it("returns undefined for a solo session even with a winningSideKey set", () => {
    expect(matchWinnerName([SEATS[0]], "A")).toBeUndefined();
  });

  it("returns undefined when no seat matches the winning sideKey", () => {
    expect(matchWinnerName(SEATS, "C")).toBeUndefined();
  });
});
