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
    ["7", "text-[84px]"],
    ["20", "text-[84px]"],
    ["501", "text-[64px]"],
    ["BULL", "text-[46px]"],
    ["1,234", "text-[46px]"],
  ])("sizes %s as %s", (value, expected) => {
    expect(bigValueSize(value)).toBe(expected);
  });

  it("measures a number by its digits", () => {
    expect(bigValueSize(170)).toBe("text-[64px]");
  });

  it("treats a missing value as empty", () => {
    expect(bigValueSize(null)).toBe("text-[84px]");
  });
});

describe("seatValueSize", () => {
  it.each([
    ["7", "text-[64px]"],
    ["170", "text-[64px]"],
    ["BULL", "text-[46px]"],
    ["1,234", "text-[46px]"],
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
