import { describe, it, expect } from "vitest";
import {
  eliminationWinner,
  raceWinner,
  scoreCompareOutcome,
  scoreCompareWinner,
} from "@modules/game/match-outcome.module";

describe("eliminationWinner", () => {
  it("returns null while nobody has failed", () => {
    expect(
      eliminationWinner([
        { sideKey: "A", failed: false },
        { sideKey: "B", failed: false },
      ]),
    ).toBeNull();
  });

  it("returns the survivor once one side fails", () => {
    expect(
      eliminationWinner([
        { sideKey: "A", failed: true },
        { sideKey: "B", failed: false },
      ]),
    ).toBe("B");
  });

  it("returns null for a solo seat that has not failed", () => {
    expect(eliminationWinner([{ sideKey: "A", failed: false }])).toBeNull();
  });
});

describe("raceWinner", () => {
  it("returns null while nobody has finished", () => {
    expect(
      raceWinner([
        { sideKey: "A", finished: false },
        { sideKey: "B", finished: false },
      ]),
    ).toBeNull();
  });

  it("returns the side that finished", () => {
    expect(
      raceWinner([
        { sideKey: "A", finished: true },
        { sideKey: "B", finished: false },
      ]),
    ).toBe("A");
  });

  it("returns the sole seat's side once a solo session finishes", () => {
    expect(raceWinner([{ sideKey: "A", finished: true }])).toBe("A");
  });
});

describe("scoreCompareWinner", () => {
  it("returns null while any seat is incomplete", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: false, metric: 5 },
        ],
        "HIGHEST",
      ),
    ).toBeNull();
  });

  it("returns the higher metric's side under HIGHEST", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: true, metric: 7 },
        ],
        "HIGHEST",
      ),
    ).toBe("A");
  });

  it("returns the lower metric's side under LOWEST", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: true, metric: 7 },
        ],
        "LOWEST",
      ),
    ).toBe("B");
  });

  it("returns null on a tie", () => {
    expect(
      scoreCompareWinner(
        [
          { sideKey: "A", completed: true, metric: 10 },
          { sideKey: "B", completed: true, metric: 10 },
        ],
        "HIGHEST",
      ),
    ).toBeNull();
  });

  it("returns the sole seat's side once a solo session completes", () => {
    expect(
      scoreCompareWinner(
        [{ sideKey: "A", completed: true, metric: 10 }],
        "HIGHEST",
      ),
    ).toBe("A");
  });
});

describe("scoreCompareOutcome", () => {
  it("stays IN_PROGRESS with no winner while a seat is still playing", () => {
    expect(
      scoreCompareOutcome(
        [
          { sideKey: "A", completed: true, metric: 40 },
          { sideKey: "B", completed: false, metric: 10 },
        ],
        "HIGHEST",
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "IN_PROGRESS", winningSideKey: null });
  });

  it("completes on the best metric once every seat has finished", () => {
    expect(
      scoreCompareOutcome(
        [
          { sideKey: "A", completed: true, metric: 40 },
          { sideKey: "B", completed: true, metric: 55 },
        ],
        "HIGHEST",
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "COMPLETE", winningSideKey: "B" });
  });

  it("reads LOWEST as best where the metric inverts", () => {
    expect(
      scoreCompareOutcome(
        [
          { sideKey: "A", completed: true, metric: 61 },
          { sideKey: "B", completed: true, metric: 74 },
        ],
        "LOWEST",
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "COMPLETE", winningSideKey: "A" });
  });

  it("ties, with no winner, when the best metric is shared", () => {
    expect(
      scoreCompareOutcome(
        [
          { sideKey: "A", completed: true, metric: 40 },
          { sideKey: "B", completed: true, metric: 40 },
        ],
        "HIGHEST",
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "TIE", winningSideKey: null });
  });

  it("reports a solo session's own status and never a winner", () => {
    expect(
      scoreCompareOutcome(
        [{ sideKey: "A", completed: true, metric: 40 }],
        "HIGHEST",
        "COMPLETE",
      ),
    ).toEqual({ status: "COMPLETE", winningSideKey: null });
    expect(
      scoreCompareOutcome(
        [{ sideKey: "A", completed: true, metric: 40 }],
        "HIGHEST",
        "IN_PROGRESS",
      ),
    ).toEqual({ status: "IN_PROGRESS", winningSideKey: null });
  });
});
