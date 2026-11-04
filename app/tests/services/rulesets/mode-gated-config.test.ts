import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateModeGatedConfig } from "@services/rulesets/mode-gated-config";
import { createThreeDartValidator } from "@services/rulesets/three-dart.validator";
import { scoreTrainingValidator } from "@services/rulesets/score-training/score-training.validator";
import { tuodValidator } from "@services/rulesets/tuod/tuod.validator";
import {
  oneTwentyOneValidator,
  oneTwentyOneV2Validator,
} from "@services/rulesets/one-twenty-one/one-twenty-one.validator";
import {
  fiveOhOneValidator,
  fiveOhOneV2Validator,
} from "@services/rulesets/five-oh-one/five-oh-one.validator";

const Schema = z
  .object({ rounds: z.number(), bonus: z.number().default(5) })
  .strict();

describe("validateModeGatedConfig", () => {
  it("returns the exact unsupported issue without parsing when the mode is unsupported", () => {
    const result = validateModeGatedConfig(
      Schema,
      { rounds: 3 },
      false,
      "Game V1 only supports X + Y",
    );
    expect(result).toEqual({
      valid: false,
      issues: ["Game V1 only supports X + Y"],
    });
  });

  it("returns the Zod issues when the config fails the schema", () => {
    const result = validateModeGatedConfig(
      Schema,
      { rounds: "three" },
      true,
      "unused",
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues).toEqual(
      Schema.safeParse({ rounds: "three" }).error?.issues,
    );
    expect(Array.isArray(result.issues)).toBe(true);
    expect((result.issues as unknown[]).length).toBeGreaterThan(0);
  });

  it("returns the parsed config with defaults applied when valid", () => {
    const result = validateModeGatedConfig(
      Schema,
      { rounds: 3 },
      true,
      "unused",
    );
    expect(result).toEqual({ valid: true, config: { rounds: 3, bonus: 5 } });
  });
});

const QUICK_SCORE_OR_VISUAL_BOARD =
  "RECREATIONAL + QUICK_SCORE or ANALYTICS + VISUAL_BOARD";
const unsupported = {
  config: {},
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
};

describe("mode-gated validators keep their exact unsupported issue", () => {
  it.each([
    ["Score Training", scoreTrainingValidator, "Score Training V1"],
    ["TUOD", tuodValidator, "TUOD V1"],
    ["121 V1", oneTwentyOneValidator, "121"],
    ["121 V2", oneTwentyOneV2Validator, "121"],
    ["501 V1", fiveOhOneValidator, "501 V1"],
    ["501 V2", fiveOhOneV2Validator, "501 V2"],
  ])("%s", (_name, validator, prefix) => {
    expect(validator.validateConfig(unsupported)).toEqual({
      valid: false,
      issues: [`${prefix} only supports ${QUICK_SCORE_OR_VISUAL_BOARD}`],
    });
  });

  it("three-dart", () => {
    const validator = createThreeDartValidator({
      label: "Test Game",
      configSchema: Schema,
      dartlessIssue: (clientKey) => clientKey,
    });
    expect(
      validator.validateConfig({
        config: {},
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    ).toEqual({
      valid: false,
      issues: [
        "Test Game V1 only supports RECREATIONAL + DETAILED_DARTS or ANALYTICS + VISUAL_BOARD",
      ],
    });
  });
});
