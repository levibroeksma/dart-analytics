import { describe, expect, it } from "vitest";
import {
  RULESET_CAPABILITIES,
  capableRulesets,
  supportsMode,
} from "@lib/game/rulesets/capabilities";

describe("RULESET_CAPABILITIES", () => {
  it("declares a pair for every ruleset version", () => {
    expect(Object.keys(RULESET_CAPABILITIES).sort()).toEqual([
      "501_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });

  it("gives every ruleset at least one supported pair", () => {
    for (const pairs of Object.values(RULESET_CAPABILITIES)) {
      expect(pairs.length).toBeGreaterThan(0);
    }
  });
});

describe("supportsMode", () => {
  it("accepts visual board for 501", () => {
    expect(supportsMode("501_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("accepts visual board for Score Training", () => {
    expect(supportsMode("SCORE_TRAINING_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(
      true,
    );
  });

  it("accepts visual board for Bob's 27", () => {
    expect(supportsMode("BOBS27_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("keeps Bob's 27's original DETAILED_DARTS pair supported", () => {
    expect(supportsMode("BOBS27_V1", "RECREATIONAL", "DETAILED_DARTS")).toBe(
      true,
    );
  });

  it("rejects visual board for a game with no visual engine path", () => {
    expect(supportsMode("TUOD_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(false);
  });

  it("keeps every ruleset's original pair supported", () => {
    expect(supportsMode("501_V1", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
    expect(supportsMode("TUOD_V1", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
  });

  it("rejects an unknown pair", () => {
    expect(supportsMode("501_V1", "ANALYTICS", "DETAILED_DARTS")).toBe(false);
  });

  it.each(["SINGLES_V1", "BOBS27_V1", "DOUBLES_TRAINING_V1"] as const)(
    "gives %s RECREATIONAL + DETAILED_DARTS, not ANALYTICS + DETAILED_DARTS",
    (rulesetVersionKey) => {
      expect(
        supportsMode(rulesetVersionKey, "RECREATIONAL", "DETAILED_DARTS"),
      ).toBe(true);
      expect(
        supportsMode(rulesetVersionKey, "ANALYTICS", "DETAILED_DARTS"),
      ).toBe(false);
    },
  );
});

describe("capableRulesets", () => {
  it("lists every visual-capable ruleset", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "501_V1",
      "BOBS27_V1",
      "SCORE_TRAINING_V1",
    ]);
  });

  it("lists every quick-score ruleset", () => {
    expect(
      capableRulesets("RECREATIONAL", "QUICK_SCORE").length,
    ).toBeGreaterThan(0);
  });
});
