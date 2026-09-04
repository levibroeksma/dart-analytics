import { describe, expect, it } from "vitest";
import {
  RULESET_CAPABILITIES,
  capableRulesets,
  supportsMode,
  supportsCaptureMode,
  RULESET_DARTBOT,
  supportsDartbot,
  DEFAULT_BOT_LEVEL,
} from "@lib/game/rulesets/capabilities";

describe("RULESET_CAPABILITIES", () => {
  it("declares a pair for every ruleset version", () => {
    expect(Object.keys(RULESET_CAPABILITIES).sort()).toEqual([
      "121_V1",
      "121_V2",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SINGLES_V1",
      "SINGLES_V2",
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

  it("accepts visual board for TUOD now that it has a board engine path", () => {
    expect(supportsMode("TUOD_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("keeps every ruleset's original pair supported", () => {
    expect(supportsMode("501_V1", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
    expect(supportsMode("TUOD_V1", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
  });

  it("rejects an unknown pair", () => {
    expect(supportsMode("501_V1", "ANALYTICS", "DETAILED_DARTS")).toBe(false);
  });

  it.each([
    "SINGLES_V1",
    "SINGLES_V2",
    "BOBS27_V1",
    "DOUBLES_TRAINING_V1",
    "SHANGHAI_V1",
    "SHANGHAI_V2",
    "AROUND_THE_CLOCK_V1",
  ] as const)(
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

  it("gives 121_V2 the same pairs as 121_V1", () => {
    expect(supportsMode("121_V2", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
    expect(supportsMode("121_V2", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("gives SHANGHAI_V2 the same pairs as SHANGHAI_V1", () => {
    expect(supportsMode("SHANGHAI_V2", "RECREATIONAL", "DETAILED_DARTS")).toBe(
      true,
    );
    expect(supportsMode("SHANGHAI_V2", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });
});

describe("supportsCaptureMode", () => {
  it("accepts Bob's 27 under RECREATIONAL despite no QUICK_SCORE pair", () => {
    expect(supportsCaptureMode("BOBS27_V1", "RECREATIONAL")).toBe(true);
  });

  it("accepts Bob's 27 under ANALYTICS via its VISUAL_BOARD pair", () => {
    expect(supportsCaptureMode("BOBS27_V1", "ANALYTICS")).toBe(true);
  });

  it("rejects an unknown capture mode", () => {
    expect(supportsCaptureMode("BOBS27_V1", "UNKNOWN_CAPTURE_MODE")).toBe(
      false,
    );
  });

  it("rejects an unknown ruleset", () => {
    expect(
      supportsCaptureMode("NOT_A_REAL_RULESET" as never, "RECREATIONAL"),
    ).toBe(false);
  });
});

describe("capableRulesets", () => {
  it("lists every visual-capable ruleset", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "121_V1",
      "121_V2",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SINGLES_V1",
      "SINGLES_V2",
      "TUOD_V1",
    ]);
  });

  it("lists every quick-score ruleset", () => {
    expect(
      capableRulesets("RECREATIONAL", "QUICK_SCORE").length,
    ).toBeGreaterThan(0);
  });
});

describe("RULESET_DARTBOT", () => {
  it("admits the nine rulesets whose bot strategy exists today", () => {
    expect(
      (Object.keys(RULESET_DARTBOT) as (keyof typeof RULESET_DARTBOT)[])
        .filter((key) => RULESET_DARTBOT[key])
        .sort(),
    ).toEqual([
      "121_V1",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
});

describe("supportsDartbot", () => {
  it("accepts Bob's 27", () => {
    expect(supportsDartbot("BOBS27_V1")).toBe(true);
  });

  it("accepts Around the Clock", () => {
    expect(supportsDartbot("AROUND_THE_CLOCK_V1")).toBe(true);
  });

  it("accepts Doubles Training", () => {
    expect(supportsDartbot("DOUBLES_TRAINING_V1")).toBe(true);
  });

  it("accepts 501, now that X01Strategy exists (phase 7)", () => {
    expect(supportsDartbot("501_V1")).toBe(true);
  });

  it("accepts Shanghai", () => {
    expect(supportsDartbot("SHANGHAI_V1")).toBe(true);
  });

  it("accepts Singles Training", () => {
    expect(supportsDartbot("SINGLES_V1")).toBe(true);
  });

  it("accepts 121, on the reused X01Strategy", () => {
    expect(supportsDartbot("121_V1")).toBe(true);
  });

  it("accepts TUOD, on the reused X01Strategy", () => {
    expect(supportsDartbot("TUOD_V1")).toBe(true);
  });

  it("accepts Score Training, now that ScoringStrategy exists (D-G)", () => {
    expect(supportsDartbot("SCORE_TRAINING_V1")).toBe(true);
  });

  it("rejects Shanghai V2 and Singles V2 (F45 — 1v1 seating is already broken there)", () => {
    expect(supportsDartbot("SHANGHAI_V2")).toBe(false);
    expect(supportsDartbot("SINGLES_V2")).toBe(false);
  });

  it("rejects 121_V2, which is solo-only and never gains a bot seat", () => {
    expect(supportsDartbot("121_V2")).toBe(false);
  });

  it("rejects a ruleset absent from the map", () => {
    expect(supportsDartbot("SOME_FUTURE_RULESET_V1" as never)).toBe(false);
  });
});

describe("DEFAULT_BOT_LEVEL", () => {
  it("is 8, the level curve's own documented default", () => {
    expect(DEFAULT_BOT_LEVEL).toBe(8);
  });
});
