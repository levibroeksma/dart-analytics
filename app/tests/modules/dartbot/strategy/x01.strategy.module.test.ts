import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";

const HIGH_DECISION = 80;
const LOW_DECISION = 10;

describe("chooseTarget", () => {
  it("below the decision threshold, always fires at treble 20 regardless of checkout path", () => {
    const intent = chooseTarget(
      { remaining: 40, checkoutPath: ["D20"] },
      LOW_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("at or above the threshold, aims at the checkout path's first step", () => {
    const intent = chooseTarget(
      { remaining: 170, checkoutPath: ["T20", "T20", "BULL"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("parses a double step", () => {
    const intent = chooseTarget(
      { remaining: 40, checkoutPath: ["D20"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "DOUBLE" });
    expect(zoneCentroid(intent.targetNumber!, intent.zoneKey)).not.toBeNull();
  });

  it("parses the inner-bull step", () => {
    const intent = chooseTarget(
      { remaining: 50, checkoutPath: ["BULL"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "INNER_BULL" });
  });

  it("parses the outer-bull step (worth 25, the '25' route label)", () => {
    const intent = chooseTarget(
      { remaining: 135, checkoutPath: ["25", "T20", "BULL"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "OUTER_BULL" });
  });

  it("parses a plain-number single step", () => {
    const intent = chooseTarget(
      { remaining: 120, checkoutPath: ["20", "T20", "D20"] },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "OUTER_SINGLE" });
  });

  it("falls back to treble 20 when no route exists (a bogey number), even above the threshold", () => {
    const intent = chooseTarget(
      { remaining: 169, checkoutPath: null },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("falls back to treble 20 above 170, where no route exists either", () => {
    const intent = chooseTarget(
      { remaining: 501, checkoutPath: null },
      HIGH_DECISION,
    );
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });
});
