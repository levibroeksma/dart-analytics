import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";

describe("chooseTarget", () => {
  it("aims a NUMBER target at that number's outer single", () => {
    const intent = chooseTarget({ target: { kind: "NUMBER", number: 14 } });
    expect(intent).toEqual({ targetNumber: 14, zoneKey: "OUTER_SINGLE" });
    expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).not.toBeNull();
  });

  it("aims a DOUBLE target at that number's double", () => {
    const intent = chooseTarget({ target: { kind: "DOUBLE", number: 20 } });
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "DOUBLE" });
    expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).not.toBeNull();
  });

  it("aims a BULL target at the inner bull, target number 25", () => {
    const intent = chooseTarget({ target: { kind: "BULL" } });
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "INNER_BULL" });
    expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
