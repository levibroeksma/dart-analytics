// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import {
  STEP_ADAPTERS,
  resolveStepAdapter,
  stepAdapterKey,
} from "@lib/training/routines/adapters/step-adapter.registry";
import { ROUTINE_GAME_STEPS } from "@services/routines/game-step";

describe("step adapter registry", () => {
  it("has one adapter per non-game kind and per server-eligible game ruleset", () => {
    const keys = Object.keys(STEP_ADAPTERS).sort();
    expect(keys).toEqual(
      [
        "WARM_UP",
        "SWITCHING",
        "DOUBLE_PATTERN",
        "TARGET_SCORING",
        "SWITCHING_TARGET_SCORING",
        "SCORE_THRESHOLD",
        ...Object.keys(ROUTINE_GAME_STEPS).map((k) => `GAME:${k}`),
      ].sort(),
    );
  });

  it("resolves the 65 or More step", () => {
    expect(resolveStepAdapter("SCORE_THRESHOLD")?.headerLabel).toBe(
      "65 or more",
    );
  });

  it("derives the key from a resolved step", () => {
    expect(
      stepAdapterKey({
        exerciseTypeKey: "SWITCHING",
        gameRulesetVersionKey: null,
      }),
    ).toBe("SWITCHING");
    expect(
      stepAdapterKey({
        exerciseTypeKey: "GAME",
        gameRulesetVersionKey: "TUOD_V1",
      }),
    ).toBe("GAME:TUOD_V1");
  });

  it("header labels are the Phase-1 strings for the four seeded kinds", () => {
    expect(resolveStepAdapter("WARM_UP")?.headerLabel).toBe("warm up");
    expect(resolveStepAdapter("SWITCHING")?.headerLabel).toBe("switching");
    expect(resolveStepAdapter("DOUBLE_PATTERN")?.headerLabel).toBe("doubles");
    expect(resolveStepAdapter("TARGET_SCORING")?.headerLabel).toBe(
      "target scoring",
    );
    expect(resolveStepAdapter("SWITCHING_TARGET_SCORING")?.headerLabel).toBe(
      "switching target scoring",
    );
    expect(resolveStepAdapter("GAME:TUOD_V1")?.headerLabel).toBe("finishing");
    expect(resolveStepAdapter("GAME:SCORE_TRAINING_V1")?.headerLabel).toBe(
      "scoring",
    );
    expect(resolveStepAdapter("GAME:121_V2")?.headerLabel).toBe("121");
  });

  it("an unknown key resolves to nothing", () => {
    expect(resolveStepAdapter("GAME:501_V1")).toBeUndefined();
  });
});
