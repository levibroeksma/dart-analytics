import { describe, it, expect } from "vitest";
import { singlesTrainingResultsTitle } from "@lib/game/singles-training-results-title";

describe("singlesTrainingResultsTitle", () => {
  const soloSeats = [
    {
      participantRef: "p1",
      sideKey: "A",
      displayName: "Levi",
      participantTypeKey: "PLAYER" as const,
    },
  ];
  const matchSeats = [
    ...soloSeats,
    {
      participantRef: "p2",
      sideKey: "B",
      displayName: "Opponent",
      participantTypeKey: "GUEST" as const,
    },
  ];

  it("returns the solo-session miss title when the solo owner lost", () => {
    const resultsSnapshot = {
      winningSideKey: null,
      seats: [{ participantRef: "p1", status: "LOST" as const }],
    };
    expect(singlesTrainingResultsTitle(soloSeats, resultsSnapshot)).toBe(
      "Game over",
    );
  });

  it("returns the 1v1 miss title when the owner lost", () => {
    const resultsSnapshot = {
      winningSideKey: "B",
      seats: [
        { participantRef: "p1", status: "LOST" as const },
        { participantRef: "p2", status: "WON" as const },
      ],
    };
    expect(singlesTrainingResultsTitle(matchSeats, resultsSnapshot)).toBe(
      "Game over",
    );
  });

  it("names the opponent who missed when the owner won", () => {
    const resultsSnapshot = {
      winningSideKey: "A",
      seats: [
        { participantRef: "p1", status: "WON" as const },
        { participantRef: "p2", status: "LOST" as const },
      ],
    };
    expect(singlesTrainingResultsTitle(matchSeats, resultsSnapshot)).toBe(
      "Opponent missed the target.",
    );
  });

  it("returns the tie title when the owner tied", () => {
    const resultsSnapshot = {
      winningSideKey: null,
      seats: [
        { participantRef: "p1", status: "TIE" as const },
        { participantRef: "p2", status: "TIE" as const },
      ],
    };
    expect(singlesTrainingResultsTitle(matchSeats, resultsSnapshot)).toBe(
      "It's a tie!",
    );
  });

  it("falls back to the score-compare winner title on COMPLETE status", () => {
    const resultsSnapshot = {
      winningSideKey: "B",
      seats: [
        { participantRef: "p1", status: "COMPLETE" as const },
        { participantRef: "p2", status: "COMPLETE" as const },
      ],
    };
    expect(singlesTrainingResultsTitle(matchSeats, resultsSnapshot)).toBe(
      "Opponent wins!",
    );
  });

  it("returns the solo-complete fallback when there is no snapshot", () => {
    expect(singlesTrainingResultsTitle(soloSeats, null)).toBe(
      "Session complete",
    );
  });
});
