import { describe, expect, it } from "vitest";
import { checkoutComparisonTiles } from "@lib/stats/checkout/checkout-comparison-lines";
import type { CheckoutComparison } from "@lib/types";

const r = (part: number, whole: number) => ({ part, whole });
const none = { current: r(0, 0), previous: null };

function comparison(
  over: Partial<CheckoutComparison> = {},
): CheckoutComparison {
  return {
    finish: none,
    peak: { current: null, previous: null, currentGoes: 0, previousGoes: null },
    recovery: none,
    bust: none,
    ...over,
  };
}

describe("checkoutComparisonTiles", () => {
  it("titles four tiles", () => {
    expect(checkoutComparisonTiles(comparison()).map((t) => t.title)).toEqual([
      "Finish rate",
      "Highest target",
      "Recovery rate",
      "Bust rate",
    ]);
  });

  it("shows the changes once both periods reach 30 goes", () => {
    const tiles = checkoutComparisonTiles(
      comparison({
        finish: { current: r(15, 30), previous: r(12, 30) },
        peak: { current: 61, previous: 51, currentGoes: 30, previousGoes: 31 },
      }),
    );
    expect(tiles[0]).toMatchObject({
      value: "50.0%",
      detail: "+10.0 pp vs previous period",
    });
    expect(tiles[1]).toMatchObject({
      value: "61",
      detail: "+10 vs previous period",
    });
  });

  it("marks an unchanged peak and a thin or missing previous period", () => {
    const peak = (previousGoes: number | null, previous: number | null) =>
      checkoutComparisonTiles(
        comparison({
          peak: { current: 51, previous, currentGoes: 40, previousGoes },
        }),
      )[1]!.detail;
    expect(peak(40, 51)).toBe("±0 vs previous period");
    expect(peak(20, 51)).toBe("No comparison yet");
    expect(peak(null, null)).toBe("No earlier period");
  });

  it("shows a dash for an empty peak and the empty-period texts", () => {
    const tiles = checkoutComparisonTiles(comparison());
    expect(tiles[1]).toMatchObject({ value: "—", detail: "No goes yet" });
    expect(tiles[0]!.detail).toBe("No goes yet");
    expect(tiles[3]!.detail).toBe("No goes yet");
  });

  it("says no misses yet when goes exist but none followed a failed go", () => {
    const tiles = checkoutComparisonTiles(
      comparison({
        finish: { current: r(5, 5), previous: null },
        peak: {
          current: 50,
          previous: null,
          currentGoes: 5,
          previousGoes: null,
        },
      }),
    );
    expect(tiles[2]).toMatchObject({ value: "—", detail: "No misses yet" });
  });
});
