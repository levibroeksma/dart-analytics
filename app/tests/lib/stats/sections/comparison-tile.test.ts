import { describe, expect, it } from "vitest";
import { ratioTile } from "@lib/stats/sections/comparison-tile";

const r = (part: number, whole: number) => ({ part, whole });

describe("ratioTile", () => {
  it("shows the empty text with no whole", () => {
    expect(
      ratioTile("T", { current: r(0, 0), previous: null }, "No goes yet"),
    ).toEqual({ title: "T", value: "—", detail: "No goes yet" });
  });

  it("says no earlier period without a previous", () => {
    expect(
      ratioTile("T", { current: r(15, 30), previous: null }, "x").detail,
    ).toBe("No earlier period");
  });

  it("gives the change once both periods reach the floor", () => {
    const tile = ratioTile(
      "T",
      { current: r(15, 30), previous: { part: 12, whole: 30 } },
      "x",
      "Left ",
    );
    expect(tile.value).toBe("Left 50.0%");
    expect(tile.detail).toBe("+10.0 pp vs previous period");
  });

  it("withholds the change below the floor", () => {
    expect(
      ratioTile("T", { current: r(15, 30), previous: r(1, 5) }, "x").detail,
    ).toBe("No comparison yet");
  });
});
