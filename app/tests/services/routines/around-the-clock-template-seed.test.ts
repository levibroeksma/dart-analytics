import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ROUTINE_CAPTURE_MODE_KEY,
  ROUTINE_GAME_STEPS,
  ROUTINE_INPUT_MODE_KEY,
} from "@services/routines/game-step";
import { getRulesetValidator } from "@services/rulesets/registry";

const seedPath = fileURLToPath(
  new URL(
    "../../../../database/seeds/0028_around_the_clock_routine_templates.sql",
    import.meta.url,
  ),
);

/** Every `default_configuration` JSON literal seed 0028 inserts. */
function seededConfigs(): Record<string, unknown>[] {
  const sql = readFileSync(seedPath, "utf8");
  return [...sql.matchAll(/'(\{[^']*\})'::jsonb/g)].map(
    (match) => JSON.parse(match[1]) as Record<string, unknown>,
  );
}

describe("seed 0028 Around the Clock routine templates", () => {
  it("seeds one template per 1/2/3-dart difficulty", () => {
    expect(seededConfigs().map((config) => config.difficulty)).toEqual([
      "INTERMEDIATE",
      "HARD",
      "PRO",
    ]);
  });

  it("each default starts as a routine step once the step's minutes are applied", () => {
    const hook = ROUTINE_GAME_STEPS.AROUND_THE_CLOCK_V2;
    const validator = getRulesetValidator("AROUND_THE_CLOCK_V2")!;
    for (const config of seededConfigs()) {
      hook.applyStepDuration(config, 15);
      expect(
        validator.validateConfig({
          config,
          captureModeKey: ROUTINE_CAPTURE_MODE_KEY,
          inputModeKey: ROUTINE_INPUT_MODE_KEY,
        }).valid,
      ).toBe(true);
    }
  });
});
