import { describe, expect, it } from "vitest";
import {
  RULESET_CAPABILITIES,
  capableRulesets,
  supportsMode,
  supportsCaptureMode,
  RULESET_DARTBOT,
  supportsDartbot,
  DEFAULT_BOT_LEVEL,
  STATS_TAGS,
  GAME_TYPE_BY_RULESET,
} from "@lib/game/rulesets/capabilities";

describe("RULESET_CAPABILITIES", () => {
  it("declares a pair for every ruleset version", () => {
    expect(Object.keys(RULESET_CAPABILITIES).sort()).toEqual([
      "121_V1",
      "121_V2",
      "501_V1",
      "501_V2",
      "AROUND_THE_CLOCK_V1",
      "AROUND_THE_CLOCK_V2",
      "AROUND_THE_CLOCK_V3",
      "BASEBALL_V1",
      "BOBS27_V1",
      "BOBS27_V2",
      "CRICKET_V1",
      "CRICKET_V2",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SHANGHAI_V3",
      "SINGLES_V1",
      "SINGLES_V2",
      "SINGLES_V3",
      "TACTICS_V1",
      "TACTICS_V2",
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
    "SHANGHAI_V3",
    "AROUND_THE_CLOCK_V1",
    "AROUND_THE_CLOCK_V2",
    "CRICKET_V1",
    "CRICKET_V2",
    "TACTICS_V1",
    "TACTICS_V2",
    "BASEBALL_V1",
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

  it.each(["SHANGHAI_V2", "SHANGHAI_V3"] as const)(
    "gives %s the same pairs as SHANGHAI_V1",
    (key) => {
      expect(supportsMode(key, "RECREATIONAL", "DETAILED_DARTS")).toBe(true);
      expect(supportsMode(key, "ANALYTICS", "VISUAL_BOARD")).toBe(true);
    },
  );
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
      "501_V2",
      "AROUND_THE_CLOCK_V1",
      "AROUND_THE_CLOCK_V2",
      "AROUND_THE_CLOCK_V3",
      "BASEBALL_V1",
      "BOBS27_V1",
      "BOBS27_V2",
      "CRICKET_V1",
      "CRICKET_V2",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SHANGHAI_V3",
      "SINGLES_V1",
      "SINGLES_V2",
      "SINGLES_V3",
      "TACTICS_V1",
      "TACTICS_V2",
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
  it("admits the fifteen rulesets whose bot strategy exists today", () => {
    expect(
      (Object.keys(RULESET_DARTBOT) as (keyof typeof RULESET_DARTBOT)[])
        .filter((key) => RULESET_DARTBOT[key])
        .sort(),
    ).toEqual([
      "121_V1",
      "501_V1",
      "501_V2",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "BOBS27_V2",
      "CRICKET_V2",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SHANGHAI_V3",
      "SINGLES_V1",
      "SINGLES_V3",
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

  it("refuses Around the Clock V2 — a bot seat falls back to V1", () => {
    expect(supportsDartbot("AROUND_THE_CLOCK_V2")).toBe(false);
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

  it.each(["SHANGHAI_V2", "SHANGHAI_V3"] as const)(
    "accepts %s, now that its 2-seat admission is wired (D259)",
    (key) => {
      expect(supportsDartbot(key)).toBe(true);
    },
  );

  it("accepts Singles Training V3, now that its 2-seat admission is wired (#290)", () => {
    expect(supportsDartbot("SINGLES_V3")).toBe(true);
  });

  it("rejects Singles V2, which no setup screen creates a session on", () => {
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

describe("BASEBALL_V1", () => {
  it("declares DETAILED_DARTS and VISUAL_BOARD, the board tag, game type BASEBALL, no Dartbot", () => {
    expect(RULESET_CAPABILITIES.BASEBALL_V1).toEqual([
      { captureModeKey: "RECREATIONAL", inputModeKey: "DETAILED_DARTS" },
      { captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" },
    ]);
    expect(STATS_TAGS.BASEBALL_V1).toEqual(["board"]);
    expect(GAME_TYPE_BY_RULESET.BASEBALL_V1).toBe("BASEBALL");
    expect(supportsDartbot("BASEBALL_V1")).toBe(false);
  });
});

describe("Around the Clock V3 capabilities", () => {
  it("declares DETAILED_DARTS and VISUAL_BOARD", () => {
    expect(RULESET_CAPABILITIES.AROUND_THE_CLOCK_V3).toEqual(
      RULESET_CAPABILITIES.AROUND_THE_CLOCK_V2,
    );
  });

  it("is not a dartbot ruleset", () => {
    expect(supportsDartbot("AROUND_THE_CLOCK_V3")).toBe(false);
  });
});

describe("Bob's 27 V2 capabilities", () => {
  it("declares the same pairs as V1", () => {
    expect(RULESET_CAPABILITIES.BOBS27_V2).toEqual(
      RULESET_CAPABILITIES.BOBS27_V1,
    );
  });

  it("is a dartbot ruleset", () => {
    expect(supportsDartbot("BOBS27_V2")).toBe(true);
  });

  it("belongs to the BOBS27 game type", () => {
    expect(GAME_TYPE_BY_RULESET.BOBS27_V2).toBe("BOBS27");
  });

  it("reports the V1 stats tags", () => {
    expect(STATS_TAGS.BOBS27_V2).toEqual(STATS_TAGS.BOBS27_V1);
  });
});

describe("Tactics V2 capabilities", () => {
  it("declares the same pairs as V1", () => {
    expect(RULESET_CAPABILITIES.TACTICS_V2).toEqual(
      RULESET_CAPABILITIES.TACTICS_V1,
    );
  });

  it("belongs to the TACTICS game type", () => {
    expect(GAME_TYPE_BY_RULESET.TACTICS_V2).toBe("TACTICS");
  });

  it("reports the V1 stats tags", () => {
    expect(STATS_TAGS.TACTICS_V2).toEqual(STATS_TAGS.TACTICS_V1);
  });

  it("has no dartbot", () => {
    expect(supportsDartbot("TACTICS_V2")).toBe(false);
  });
});

describe("Cricket V2 capabilities", () => {
  it("declares the same pairs as V1", () => {
    expect(RULESET_CAPABILITIES.CRICKET_V2).toEqual(
      RULESET_CAPABILITIES.CRICKET_V1,
    );
  });

  it("belongs to the CRICKET game type", () => {
    expect(GAME_TYPE_BY_RULESET.CRICKET_V2).toBe("CRICKET");
  });

  it("reports the V1 stats tags", () => {
    expect(STATS_TAGS.CRICKET_V2).toEqual(STATS_TAGS.CRICKET_V1);
  });

  it("admits a dartbot", () => {
    expect(supportsDartbot("CRICKET_V2")).toBe(true);
  });

  it("keeps solo Cricket without a dartbot", () => {
    expect(supportsDartbot("CRICKET_V1")).toBe(false);
  });
});
