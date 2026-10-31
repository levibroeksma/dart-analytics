import { describe, it, expect } from "vitest";
import {
  prisonerResultRows,
  prisonerResultsSnapshot,
  prisonerSeatResult,
  prisonerTargetText,
  prisonerWonByLabel,
} from "@lib/game/prisoner-results";
import type { PrisonerSeatState, PrisonerState } from "@modules/types";

function seat(overrides: Partial<PrisonerSeatState> = {}): PrisonerSeatState {
  return {
    participantRef: "p1",
    sideKey: "A",
    held: 3,
    out: false,
    target: 21,
    sitting: 0,
    budget: 3,
    captured: 2,
    imprisoned: 1,
    ...overrides,
  } as PrisonerSeatState;
}

function state(overrides: Partial<PrisonerState> = {}): PrisonerState {
  return {
    status: "COMPLETE",
    winningSideKey: "A",
    wonBy: "COMPLETED_20",
    outOrder: [],
    seats: [
      seat(),
      seat({
        participantRef: "p2",
        sideKey: "B",
        held: 2,
        target: 9,
        captured: 0,
        imprisoned: 4,
      }),
    ],
    ...overrides,
  } as PrisonerState;
}

const NAMES = [
  { participantRef: "p1", sideKey: "A", displayName: "Ann" },
  { participantRef: "p2", sideKey: "B", displayName: "Bo" },
];

describe("prisonerTargetText", () => {
  it("names the outer number", () => {
    expect(prisonerTargetText(7)).toBe("Outer 7");
  });

  it("reads Done once 20 is completed", () => {
    expect(prisonerTargetText(21)).toBe("Done");
  });
});

describe("prisonerSeatResult", () => {
  it("maps target, darts held, captured, imprisoned and out", () => {
    expect(prisonerSeatResult(seat({ out: true, held: 0 }))).toEqual({
      participantRef: "p1",
      sideKey: "A",
      target: 21,
      held: 0,
      captured: 2,
      imprisoned: 1,
      out: true,
    });
  });
});

describe("prisonerResultsSnapshot", () => {
  it("win by completing 20", () => {
    const snapshot = prisonerResultsSnapshot(state());
    expect(snapshot.winningSideKey).toBe("A");
    expect(snapshot.wonBy).toBe("COMPLETED_20");
    expect(snapshot.seats).toHaveLength(2);
  });

  it("win by last seat in keeps out order", () => {
    const snapshot = prisonerResultsSnapshot(
      state({ wonBy: "LAST_IN", outOrder: ["p2"] }),
    );
    expect(snapshot.wonBy).toBe("LAST_IN");
    expect(snapshot.outOrder).toEqual(["p2"]);
  });

  it("abandoned has no winner and no win mode", () => {
    const snapshot = prisonerResultsSnapshot(
      state({ winningSideKey: null, wonBy: null }),
    );
    expect(snapshot.winningSideKey).toBeNull();
    expect(snapshot.wonBy).toBeNull();
  });
});

describe("prisonerWonByLabel", () => {
  it("labels both win modes", () => {
    expect(prisonerWonByLabel(prisonerResultsSnapshot(state()))).toBe(
      "Completed 20",
    );
    expect(
      prisonerWonByLabel(prisonerResultsSnapshot(state({ wonBy: "LAST_IN" }))),
    ).toBe("Last seat in");
  });

  it("is blank when abandoned or absent", () => {
    expect(
      prisonerWonByLabel(
        prisonerResultsSnapshot(state({ winningSideKey: null, wonBy: null })),
      ),
    ).toBe("");
    expect(prisonerWonByLabel(null)).toBe("");
  });
});

describe("prisonerResultRows", () => {
  it("builds one row per seat with winner flag", () => {
    const rows = prisonerResultRows(prisonerResultsSnapshot(state()), NAMES);
    expect(rows).toEqual([
      {
        name: "Ann",
        target: "Done",
        held: 3,
        captured: 2,
        imprisoned: 1,
        out: false,
        winner: true,
      },
      {
        name: "Bo",
        target: "Outer 9",
        held: 2,
        captured: 0,
        imprisoned: 4,
        out: false,
        winner: false,
      },
    ]);
  });

  it("marks no winner when abandoned", () => {
    const rows = prisonerResultRows(
      prisonerResultsSnapshot(state({ winningSideKey: null, wonBy: null })),
      NAMES,
    );
    expect(rows.every((row) => !row.winner)).toBe(true);
  });

  it("falls back to the ref and is empty without a snapshot", () => {
    const rows = prisonerResultRows(prisonerResultsSnapshot(state()), []);
    expect(rows[0].name).toBe("p1");
    expect(prisonerResultRows(null, NAMES)).toEqual([]);
  });
});
