import { describe, expect, it } from "vitest";
import {
  fiveOhOneSubtitle,
  legBarCount,
  setScoreText,
} from "@lib/game/five-oh-one-match";

const v1 = {
  startingScore: 501,
  legsToWin: 3,
  checkIn: "STRAIGHT_IN",
  checkOut: "DOUBLE_OUT",
  maxDartsPerTurn: 3,
  maxVisitScore: 180,
} as const;
const v2 = (patch = {}) =>
  ({
    startingScore: 501,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    legs: { mode: "BEST_OF", count: 5 },
    sets: { mode: "FIRST_TO", count: 3 },
    winByTwo: null,
    ...patch,
  }) as any;
const rootLeg = (n: number) => ({
  clientKey: `leg-${n}`,
  stageTypeKey: "LEG" as const,
  parentClientKey: null,
  sequence: n,
});
const state = (patch = {}) =>
  ({
    activeParticipantRef: "a",
    status: "IN_PROGRESS" as const,
    winningSideKey: null,
    sides: [
      { sideKey: "A", legsWon: 0, setsWon: 2 },
      { sideKey: "B", legsWon: 0, setsWon: 1 },
    ],
    seats: [],
    sets: [],
    decidingSet: false,
    suddenDeath: false,
    ...patch,
  }) as any;

describe("fiveOhOneSubtitle", () => {
  it("V1 is unchanged", () => {
    expect(fiveOhOneSubtitle(v1, [rootLeg(1), rootLeg(2)], null)).toBe(
      "LEG 2 · FIRST TO 3",
    );
  });
  it("V2 legs only, best of", () => {
    expect(fiveOhOneSubtitle(v2({ sets: null }), [rootLeg(1)], null)).toBe(
      "LEG 1 · BEST OF 5",
    );
  });
  it("V2 sets with deciding set", () => {
    const stages = [
      {
        clientKey: "set-3",
        stageTypeKey: "SET" as const,
        parentClientKey: null,
        sequence: 3,
      },
      {
        clientKey: "set-3-leg-2",
        stageTypeKey: "LEG" as const,
        parentClientKey: "set-3",
        sequence: 2,
      },
    ] as any;
    expect(fiveOhOneSubtitle(v2(), stages, state({ decidingSet: true }))).toBe(
      "SET 3 · LEG 2 · FIRST TO 3 SETS · DECIDING SET",
    );
  });
  it("sudden death outranks deciding set", () => {
    expect(
      fiveOhOneSubtitle(
        v2({ sets: null }),
        Array.from({ length: 9 }, (_, index) => rootLeg(index + 1)),
        state({ suddenDeath: true, decidingSet: false }),
      ),
    ).toBe("LEG 9 · BEST OF 5 · SUDDEN DEATH");
  });
});

describe("legBarCount", () => {
  it("is the leg target normally", () => {
    expect(legBarCount(v2(), state())).toBe(3);
    expect(legBarCount(v1, state())).toBe(3);
  });
  it("is cap + 1 once a side passes the target under win by 2", () => {
    const config = v2({ winByTwo: { cap: 5, scope: "EVERY_SET" } });
    expect(
      legBarCount(
        config,
        state({
          sides: [
            { sideKey: "A", legsWon: 3, setsWon: 0 },
            { sideKey: "B", legsWon: 3, setsWon: 0 },
          ],
        }),
      ),
    ).toBe(6);
  });
});

describe("setScoreText", () => {
  it("reads sets won in seat order, blank without sets", () => {
    const seats = [{ sideKey: "A" }, { sideKey: "B" }];
    expect(setScoreText(v2(), state(), seats)).toBe("2–1");
    expect(setScoreText(v2({ sets: null }), state(), seats)).toBe("");
  });
});
