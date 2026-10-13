import { describe, expect, it } from "vitest";
import {
  bigValueSize,
  legBarStates,
  previewColumnState,
  ringKeyActive,
  seatValueSize,
} from "@lib/ui/play-display";
import type { RingKey, TapRing } from "@lib/types";

describe("bigValueSize", () => {
  it.each([
    ["7", "text-numeral-1"],
    ["20", "text-numeral-1"],
    ["501", "text-numeral-2"],
    ["D20", "text-numeral-2"],
    ["BULL", "text-numeral-3"],
    ["1,234", "text-numeral-3"],
    ["10,000", "text-numeral-4"],
    ["12 - 180", "text-numeral-5"],
    ["501 - 180", "text-numeral-6"],
  ])("sizes %s as %s", (value, expected) => {
    expect(bigValueSize(value)).toBe(expected);
  });

  it("measures a number by its digits", () => {
    expect(bigValueSize(170)).toBe("text-numeral-2");
  });

  it("treats a missing value as empty", () => {
    expect(bigValueSize(null)).toBe("text-numeral-1");
  });
});

describe("seatValueSize", () => {
  it.each([
    ["7", "text-numeral-2"],
    ["170", "text-numeral-2"],
    ["BULL", "text-numeral-3"],
    ["1,234", "text-numeral-3"],
    ["10,000", "text-numeral-4"],
    ["12 - 180", "text-numeral-5"],
    ["501 - 180", "text-numeral-6"],
  ])("sizes %s as %s", (value, expected) => {
    expect(seatValueSize(value)).toBe(expected);
  });
});

describe("legBarStates", () => {
  it.each([
    [0, 3, ["open", "open", "open"]],
    [2, 3, ["won", "won", "open"]],
    [3, 3, ["won", "won", "won"]],
    [5, 5, ["won", "won", "won", "won", "won"]],
  ])("%i of %i", (won, toWin, expected) => {
    expect(legBarStates(won, toWin)).toEqual(expected);
  });

  it("switches to the counter above five legs", () => {
    expect(legBarStates(0, 6)).toBeNull();
  });

  it("draws no bars before the leg target is known", () => {
    expect(legBarStates(0, 0)).toEqual([]);
  });

  it("never paints more won bars than legs to win", () => {
    expect(legBarStates(4, 3)).toEqual(["won", "won", "won"]);
  });
});

describe("previewColumnState", () => {
  it("marks only the first empty dart as next", () => {
    expect(
      previewColumnState([
        { status: "empty" },
        { status: "empty" },
        { status: "empty" },
      ]),
    ).toEqual([
      { status: "empty", next: true },
      { status: "empty", next: false },
      { status: "empty", next: false },
    ]);
  });

  it("keeps hit and miss columns and moves next past them", () => {
    expect(
      previewColumnState([
        { status: "hit" },
        { status: "miss" },
        { status: "empty" },
      ]),
    ).toEqual([
      { status: "hit", next: false },
      { status: "miss", next: false },
      { status: "empty", next: true },
    ]);
  });

  it("has no next dart once the visit is full", () => {
    expect(
      previewColumnState([
        { status: "hit" },
        { status: "hit" },
        { status: "miss" },
      ]).some((column) => column.next),
    ).toBe(false);
  });

  it("passes each label through and treats a value dart as filled", () => {
    expect(
      previewColumnState([
        { status: "value", label: "S20" },
        { status: "empty", label: "T19" },
        { status: "empty", label: "T18" },
      ]),
    ).toEqual([
      { status: "value", next: false, label: "S20" },
      { status: "empty", next: true, label: "T19" },
      { status: "empty", next: false, label: "T18" },
    ]);
  });

  it("leaves label undefined when a segment has none", () => {
    expect(previewColumnState([{ status: "hit" }])[0]).toEqual({
      status: "hit",
      next: false,
      label: undefined,
    });
  });
});

describe("ringKeyActive", () => {
  it.each<[TapRing, RingKey, boolean]>([
    ["SINGLE", "S", true],
    ["DOUBLE", "D", true],
    ["TREBLE", "T", true],
    ["SINGLE", "D", false],
    ["DOUBLE", "S", false],
    ["TREBLE", "D", false],
  ])("ring %s lights key %s: %s", (ring, key, expected) => {
    expect(ringKeyActive(ring, key)).toBe(expected);
  });
});
