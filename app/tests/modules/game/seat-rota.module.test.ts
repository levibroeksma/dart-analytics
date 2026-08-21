import { describe, expect, it } from "vitest";
import {
  activeSeat,
  seatOf,
  startingSeatFor,
} from "@modules/game/seat-rota.module";
import type { EngineFacts, StageFact, TurnFact } from "@modules/types";
import type { SeatFact } from "@lib/types";

function seats(count: number): SeatFact[] {
  return Array.from({ length: count }, (_unused, index) => ({
    participantRef: `p${index}`,
    displayName: `Player ${index}`,
    sideKey: String.fromCharCode(65 + index),
    participantTypeKey: index === 0 ? ("PLAYER" as const) : ("GUEST" as const),
  }));
}

function leg(sequence: number): StageFact {
  return {
    clientKey: `leg-${sequence}`,
    stageTypeKey: "LEG",
    parentClientKey: null,
    sequence,
  };
}

function turn(
  stageClientKey: string,
  sequence: number,
  participantRef: string,
  completed = true,
): TurnFact {
  return {
    clientKey: `${stageClientKey}-t${sequence}`,
    stageClientKey,
    participantRef,
    sequence,
    completedAt: completed ? "2026-08-20T10:00:00.000Z" : null,
    totalScore: 60,
    darts: [],
  };
}

describe("startingSeatFor", () => {
  it("rotates over seats and wraps at seatCount", () => {
    expect([0, 1, 2, 3].map((leg) => startingSeatFor(leg, 2))).toEqual([
      0, 1, 0, 1,
    ]);
    expect([0, 1, 2, 3].map((leg) => startingSeatFor(leg, 3))).toEqual([
      0, 1, 2, 0,
    ]);
    expect([0, 1, 2, 3, 4].map((leg) => startingSeatFor(leg, 4))).toEqual([
      0, 1, 2, 3, 0,
    ]);
  });

  it("keeps a single-seat session on seat 0 forever", () => {
    expect([0, 1, 2, 9].map((leg) => startingSeatFor(leg, 1))).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe("seatOf", () => {
  it("resolves a turn to the seat that threw it", () => {
    const roster = seats(3);
    expect(seatOf(turn("leg-1", 1, "p2"), roster)).toBe(roster[2]);
  });

  it("throws for a ref that is not a seat", () => {
    expect(() => seatOf(turn("leg-1", 1, "ghost"), seats(2))).toThrow(/ghost/);
  });
});

describe("activeSeat under SHARED stages", () => {
  it("starts leg 1 on seat 0 and advances one seat per completed visit", () => {
    const roster = seats(2);
    const facts: EngineFacts = { stages: [leg(1)], turns: [] };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);

    facts.turns.push(turn("leg-1", 1, "p0"));
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[1]);

    facts.turns.push(turn("leg-1", 2, "p1"));
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);
  });

  it("starts leg 2 on seat 1 and leg 3 back on seat 0", () => {
    const roster = seats(2);
    const legTwo: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [turn("leg-1", 1, "p0")],
    };
    expect(activeSeat(legTwo, roster, "SHARED")).toBe(roster[1]);

    const legThree: EngineFacts = {
      stages: [leg(1), leg(2), leg(3)],
      turns: [turn("leg-1", 1, "p0")],
    };
    expect(activeSeat(legThree, roster, "SHARED")).toBe(roster[0]);
  });

  it("holds the seat whose visit is still open", () => {
    const roster = seats(3);
    const facts: EngineFacts = {
      stages: [leg(1)],
      turns: [turn("leg-1", 1, "p0"), turn("leg-1", 2, "p1", false)],
    };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[1]);
  });

  it("counts only the open leg's turns, not the whole match", () => {
    const roster = seats(2);
    const facts: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [
        turn("leg-1", 1, "p0"),
        turn("leg-1", 2, "p1"),
        turn("leg-1", 3, "p0"),
        turn("leg-2", 1, "p1"),
      ],
    };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);
  });
});

describe("activeSeat under PER_SEAT stages", () => {
  it("advances one seat per completed turn across the whole log", () => {
    const roster = seats(2);
    const facts: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [turn("leg-1", 1, "p0")],
    };
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[1]);

    facts.turns.push(turn("leg-2", 1, "p1"));
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[0]);
  });

  it("holds the seat whose turn is still open", () => {
    const roster = seats(2);
    const facts: EngineFacts = {
      stages: [leg(1)],
      turns: [turn("leg-1", 1, "p0", false)],
    };
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[0]);
  });
});

describe("activeSeat with one seat", () => {
  it("reproduces solo behaviour under both stage shapes", () => {
    const roster = seats(1);
    const facts: EngineFacts = {
      stages: [leg(1), leg(2)],
      turns: [turn("leg-1", 1, "p0"), turn("leg-2", 1, "p0")],
    };
    expect(activeSeat(facts, roster, "SHARED")).toBe(roster[0]);
    expect(activeSeat(facts, roster, "PER_SEAT")).toBe(roster[0]);
  });
});
