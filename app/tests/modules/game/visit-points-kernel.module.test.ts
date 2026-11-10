import { describe, it, expect } from "vitest";
import {
  applyVisitPointsTurn,
  closingVisitDarts,
  visitRaceVisitOpen,
  visitRaceWouldComplete,
  foldVisitPoints,
} from "@modules/game/visit-points-kernel.module";
import type { VisitPointsRules } from "@modules/interfaces";
import type { TurnFact } from "@modules/types";

const dartsTurn = (scores: number[]): TurnFact =>
  ({
    completedAt: scores.length === 3 ? "t" : null,
    totalScore: scores.reduce((a, b) => a + b, 0),
    darts: scores.map((score) => ({ score })),
  }) as unknown as TurnFact;
const keypadTurn = (total: number): TurnFact =>
  ({ completedAt: "t", totalScore: total, darts: [] }) as unknown as TurnFact;

const RULES: VisitPointsRules = { dartsPerVisit: 3, points: (t) => t };
const BEATS: VisitPointsRules = {
  dartsPerVisit: 3,
  points: (t) => (t >= 65 ? 1 : 0),
};

describe("visit points kernel", () => {
  it("empty log is the initial seat", () => {
    expect(foldVisitPoints([], RULES)).toEqual({
      visits: 0,
      points: 0,
      lastVisitTotal: null,
      openTotal: 0,
      dartsInVisit: 0,
      dartsThrown: 0,
      voids: 0,
      busts: 0,
      scoringVisits: 0,
    });
  });

  it("the initial seat cannot be mutated through an empty fold", () => {
    expect(Object.isFrozen(foldVisitPoints([], RULES))).toBe(true);
  });

  it("a three-dart turn closes and scores its dart sum", () => {
    expect(foldVisitPoints([dartsTurn([60, 20, 5])], RULES)).toEqual({
      visits: 1,
      points: 85,
      lastVisitTotal: 85,
      openTotal: 0,
      dartsInVisit: 0,
      dartsThrown: 3,
      voids: 0,
      busts: 0,
      scoringVisits: 1,
    });
  });

  it("a short turn stays open and scores nothing yet", () => {
    expect(
      foldVisitPoints([dartsTurn([60, 20, 5]), dartsTurn([57, 3])], RULES),
    ).toEqual({
      visits: 1,
      points: 85,
      lastVisitTotal: 85,
      openTotal: 60,
      dartsInVisit: 2,
      dartsThrown: 5,
      voids: 0,
      busts: 0,
      scoringVisits: 1,
    });
  });

  it("a dartless turn closes on its stored totalScore", () => {
    expect(foldVisitPoints([keypadTurn(100)], RULES)).toMatchObject({
      visits: 1,
      points: 100,
      lastVisitTotal: 100,
      dartsThrown: 0,
    });
  });

  it("points come from the rules", () => {
    expect(
      foldVisitPoints(
        [dartsTurn([20, 20, 25]), dartsTurn([20, 20, 24])],
        BEATS,
      ),
    ).toMatchObject({ visits: 2, points: 1, lastVisitTotal: 64 });
  });

  it("open turn after close is reopened", () => {
    const seat = foldVisitPoints([dartsTurn([60, 20, 5])], RULES);
    expect(applyVisitPointsTurn(seat, dartsTurn([60, 1]), RULES)).toMatchObject(
      { visits: 1, openTotal: 61, dartsInVisit: 2 },
    );
  });

  describe("voids and goal", () => {
    const FIVES: VisitPointsRules = {
      dartsPerVisit: 3,
      points: (t) => (t % 5 === 0 ? t / 5 : 0),
      voids: (darts) => darts.some((dart) => dart.score === 0),
      goal: 51,
    };
    const visit = (scores: number[]) => dartsTurn(scores);
    const atPoints = (points: number) =>
      Array.from({ length: points }, () => visit([1, 2, 2]));

    it("a void visit books nothing but keeps its total", () => {
      expect(foldVisitPoints([visit([20, 25, 0])], FIVES)).toMatchObject({
        visits: 1,
        points: 0,
        lastVisitTotal: 45,
        voids: 1,
        busts: 0,
        scoringVisits: 0,
      });
    });

    it("the same total on the board scores its points", () => {
      expect(foldVisitPoints([visit([20, 20, 5])], FIVES)).toMatchObject({
        points: 9,
        voids: 0,
        scoringVisits: 1,
      });
    });

    it("a visit past the goal busts and the points stay", () => {
      const seat = foldVisitPoints(
        [...atPoints(50), visit([5, 10, 10])],
        FIVES,
      );
      expect(seat).toMatchObject({ points: 50, busts: 1, voids: 0 });
      expect(seat.scoringVisits).toBe(50);
    });

    it("a visit that reaches the goal exactly scores", () => {
      expect(
        foldVisitPoints([...atPoints(50), visit([1, 2, 2])], FIVES),
      ).toMatchObject({ points: 51, busts: 0, scoringVisits: 51 });
    });

    it("a non-divisible total is a plain zero, neither void nor bust", () => {
      expect(foldVisitPoints([visit([20, 20, 3])], FIVES)).toMatchObject({
        visits: 1,
        points: 0,
        voids: 0,
        busts: 0,
        scoringVisits: 0,
      });
    });

    it("an open visit moves no counter", () => {
      expect(foldVisitPoints([visit([0, 0])], FIVES)).toMatchObject({
        visits: 0,
        voids: 0,
        busts: 0,
        scoringVisits: 0,
        dartsInVisit: 2,
      });
    });

    it("a keypad visit is never void", () => {
      expect(foldVisitPoints([keypadTurn(0)], FIVES)).toMatchObject({
        voids: 0,
      });
    });

    it("without voids or goal the counters stay zero", () => {
      expect(
        foldVisitPoints([visit([0, 0, 0]), visit([60, 60, 60])], RULES),
      ).toMatchObject({ points: 180, voids: 0, busts: 0 });
    });
  });
  describe("visitPoints", () => {
    const PER_VISIT: VisitPointsRules = {
      dartsPerVisit: 3,
      visitPoints: (darts, visitIndex) =>
        darts.filter((dart) => dart.hitTargetNumber === visitIndex + 1).length,
    };
    const hit = (numbers: (number | null)[]): TurnFact =>
      ({
        completedAt: "t",
        totalScore: 0,
        darts: numbers.map((hitTargetNumber) => ({
          score: 0,
          hitTargetNumber,
        })),
      }) as unknown as TurnFact;

    it("scores a closed visit from its darts and its zero-based index", () => {
      expect(
        foldVisitPoints([hit([1, 1, 5]), hit([2, 1, 2])], PER_VISIT),
      ).toMatchObject({ visits: 2, points: 4, scoringVisits: 2 });
    });

    it("a visit scoring zero is not a scoring visit", () => {
      expect(foldVisitPoints([hit([9, 9, 9])], PER_VISIT)).toMatchObject({
        visits: 1,
        points: 0,
        scoringVisits: 0,
      });
    });

    it("an open visit books nothing and does not advance the index", () => {
      expect(
        foldVisitPoints([hit([1, 1, 5]), hit([2, 2])], PER_VISIT),
      ).toMatchObject({ visits: 1, points: 2, dartsInVisit: 2 });
    });

    it("voids and goal still apply to the visit's points", () => {
      const rules: VisitPointsRules = {
        ...PER_VISIT,
        goal: 2,
        voids: (darts) => darts.some((dart) => dart.hitTargetNumber === null),
      };
      expect(
        foldVisitPoints([hit([1, 1, null]), hit([2, 2, 2])], rules),
      ).toMatchObject({ points: 0, voids: 1, busts: 1 });
    });
  });

  describe("closingVisitDarts", () => {
    const observation = {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE" as const,
      locationX: null,
      locationY: null,
    };

    it("is null without an open turn or when the turn is not one dart short", () => {
      expect(closingVisitDarts(null, observation, 3)).toBeNull();
      expect(closingVisitDarts(dartsTurn([5]), observation, 3)).toBeNull();
      expect(
        closingVisitDarts(dartsTurn([5, 5, 5]), observation, 3),
      ).toBeNull();
    });

    it("appends the observation, scored on the board, to the open darts", () => {
      const darts = closingVisitDarts(dartsTurn([5, 7]), observation, 3);
      expect(darts?.map((dart) => dart.score)).toEqual([5, 7, 60]);
      expect(darts?.[2]).toMatchObject({
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
      });
    });
  });

  describe("visit race helpers", () => {
    const state = (status: string) => ({
      status,
      activeParticipantRef: "p2",
      seats: [
        { participantRef: "p1", total: 10 },
        { participantRef: "p2", total: 40 },
      ],
    });
    const observation = {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE" as const,
      locationX: null,
      locationY: null,
    };

    it("visitRaceVisitOpen closes at the dart count or when the game ends", () => {
      const open = visitRaceVisitOpen(3);
      expect(open(dartsTurn([1, 2]), state("IN_PROGRESS"))).toBe(true);
      expect(open(dartsTurn([1, 2, 3]), state("IN_PROGRESS"))).toBe(false);
      expect(open(dartsTurn([1]), state("COMPLETE"))).toBe(false);
    });

    it("visitRaceWouldComplete judges the active seat's total against the closing darts", () => {
      const seen: [number, number[]][] = [];
      const would = visitRaceWouldComplete(3, (total, darts) => {
        seen.push([total, darts.map((dart) => dart.score)]);
        return total + 60 >= 100;
      });
      const open = dartsTurn([5, 7]);
      expect(would(state("IN_PROGRESS"), observation, null, open)).toBe(true);
      expect(seen).toEqual([[40, [5, 7, 60]]]);
      expect(would(state("COMPLETE"), observation, null, open)).toBe(false);
      expect(
        would(state("IN_PROGRESS"), observation, null, dartsTurn([5])),
      ).toBe(false);
      expect(would(state("IN_PROGRESS"), observation, null, null)).toBe(false);
    });
  });
});
