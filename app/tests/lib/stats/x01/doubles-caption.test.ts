import { describe, expect, it } from "vitest";
import { doublesCaption } from "@lib/stats/x01/doubles-caption";
import type { DoubleRow } from "@lib/types";

const row = (label: string, darts: number, rate: number | null) =>
  ({ label, darts, rate }) as DoubleRow;

describe("doublesCaption", () => {
  it("names best and worst among rated doubles", () => {
    expect(
      doublesCaption([
        row("D1", 20, 0.5),
        row("D2", 12, 0.25),
        row("D3", 5, null),
      ]),
    ).toBe("Best D1 · worst D2");
  });

  it("a rate tie goes to the double with more darts", () => {
    expect(
      doublesCaption([
        row("D1", 10, 0.5),
        row("D2", 20, 0.5),
        row("D3", 12, 0.1),
      ]),
    ).toBe("Best D2 · worst D3");
  });

  it("is null unless two doubles are rated", () => {
    expect(doublesCaption([row("D1", 20, 0.5), row("D2", 5, null)])).toBeNull();
  });
});
