import { describe, expect, it } from "vitest";
import {
  LEVEL_SKILL_TABLE,
  skillProfileForLevel,
} from "@modules/dartbot/skill-profile.module";

describe("skillProfileForLevel", () => {
  it("returns the exact table row for a valid level", () => {
    expect(skillProfileForLevel(8)).toBe(LEVEL_SKILL_TABLE[8]);
  });

  it("clamps a level below 1 to level 1", () => {
    expect(skillProfileForLevel(0)).toBe(LEVEL_SKILL_TABLE[1]);
  });

  it("clamps a level above 15 to level 15", () => {
    expect(skillProfileForLevel(20)).toBe(LEVEL_SKILL_TABLE[15]);
  });

  it("defines all fifteen levels", () => {
    expect(Object.keys(LEVEL_SKILL_TABLE)).toHaveLength(15);
  });

  it("shrinks scatter spread monotonically as level increases", () => {
    for (let level = 1; level < 15; level++) {
      const weaker = skillProfileForLevel(level);
      const stronger = skillProfileForLevel(level + 1);
      expect(stronger.sigmaAlongMm).toBeLessThanOrEqual(weaker.sigmaAlongMm);
      expect(stronger.sigmaAcrossMm).toBeLessThanOrEqual(weaker.sigmaAcrossMm);
    }
  });
});
