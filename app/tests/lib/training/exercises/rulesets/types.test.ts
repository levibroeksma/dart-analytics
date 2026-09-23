import { describe, expect, it } from "vitest";
import {
  EXERCISE_RULESET_CONFIGS,
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
