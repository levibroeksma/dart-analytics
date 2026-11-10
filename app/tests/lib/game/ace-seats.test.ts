import { describe, it, expect, vi } from "vitest";
import {
  aceLastLabel,
  aceRoundResults,
  aceRoundRow,
  aceSeatResult,
  aceSeatTarget,
  aceTargetLabel,
  mintAceDrawSeed,
} from "@lib/game/ace-seats";
import { aceTargetFor } from "@modules/game/ace.engine.module";
import type { AceSnapshot, Seated } from "@lib/types";
import type { AceSeatState, DartFact, TurnFact } from "@modules/types";

const SEATS = [
  { participantRef: "p1", sideKey: "A" },
  { participantRef: "p2", sideKey: "B" },
];
const CONFIG = {
  rounds: 3,
  drawSeed: 7,
  seats: SEATS,
} as unknown as Seated<AceSnapshot>;

function turn(ref: string, index: number, darts: DartFact[]): TurnFact {
  return {
    clientKey: `${ref}-${index}`,
    participantRef: ref,
    darts,
    totalScore: 0,
    completedAt: null,
  } as unknown as TurnFact;
}

function onTarget(round: number, hitZoneKey: DartFact["hitZoneKey"]): DartFact {
  const target = aceTargetFor(CONFIG.drawSeed, round);
  return {
    hitTargetNumber: target,
    hitZoneKey: target === 25 ? "OUTER_BULL" : hitZoneKey,
    score: 0,
  } as unknown as DartFact;
}

const off = { hitTargetNumber: null, hitZoneKey: "MISS", score: 0 } as DartFact;

describe("aceTargetLabel", () => {
  it("names the bull, numbers the rest, dashes a finished seat", () => {
    expect(aceTargetLabel(25)).toBe("Bull");
    expect(aceTargetLabel(17)).toBe("17");
    expect(aceTargetLabel(null)).toBe("—");
  });
});

describe("aceSeatTarget", () => {
  it("is the seat's own next round, null after the last", () => {
    expect(aceSeatTarget({ visits: 1 }, CONFIG)).toBe(
      aceTargetFor(CONFIG.drawSeed, 1),
    );
    expect(aceSeatTarget({ visits: 3 }, CONFIG)).toBeNull();
  });
});

describe("mintAceDrawSeed", () => {
  it("returns a 32-bit integer from the crypto source", () => {
    const spy = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((array) => {
        (array as Uint32Array)[0] = 4294967295;
        return array;
      });
    expect(mintAceDrawSeed()).toBe(4294967295);
    spy.mockRestore();
    const real = mintAceDrawSeed();
    expect(Number.isInteger(real) && real >= 0 && real <= 0xffffffff).toBe(
      true,
    );
  });
});

describe("aceLastLabel", () => {
  it("is a dash before a closed round, then +points or 0", () => {
    expect(aceLastLabel({ stages: [], turns: [] }, CONFIG, "p1")).toBe("—");
    const closed = [
      turn("p1", 0, [onTarget(0, "TREBLE"), off, off]),
      turn("p2", 0, [off, off, off]),
    ];
    const facts = { stages: [], turns: closed };
    expect(aceLastLabel(facts, CONFIG, "p1")).toMatch(/^\+\d$/);
    expect(aceLastLabel(facts, CONFIG, "p2")).toBe("0");
  });

  it("ignores an open visit", () => {
    const facts = {
      stages: [],
      turns: [turn("p1", 0, [onTarget(0, "TREBLE")])],
    };
    expect(aceLastLabel(facts, CONFIG, "p1")).toBe("—");
  });
});

describe("aceRoundResults", () => {
  const facts = {
    stages: [],
    turns: [
      turn("p1", 0, [onTarget(0, "DOUBLE"), off, off]),
      turn("p2", 0, [off, off, off]),
      turn("p1", 1, [off, off, off]),
    ],
  };

  it("lists every configured round, zero for a round not yet thrown", () => {
    const rounds = aceRoundResults(facts, CONFIG);
    expect(rounds.map((round) => round.round)).toEqual([1, 2, 3]);
    expect(rounds[0].target).toBe(aceTargetFor(7, 0));
    expect(rounds[0].points[1]).toBe(0);
    expect(rounds[2].points).toEqual([0, 0]);
  });

  it("projects a seat's result with its best round", () => {
    const rounds = aceRoundResults(facts, CONFIG);
    const seat = {
      participantRef: "p1",
      sideKey: "A",
      total: rounds[0].points[0],
      scoringVisits: 1,
    } as AceSeatState;
    expect(aceSeatResult(seat, rounds, 0)).toEqual({
      participantRef: "p1",
      sideKey: "A",
      total: rounds[0].points[0],
      scoringVisits: 1,
      bestRound: rounds[0].points[0],
    });
  });
});

describe("aceRoundRow", () => {
  it("joins the round and target, then the seats' points", () => {
    expect(aceRoundRow({ round: 3, target: 25, points: [4, 0] })).toEqual({
      label: "R3 · Bull",
      points: "4 – 0",
    });
  });
});
