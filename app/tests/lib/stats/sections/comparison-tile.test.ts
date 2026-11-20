import { describe, expect, it } from "vitest";
import { meanTile, ratioTile } from "@lib/stats/sections/comparison-tile";

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

describe("meanTile", () => {
  const ratio = (part: number, whole: number) => ({ part, whole });

  it("shows the mean to the given decimals and its signed change", () => {
    expect(
      meanTile(
        "Marks per round",
        { current: ratio(252, 100), previous: ratio(240, 100) },
        "No darts yet",
        2,
      ),
    ).toEqual({
      title: "Marks per round",
      value: "2.52",
      detail: "+0.12 vs previous period",
    });
  });

  it("signs a fall and marks no change with ±", () => {
    expect(
      meanTile("D", { current: ratio(90, 30), previous: ratio(120, 30) }, "", 1)
        .detail,
    ).toBe("-1.0 vs previous period");
    expect(
      meanTile("D", { current: ratio(60, 30), previous: ratio(60, 30) }, "", 1)
        .detail,
    ).toBe("±0.0 vs previous period");
  });

  it("shares ratioTile's floor and earlier-period rules", () => {
    expect(
      meanTile("D", { current: ratio(60, 29), previous: ratio(60, 30) }, "", 1)
        .detail,
    ).toBe("No comparison yet");
    expect(
      meanTile("D", { current: ratio(60, 30), previous: null }, "", 1).detail,
    ).toBe("No earlier period");
  });

  it("shows the empty text with no whole", () => {
    expect(
      meanTile(
        "D",
        { current: ratio(0, 0), previous: null },
        "No darts yet",
        1,
      ),
    ).toEqual({ title: "D", value: "—", detail: "No darts yet" });
  });
});
