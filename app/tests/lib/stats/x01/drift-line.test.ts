import { describe, expect, it } from "vitest";
import { driftLine } from "@lib/stats/x01/drift-line";

describe("driftLine", () => {
  it("formats offsets and spread in mm", () => {
    expect(
      driftLine(
        { dart: 1, n: 40, meanDx: -4, meanDy: 2, spread: 3.87 },
        "Dart 1",
      ),
    ).toEqual({
      label: "Dart 1",
      count: 40,
      cells: ["-4.0 mm", "2.0 mm", "3.9 mm"],
    });
  });

  it("shows a dash for a row under the sample floor", () => {
    expect(
      driftLine(
        { dart: 2, n: 3, meanDx: null, meanDy: null, spread: null },
        "Dart 2",
      ).cells,
    ).toEqual(["—", "—", "—"]);
  });
});
