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

  it("shows a dash and no darts yet when the period has no darts", () => {
    const [, drift] = aceComparisonTiles(
      comparison({
        hit: { current: r(0, 0), previous: r(10, 40) },
        drift: { direction: null, current: r(0, 0), previous: r(4, 40) },
      }),
    );

    expect(drift).toMatchObject({ value: "—", detail: "No darts yet" });
  });

  it("says no misses yet, not no darts yet, when every dart hit", () => {
    const [, drift, near] = aceComparisonTiles(
      comparison({
        hit: { current: r(40, 40), previous: null },
        drift: { direction: null, current: r(0, 0), previous: null },
        near: { current: r(0, 0), previous: null },
      }),
    );

    expect([drift!.detail, near!.detail]).toEqual([
      "No misses yet",
      "No misses yet",
    ]);
  });

  it("says there is no earlier period rather than no comparison yet without one", () => {
    const [hit] = aceComparisonTiles(
      comparison({ hit: { current: r(16, 40), previous: null } }),
    );

    expect(hit!.detail).toBe("No earlier period");
  });

  it("withholds the change when the preceding period is under 30 darts", () => {
    const [hit] = aceComparisonTiles(
      comparison({ hit: { current: r(16, 40), previous: r(5, 29) } }),
    );

    expect(hit!.detail).toBe("No comparison yet");
  });
});
