import { describe, expect, it } from "vitest";
import {
  foldMatch,
  legRaceWinner,
  matchFormatOf,
  matchPositionOf,
  raceLabel,
  raceTarget,
} from "@modules/game/match-format.module";
import type { MatchFormat, StageFact } from "@modules/types";

const AB = ["A", "B"];
const ABC = ["A", "B", "C"];
const ABCD = ["A", "B", "C", "D"];
const legsOnly = (
  count: number,
  mode: "FIRST_TO" | "BEST_OF" = "FIRST_TO",
): MatchFormat => ({
  legs: { mode, count },
  sets: null,
  winByTwo: null,
});
const repeat = (side: string, n: number) =>
  Array.from({ length: n }, () => side);

describe("raceTarget", () => {
  it.each([
    [{ mode: "FIRST_TO", count: 3 }, 3],
    [{ mode: "BEST_OF", count: 5 }, 3],
    [{ mode: "BEST_OF", count: 1 }, 1],
  ] as const)("%j → %i", (race, target) => {
    expect(raceTarget(race)).toBe(target);
  });
});

describe("legRaceWinner", () => {
  const margin = { cap: 5, scope: "EVERY_SET" as const };
  it.each([
    ["no margin, reaches target", { A: 3, B: 2 }, AB, null, "A"],
    ["no margin, short", { A: 2, B: 2 }, AB, null, null],
    ["margin, 3-2 plays on", { A: 3, B: 2 }, AB, margin, null],
    ["margin, 4-2 wins", { A: 4, B: 2 }, AB, margin, "A"],
    ["margin, 5-5 plays on", { A: 5, B: 5 }, AB, margin, null],
    ["margin, 6-5 sudden death win", { A: 6, B: 5 }, AB, margin, "A"],
    [
      "3 sides, lead over runner-up only",
      { A: 4, B: 3, C: 0 },
      ABC,
      margin,
      null,
    ],
    ["3 sides, 2 clear of all", { A: 5, B: 3, C: 1 }, ABC, margin, "A"],
    [
      "4 sides, leader 4 vs runner-up 3 plays on",
      { A: 4, B: 3, C: 2, D: 0 },
      ABCD,
      margin,
      null,
    ],
    ["4 sides, 2 clear of all", { A: 4, B: 2, C: 2, D: 0 }, ABCD, margin, "A"],
    ["3 sides, 5-5-0 at cap plays on", { A: 5, B: 5, C: 0 }, ABC, margin, null],
  ] as const)("%s", (_label, legsWon, sides, m, expected) => {
    expect(legRaceWinner(legsWon, sides, 3, m)).toBe(expected);
  });
});

