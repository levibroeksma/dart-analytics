import { describe, expect, it } from "vitest";
import {
  ORDER_MODE_LABELS,
  joinSubtitle,
  orderModeLabel,
} from "@lib/game/play-subtitle";

describe("joinSubtitle", () => {
  it("joins parts with a middle dot", () => {
    expect(joinSubtitle(["LEG 2", "FIRST TO 3"])).toBe("LEG 2 · FIRST TO 3");
  });

  it("drops empty parts", () => {
    expect(joinSubtitle(["", "ROUND 4", ""])).toBe("ROUND 4");
  });

  it("is empty when every part is", () => {
    expect(joinSubtitle(["", ""])).toBe("");
  });
});

describe("orderModeLabel", () => {
  it.each([
    ["LOW_TO_HIGH", "LOW → HIGH"],
    ["HIGH_TO_LOW", "HIGH → LOW"],
    ["RANDOM", "RANDOM"],
  ] as const)("maps %s to %s", (mode, expected) => {
    expect(orderModeLabel(mode)).toBe(expected);
  });
});

describe("ORDER_MODE_LABELS", () => {
  it("keeps the setup wording, in setup order", () => {
    expect(Object.entries(ORDER_MODE_LABELS)).toEqual([
      ["LOW_TO_HIGH", "Low → High"],
      ["HIGH_TO_LOW", "High → Low"],
      ["RANDOM", "Random"],
    ]);
  });
});
