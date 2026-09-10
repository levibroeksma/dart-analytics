import { describe, expect, it } from "vitest";
import {
  EXERCISE_RULESET_CONFIGS,
  WarmUpPhaseConfig,
  WarmUpV1Config,
} from "@lib/types";

const VALID_PHASE = { name: "Upper", targets: [5, 20, 1], durationSeconds: 60 };

describe("WarmUpPhaseConfig", () => {
  it("accepts a well-formed phase", () => {
    expect(WarmUpPhaseConfig.safeParse(VALID_PHASE).success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = WarmUpPhaseConfig.safeParse({ ...VALID_PHASE, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a target above 25 (past the bull)", () => {
    const result = WarmUpPhaseConfig.safeParse({
      ...VALID_PHASE,
      targets: [26],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty targets list", () => {
    const result = WarmUpPhaseConfig.safeParse({ ...VALID_PHASE, targets: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive duration", () => {
    const result = WarmUpPhaseConfig.safeParse({
      ...VALID_PHASE,
      durationSeconds: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key (strict object)", () => {
    const result = WarmUpPhaseConfig.safeParse({
      ...VALID_PHASE,
      captureModeKey: "ANALYTICS",
    });
    expect(result.success).toBe(false);
  });
});

describe("WarmUpV1Config", () => {
  it("accepts a non-empty phase list", () => {
    const result = WarmUpV1Config.safeParse({ phases: [VALID_PHASE] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty phase list", () => {
    expect(WarmUpV1Config.safeParse({ phases: [] }).success).toBe(false);
  });

  it("rejects more than twelve phases", () => {
    const phases = Array.from({ length: 13 }, () => VALID_PHASE);
    expect(WarmUpV1Config.safeParse({ phases }).success).toBe(false);
  });
});

describe("EXERCISE_RULESET_CONFIGS", () => {
  it("maps WARM_UP_V1 to WarmUpV1Config", () => {
    expect(EXERCISE_RULESET_CONFIGS.WARM_UP_V1).toBe(WarmUpV1Config);
  });
});