describe("foldMatch", () => {
  it("first to 2 legs, no sets: winner after two legs", () => {
    const fold = foldMatch(legsOnly(2), AB, [["A", "B", "A"]]);
    expect(fold.winner).toBe("A");
    expect(fold.sets).toEqual([{ legsWon: { A: 2, B: 1 }, winner: "A" }]);
    expect(fold.decidingSet).toBe(false);
  });

  it("best of 5 legs ends at 3", () => {
    expect(
      foldMatch(legsOnly(5, "BEST_OF"), AB, [["A", "A", "A"]]).winner,
    ).toBe("A");
  });

  it("no legs played yet: one empty open set", () => {
    const fold = foldMatch(legsOnly(1), AB, []);
    expect(fold.sets).toEqual([{ legsWon: { A: 0, B: 0 }, winner: null }]);
    expect(fold.winner).toBeNull();
  });

  it("sets: first to 2 sets of first-to-2 legs", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 2 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: null,
    };
    const fold = foldMatch(format, AB, [
      ["A", "A"],
      ["B", "B"],
      ["A", "B", "A"],
    ]);
    expect(fold.setsWon).toEqual({ A: 2, B: 1 });
    expect(fold.winner).toBe("A");
  });

  it("deciding set: flagged when every side is one set short", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: { cap: 5, scope: "DECIDING_SET" },
    };
    const fold = foldMatch(format, AB, [
      repeat("A", 3),
      repeat("B", 3),
      ["A", "B", "A", "B", "A"],
    ]);
    expect(fold.decidingSet).toBe(true);
    expect(fold.winner).toBeNull();
    expect(fold.sets[2]).toEqual({ legsWon: { A: 3, B: 2 }, winner: null });
  });

  it("deciding-set scope: earlier sets end at the plain target", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: { cap: 5, scope: "DECIDING_SET" },
    };
    const fold = foldMatch(format, AB, [["A", "B", "A", "B", "A"]]);
    expect(fold.sets[0]!.winner).toBe("A");
    expect(fold.decidingSet).toBe(false);
  });

  it("sudden death only when two sides sit at the cap", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: null,
      winByTwo: { cap: 5, scope: "EVERY_SET" },
    };
    const atFiveFour = [...repeat("A", 5), ...repeat("B", 4)];
    expect(foldMatch(format, AB, [atFiveFour]).suddenDeath).toBe(false);
    expect(foldMatch(format, AB, [[...atFiveFour, "B"]]).suddenDeath).toBe(
      true,
    );
    expect(foldMatch(format, AB, [[...atFiveFour, "B", "B"]]).winner).toBe("B");
  });

  it("3 sides: deciding set needs every side at target − 1", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 1 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: null,
    };
    expect(foldMatch(format, ABC, [["A"], ["B"], []]).decidingSet).toBe(false);
    expect(foldMatch(format, ABC, [["A"], ["B"], ["C"], []]).decidingSet).toBe(
      true,
    );
  });

  const winByTwoEvery: MatchFormat = {
    legs: { mode: "FIRST_TO", count: 3 },
    sets: null,
    winByTwo: { cap: 5, scope: "EVERY_SET" },
  };

  it("3 sides: sudden death when two sides sit at the cap", () => {
    const fold = foldMatch(winByTwoEvery, ABC, [
      [...repeat("A", 5), ...repeat("B", 5)],
    ]);
    expect(fold.winner).toBeNull();
    expect(fold.suddenDeath).toBe(true);
  });

  it("3 sides: no sudden death when only one side sits at the cap", () => {
    const fold = foldMatch(winByTwoEvery, ABC, [
      [...repeat("A", 5), ...repeat("B", 4), ...repeat("C", 4)],
    ]);
    expect(fold.winner).toBeNull();
    expect(fold.suddenDeath).toBe(false);
  });

  it("3 sides: X+1 win once a side reaches cap + 1", () => {
    const fold = foldMatch(winByTwoEvery, ABC, [
      [...repeat("A", 6), ...repeat("B", 5), ...repeat("C", 5)],
    ]);
    expect(fold.winner).toBe("A");
    expect(fold.suddenDeath).toBe(false);
  });

  it("3 sides under deciding-set scope: margin applies only in the deciding set", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: { cap: 5, scope: "DECIDING_SET" },
    };
    const fold = foldMatch(format, ABC, [
      repeat("A", 3),
      repeat("B", 3),
      repeat("C", 3),
      ["A", "B", "C", "A", "B", "C", "A", "A"],
    ]);
    expect(fold.sets.slice(0, 3).map((set) => set.winner)).toEqual([
      "A",
      "B",
      "C",
    ]);
    expect(fold.sets[3]).toEqual({
      legsWon: { A: 4, B: 2, C: 2 },
      winner: "A",
    });
    expect(fold.decidingSet).toBe(true);
    expect(fold.winner).toBe("A");
  });

  it("3 sides under deciding-set scope: a non-deciding set ends at the plain target", () => {
    const format: MatchFormat = {
      legs: { mode: "FIRST_TO", count: 3 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: { cap: 5, scope: "DECIDING_SET" },
    };
    const fold = foldMatch(format, ABC, [["A", "B", "A", "B", "A"]]);
    expect(fold.sets[0]!.winner).toBe("A");
    expect(fold.decidingSet).toBe(false);
  });
});

describe("matchFormatOf", () => {
  it("reads a V1 snapshot as first to legsToWin, no sets, no margin", () => {
    expect(
      matchFormatOf({
        startingScore: 501,
        legsToWin: 3,
        checkIn: "STRAIGHT_IN",
        checkOut: "DOUBLE_OUT",
        maxDartsPerTurn: 3,
        maxVisitScore: 180,
      }),
    ).toEqual(legsOnly(3));
  });

  it("passes a V2 snapshot's format through", () => {
    const format = matchFormatOf({
      startingScore: 501,
      checkIn: "STRAIGHT_IN",
      checkOut: "DOUBLE_OUT",
      maxDartsPerTurn: 3,
      maxVisitScore: 180,
      legs: { mode: "BEST_OF", count: 5 },
      sets: { mode: "FIRST_TO", count: 2 },
      winByTwo: null,
    });
    expect(format.sets).toEqual({ mode: "FIRST_TO", count: 2 });
  });
});

describe("raceLabel / matchPositionOf", () => {
  it("labels races", () => {
    expect(raceLabel({ mode: "FIRST_TO", count: 3 })).toBe("First to 3");
    expect(raceLabel({ mode: "BEST_OF", count: 5 })).toBe("Best of 5");
  });

  const stage = (
    clientKey: string,
    type: "SET" | "LEG",
    parent: string | null,
    sequence: number,
  ): StageFact => ({
    clientKey,
    stageTypeKey: type,
    parentClientKey: parent,
    sequence,
  });

  it("root legs: set null, leg = number of LEG stages", () => {
    expect(
      matchPositionOf([
        stage("leg-1", "LEG", null, 1),
        stage("leg-2", "LEG", null, 2),
      ]),
    ).toEqual({ set: null, leg: 2 });
  });

  it("nested: set = open set's sequence, leg = open leg's sequence", () => {
    expect(
      matchPositionOf([
        stage("set-1", "SET", null, 1),
        stage("set-1-leg-1", "LEG", "set-1", 1),
        stage("set-2", "SET", null, 2),
        stage("set-2-leg-1", "LEG", "set-2", 1),
      ]),
    ).toEqual({ set: 2, leg: 1 });
  });

  it("empty log reads as leg 1", () => {
    expect(matchPositionOf([])).toEqual({ set: null, leg: 1 });
  });
});
