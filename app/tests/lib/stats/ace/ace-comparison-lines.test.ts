import { describe, expect, it } from "vitest";
import { aceComparisonTiles } from "@lib/stats/ace/ace-comparison-lines";
import type { AceComparison, Ratio } from "@lib/types";

const r = (part: number, whole: number): Ratio => ({ part, whole });

function comparison(overrides: Partial<AceComparison> = {}): AceComparison {
  return {
    hit: { current: r(16, 40), previous: r(15, 50) },
    drift: { direction: "Left", current: r(12, 40), previous: r(18, 40) },
    near: { current: r(18, 30), previous: r(9, 30) },
    ...overrides,
  };
}

describe("aceComparisonTiles", () => {
  it("titles the three tiles in page order", () => {
    expect(aceComparisonTiles(comparison()).map((t) => t.title)).toEqual([
      "Target hit rate",
      "Drift",
      "Near miss share",
    ]);
  });

  it("shows each current share and its change in points against the previous period", () => {
    const [hit, drift, near] = aceComparisonTiles(comparison());

    expect(hit).toMatchObject({
      value: "40.0%",
      detail: "+10.0 pp vs previous period",
    });
    expect(drift).toMatchObject({
      value: "Left 30.0%",
      detail: "-15.0 pp vs previous period",
    });
    expect(near).toMatchObject({
      value: "60.0%",
      detail: "+30.0 pp vs previous period",
    });
  });

  it("withholds the change while either period has fewer than 30 in the share's whole", () => {
    const [hit] = aceComparisonTiles(
      comparison({ hit: { current: r(16, 40), previous: r(5, 29) } }),
    );

    expect(hit).toMatchObject({ value: "40.0%", detail: "No comparison yet" });
  });

  it("withholds the change without a preceding period", () => {
    const [hit] = aceComparisonTiles(
      comparison({ hit: { current: r(16, 40), previous: null } }),
    );

    expect(hit!.detail).toBe("No comparison yet");
  });

  it("shows a dash and no darts yet when the share has no whole", () => {
    const [, drift] = aceComparisonTiles(
      comparison({
        drift: { direction: null, current: r(0, 0), previous: r(4, 40) },
      }),
    );

    expect(drift).toMatchObject({ value: "—", detail: "No darts yet" });
  });
});
