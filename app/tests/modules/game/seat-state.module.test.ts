import { describe, it, expect } from "vitest";
import {
  activeSeatState,
  completedByIndex,
  durationSeatComplete,
  foldSeatStates,
  otherSeatsComplete,
} from "@modules/game/seat-state.module";
import type { SeatFact } from "@lib/types";
import type { DartFact, DartObservation, TurnFact } from "@modules/types";

function seat(participantRef: string, sideKey: string): SeatFact {
  return {
    participantRef,
    displayName: participantRef,
    sideKey,
    participantTypeKey: "PLAYER",
  };
}

function dart(score: number): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: 20,
    hitZoneKey: "SINGLE",
    score,
    locationX: null,
    locationY: null,
  };
}

function turn(participantRef: string, darts: DartFact[]): TurnFact {
  return {
    clientKey: `turn-${participantRef}-${darts.length}`,
    stageClientKey: "block-1",
    participantRef,
    sequence: 1,
    completedAt: null,
    totalScore: 0,
    darts,
  };
}

type Progress = { participantRef: string; sideKey: string; total: number };

const seats = [seat("p1", "A"), seat("p2", "B")];

function initialProgress(from: SeatFact): Progress {
  return {
    participantRef: from.participantRef,
    sideKey: from.sideKey,
    total: 0,
  };
}

function addScore(state: Progress, observation: DartObservation): Progress {
  return {
    ...state,
    total: state.total + (observation.hitZoneKey === "MISS" ? 0 : 1),
  };
}

describe("foldSeatStates", () => {
  it("replays each seat through only its own turns", () => {
    const turns = [
      turn("p1", [dart(20), dart(20)]),
      turn("p2", [dart(20)]),
      turn("p1", [dart(20)]),
    ];

    expect(foldSeatStates(turns, seats, initialProgress, addScore)).toEqual([
      { participantRef: "p1", sideKey: "A", total: 3 },
      { participantRef: "p2", sideKey: "B", total: 1 },
    ]);
  });

  it("returns the starting shape for a seat that has thrown nothing", () => {
    expect(foldSeatStates([], seats, initialProgress, addScore)).toEqual([
      { participantRef: "p1", sideKey: "A", total: 0 },
      { participantRef: "p2", sideKey: "B", total: 0 },
    ]);
  });

  it("hands the reducer the dart's own observation fields", () => {
    const seen: DartObservation[] = [];
    const miss: DartFact = {
      sequence: 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      score: 0,
      locationX: 1,
      locationY: 2,
    };

    foldSeatStates(
      [turn("p1", [miss])],
      [seats[0]],
      initialProgress,
      (state, observation) => {
        seen.push(observation);
        return state;
      },
    );

    expect(seen).toEqual([
      {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: 1,
        locationY: 2,
      },
    ]);
  });
});

describe("activeSeatState", () => {
  it("returns the seat the state names as active", () => {
    const state = {
      activeParticipantRef: "p2",
      seats: [
        { participantRef: "p1", sideKey: "A" },
        { participantRef: "p2", sideKey: "B" },
      ],
    };

    expect(activeSeatState(state).participantRef).toBe("p2");
  });

  it("returns the only seat of a solo session", () => {
    const state = {
      activeParticipantRef: "p1",
      seats: [{ participantRef: "p1", sideKey: "A" }],
    };

    expect(activeSeatState(state).sideKey).toBe("A");
  });
});

describe("durationSeatComplete", () => {
  it("ends a ROUNDS seat once it reaches its budget", () => {
    const rounds = { durationType: "ROUNDS", durationValue: 5 };

    expect(durationSeatComplete(rounds, 4, false)).toBe(false);
    expect(durationSeatComplete(rounds, 5, false)).toBe(true);
    expect(durationSeatComplete(rounds, 6, false)).toBe(true);
  });

  it("ends a MINUTES seat only once the timer expired AND it has played", () => {
    const minutes = { durationType: "MINUTES", durationValue: 5 };

    expect(durationSeatComplete(minutes, 3, false)).toBe(false);
    expect(durationSeatComplete(minutes, 0, true)).toBe(false);
    expect(durationSeatComplete(minutes, 1, true)).toBe(true);
  });
});

describe("completedByIndex", () => {
  const progress = [
    { participantRef: "p1", sideKey: "A" },
    { participantRef: "p2", sideKey: "B" },
  ];

  it("reads the flag at the candidate's own position", () => {
    const isComplete = completedByIndex(progress, [true, false]);

    expect(isComplete(seat("p1", "A"))).toBe(true);
    expect(isComplete(seat("p2", "B"))).toBe(false);
  });

  it("reports a candidate that is not in the fold as incomplete", () => {
    expect(completedByIndex(progress, [true, true])(seat("p9", "C"))).toBe(
      false,
    );
  });
});

describe("otherSeatsComplete", () => {
  const progress = [
    { participantRef: "p1", sideKey: "A", status: "IN_PROGRESS" },
    { participantRef: "p2", sideKey: "B", status: "COMPLETE" },
  ];
  const isComplete = (seat: (typeof progress)[number]) =>
    seat.status === "COMPLETE";

  it("ignores the named seat's own status", () => {
    expect(otherSeatsComplete(progress, "p1", isComplete)).toBe(true);
    expect(otherSeatsComplete(progress, "p2", isComplete)).toBe(false);
  });

  it("is vacuously true for a solo session", () => {
    expect(otherSeatsComplete([progress[0]], "p1", isComplete)).toBe(true);
  });

  it("uses the caller's own predicate instead of assuming a status field", () => {
    const budget = [
      { participantRef: "p1", sideKey: "A", attempts: 2 },
      { participantRef: "p2", sideKey: "B", attempts: 5 },
    ];
    const budgetComplete = (seat: (typeof budget)[number]) =>
      seat.attempts >= 5;

    expect(otherSeatsComplete(budget, "p1", budgetComplete)).toBe(true);
    expect(otherSeatsComplete(budget, "p2", budgetComplete)).toBe(false);
  });
});
