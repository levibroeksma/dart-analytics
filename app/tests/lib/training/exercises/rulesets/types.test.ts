import { describe, expect, it } from "vitest";
import {
  EXERCISE_RULESET_CONFIGS,
  BullseyeCheckoutV1Config,
  BullUpV1Config,
  ScoreThresholdV1Config,
  SwitchingTargetScoringV1Config,
  SwitchingV1Config,
  TargetScoringV1Config,
  WarmUpV1Config,
} from "@lib/training/exercises/rulesets/types";

describe("TargetScoringV1Config", () => {
  const VALID = { targets: [20, 19, 18, 25] };

  it("accepts the default list, bull included", () => {
    expect(TargetScoringV1Config.safeParse(VALID).success).toBe(true);
  });

  it("accepts any single board target", () => {
    for (const target of [1, 7, 20, 25]) {
      expect(
        TargetScoringV1Config.safeParse({ targets: [target] }).success,
      ).toBe(true);
    }
  });

  it("rejects an empty target list", () => {
    expect(TargetScoringV1Config.safeParse({ targets: [] }).success).toBe(
      false,
    );
  });

  it("rejects numbers that are not on the board", () => {
    for (const target of [0, 21, 24, 26, 50]) {
      expect(
        TargetScoringV1Config.safeParse({ targets: [target] }).success,
      ).toBe(false);
    }
  });

  it("rejects a repeated target", () => {
    const result = TargetScoringV1Config.safeParse({ targets: [20, 20, 19] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key, scoring included — it is locked", () => {
    const result = TargetScoringV1Config.safeParse({
      ...VALID,
      scoring: { single: 1, treble: 3 },
    });
    expect(result.success).toBe(false);
  });

  it("is registered under TARGET_SCORING_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.TARGET_SCORING_V1).toBe(
      TargetScoringV1Config,
    );
  });
});

describe("SwitchingTargetScoringV1Config", () => {
  const VALID = { targets: [20, 19, 18] };

  it("accepts the default sequence and one with the bull", () => {
    expect(SwitchingTargetScoringV1Config.safeParse(VALID).success).toBe(true);
    expect(
      SwitchingTargetScoringV1Config.safeParse({ targets: [25, 1, 7] }).success,
    ).toBe(true);
  });

  it("rejects a sequence that is not exactly three targets", () => {
    for (const targets of [[20, 19], [20, 19, 18, 17], []]) {
      expect(
        SwitchingTargetScoringV1Config.safeParse({ targets }).success,
      ).toBe(false);
    }
  });

  it("rejects numbers that are not on the board", () => {
    for (const target of [0, 21, 24, 26]) {
      expect(
        SwitchingTargetScoringV1Config.safeParse({ targets: [20, 19, target] })
          .success,
      ).toBe(false);
    }
  });

  it("rejects a repeated target", () => {
    expect(
      SwitchingTargetScoringV1Config.safeParse({ targets: [20, 20, 19] })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown key, scoring included — it is locked", () => {
    expect(
      SwitchingTargetScoringV1Config.safeParse({ ...VALID, scoring: {} })
        .success,
    ).toBe(false);
  });

  it("is registered under SWITCHING_TARGET_SCORING_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.SWITCHING_TARGET_SCORING_V1).toBe(
      SwitchingTargetScoringV1Config,
    );
  });
});

describe("ScoreThresholdV1Config", () => {
  it("accepts the 65 threshold", () => {
    expect(ScoreThresholdV1Config.safeParse({ threshold: 65 }).success).toBe(
      true,
    );
  });

  it("rejects any other threshold — V1 is 65 only", () => {
    for (const threshold of [60, 64, 66, 100, "65"]) {
      expect(ScoreThresholdV1Config.safeParse({ threshold }).success).toBe(
        false,
      );
    }
  });

  it("rejects a missing threshold and an unknown key", () => {
    expect(ScoreThresholdV1Config.safeParse({}).success).toBe(false);
    expect(
      ScoreThresholdV1Config.safeParse({ threshold: 65, targets: [20] })
        .success,
    ).toBe(false);
  });

  it("is registered under SCORE_THRESHOLD_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.SCORE_THRESHOLD_V1).toBe(
      ScoreThresholdV1Config,
    );
  });
});

describe("SwitchingV1Config", () => {
  const VALID = {
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  };

  it("accepts a well-formed configuration", () => {
    expect(SwitchingV1Config.safeParse(VALID).success).toBe(true);
  });

  it("rejects an empty target list", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a target outside the board", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [26] });
    expect(result.success).toBe(false);
  });

  it("rejects the bull, which has no treble to aim at (D297)", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [20, 25] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = SwitchingV1Config.safeParse({
      ...VALID,
      captureModeKey: "ANALYTICS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative scoring values", () => {
    const result = SwitchingV1Config.safeParse({
      ...VALID,
      scoring: { single: -1, double: 2, treble: 3 },
    });
    expect(result.success).toBe(false);
  });
});

describe("WarmUpV1Config", () => {
  it("still accepts the bull as a phase target — it aims at no ring (D297)", () => {
    const result = WarmUpV1Config.safeParse({
      phases: [{ name: "Bull", targets: [25], weight: 1 }],
    });

    expect(result.success).toBe(true);
  });
});

describe("BullseyeCheckoutV1Config", () => {
  it("accepts the 81 start score", () => {
    expect(BullseyeCheckoutV1Config.safeParse({ startScore: 81 }).success).toBe(
      true,
    );
  });

  it("rejects any other start score — V1 is 81 only", () => {
    for (const startScore of [61, 80, 82, 100, "81"]) {
      expect(BullseyeCheckoutV1Config.safeParse({ startScore }).success).toBe(
        false,
      );
    }
  });

  it("rejects a missing start score and an unknown key", () => {
    expect(BullseyeCheckoutV1Config.safeParse({}).success).toBe(false);
    expect(
      BullseyeCheckoutV1Config.safeParse({ startScore: 81, threshold: 65 })
        .success,
    ).toBe(false);
  });

  it("is registered under BULLSEYE_CHECKOUT_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.BULLSEYE_CHECKOUT_V1).toBe(
      BullseyeCheckoutV1Config,
    );
  });
});

describe("BullUpV1Config", () => {
  it("accepts the empty configuration — the target is always the bull", () => {
    expect(BullUpV1Config.safeParse({}).success).toBe(true);
  });

  it("rejects any key", () => {
    expect(BullUpV1Config.safeParse({ target: 25 }).success).toBe(false);
    expect(BullUpV1Config.safeParse({ startScore: 81 }).success).toBe(false);
  });

  it("is registered under BULL_UP_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.BULL_UP_V1).toBe(BullUpV1Config);
  });
});
