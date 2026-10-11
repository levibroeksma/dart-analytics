import { describe, expect, it } from "vitest";
import {
  fiveOhOneSubtitle,
  legBarCount,
  setLegScoresText,
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
  it("is the target for a clean win that leaves a 2-leg gap", () => {
    const config = v2({ winByTwo: { cap: 5, scope: "EVERY_SET" } });
    expect(
      legBarCount(
        config,
        state({
          status: "FINISHED",
          sides: [
            { sideKey: "A", legsWon: 3, setsWon: 0 },
            { sideKey: "B", legsWon: 1, setsWon: 0 },
          ],
        }),
      ),
    ).toBe(3);
  });
  it.each([
    [5, 3],
    [6, 4],
    [4, 4],
  ])("is cap + 1 for %i-%i at target 4, cap 6", (a, b) => {
    const config = v2({
      legs: { mode: "FIRST_TO", count: 4 },
      winByTwo: { cap: 6, scope: "EVERY_SET" },
    });
    expect(
      legBarCount(
        config,
        state({
          status: "FINISHED",
          sides: [
            { sideKey: "A", legsWon: a, setsWon: 0 },
            { sideKey: "B", legsWon: b, setsWon: 0 },
          ],
        }),
      ),
    ).toBe(7);
  });
  it("is the target for a finished 4-2 at target 4", () => {
    const config = v2({
      legs: { mode: "FIRST_TO", count: 4 },
      winByTwo: { cap: 6, scope: "EVERY_SET" },
    });
    expect(
      legBarCount(
        config,
        state({
          sides: [
            { sideKey: "A", legsWon: 4, setsWon: 0 },
            { sideKey: "B", legsWon: 2, setsWon: 0 },
          ],
        }),
      ),
    ).toBe(4);
  });
  it("is cap + 1 when sudden death is flagged", () => {
    const config = v2({ winByTwo: { cap: 5, scope: "EVERY_SET" } });
    expect(
      legBarCount(
        config,
        state({
          suddenDeath: true,
          sides: [
            { sideKey: "A", legsWon: 5, setsWon: 0 },
            { sideKey: "B", legsWon: 5, setsWon: 0 },
          ],
        }),
      ),
    ).toBe(6);
  });
  it("is the target in a non-deciding set under DECIDING_SET scope", () => {
    const config = v2({ winByTwo: { cap: 5, scope: "DECIDING_SET" } });
    const sides = [
      { sideKey: "A", legsWon: 3, setsWon: 0 },
      { sideKey: "B", legsWon: 3, setsWon: 0 },
    ];
    expect(legBarCount(config, state({ sides }))).toBe(3);
    expect(legBarCount(config, state({ sides, decidingSet: true }))).toBe(6);
  });
});

describe("setScoreText", () => {
  it("reads sets won in seat order, blank without sets", () => {
    const seats = [{ sideKey: "A" }, { sideKey: "B" }];
    expect(setScoreText(v2(), state(), seats)).toBe("2–1");
    expect(setScoreText(v2({ sets: null }), state(), seats)).toBe("");
  });
});

describe("setLegScoresText", () => {
  const seats = [{ sideKey: "A" }, { sideKey: "B" }];
  const sets = [
    { legsWon: { A: 3, B: 1 }, winner: "A" },
    { legsWon: { A: 2, B: 3 }, winner: "B" },
    { legsWon: { A: 0, B: 0 }, winner: null },
  ];
  it("lists each played set's legs in seat order", () => {
    expect(setLegScoresText(v2(), state({ sets }), seats)).toBe("3–1 · 2–3");
  });
  it("is blank without sets or without played sets", () => {
    expect(setLegScoresText(v2({ sets: null }), state({ sets }), seats)).toBe(
      "",
    );
    expect(setLegScoresText(v2(), state(), seats)).toBe("");
    expect(setLegScoresText(v2(), null, seats)).toBe("");
  });
});
