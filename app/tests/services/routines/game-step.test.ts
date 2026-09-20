import { describe, it, expect } from "vitest";
import {
  GAME_NOT_ROUTINE_ELIGIBLE,
  ROUTINE_GAME_STEPS,
  routineGameStepHook,
} from "@services/routines/game-step";
import { RULESET_CAPABILITIES } from "@lib/game/rulesets/capabilities";
import { getRulesetValidator } from "@services/rulesets/registry";

describe("routine game steps", () => {
  it("lists exactly the timed-mode games", () => {
    expect(Object.keys(ROUTINE_GAME_STEPS).sort()).toEqual([
      "121_V2",
      "SCORE_TRAINING_V1",
      "TUOD_V1",
    ]);
  });

  it("every eligible ruleset declares ANALYTICS + VISUAL_BOARD and has a validator", () => {
    for (const key of Object.keys(ROUTINE_GAME_STEPS)) {
      const pairs =
        RULESET_CAPABILITIES[key as keyof typeof RULESET_CAPABILITIES] ?? [];
      expect(
        pairs.some(
          (p) =>
            p.captureModeKey === "ANALYTICS" &&
            p.inputModeKey === "VISUAL_BOARD",
        ),
      ).toBe(true);
      expect(getRulesetValidator(key)).toBeDefined();
    }
  });

  it("applies the step's minutes to each ruleset's own keys", () => {
    const tuod: Record<string, unknown> = {
      duration_type: "ROUNDS",
      duration_value: 5,
    };
    ROUTINE_GAME_STEPS.TUOD_V1.applyStepDuration(tuod, 15);
    expect(tuod).toEqual({ duration_type: "MINUTES", duration_value: 15 });
    const st: Record<string, unknown> = {};
    ROUTINE_GAME_STEPS.SCORE_TRAINING_V1.applyStepDuration(st, 10);
    expect(st).toEqual({ duration_type: "MINUTES", duration_value: 10 });
    const ott: Record<string, unknown> = { duration_type: "TARGET" };
    ROUTINE_GAME_STEPS["121_V2"].applyStepDuration(ott, 12);
    expect(ott).toEqual({ duration_type: "MINUTES", duration_value: 12 });
  });

  it("bounds come from each game's own duration helper, and agree across all three (the routine builder's GAME-step hint is one literal, '3-30 min', for all of them)", () => {
    expect(ROUTINE_GAME_STEPS.TUOD_V1.minuteBounds).toEqual({
      min: 3,
      max: 30,
    });
    expect(ROUTINE_GAME_STEPS.SCORE_TRAINING_V1.minuteBounds).toEqual({
      min: 3,
      max: 30,
    });
    expect(ROUTINE_GAME_STEPS["121_V2"].minuteBounds).toEqual({
      min: 3,
      max: 30,
    });
  });

  it("an unknown or null key is not eligible", () => {
    expect(routineGameStepHook("501_V1")).toBeUndefined();
    expect(routineGameStepHook(null)).toBeUndefined();
  });

  it("names one refusal reason for both callers to report", () => {
    expect(GAME_NOT_ROUTINE_ELIGIBLE).toBe("game not routine-eligible");
  });
});
