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

  it("decisionQuality rises monotonically from level 1 to 15 and stays in 0..100", () => {
    let prior = -1;
    for (let level = 1; level <= 15; level++) {
      const { decisionQuality } = skillProfileForLevel(level);
      expect(decisionQuality).toBeGreaterThan(prior);
      expect(decisionQuality).toBeGreaterThanOrEqual(0);
      expect(decisionQuality).toBeLessThanOrEqual(100);
      prior = decisionQuality;
    }
  });

  it("level 15 tops out at 100", () => {
    expect(skillProfileForLevel(15).decisionQuality).toBe(100);
  });

  it("anchors level 6 to the v2 clipped pooled fit", () => {
    const anchor = skillProfileForLevel(6);
    expect(anchor.sigmaAlongMm).toBe(29.5);
    expect(anchor.sigmaAcrossMm).toBe(23.5);
    expect(anchor.biasXMm).toBe(-1.21);
    expect(anchor.biasYMm).toBe(-1.57);
    expect(anchor.outlierRate).toBe(0.0184);
  });

  it("anchors level 1 and level 15 to the v2 recalibration's values", () => {
    const level1 = skillProfileForLevel(1);
    expect(level1.sigmaAlongMm).toBe(48.8);
    expect(level1.sigmaAcrossMm).toBe(38.4);

    const level15 = skillProfileForLevel(15);
    expect(level15.sigmaAlongMm).toBe(8.8);
    expect(level15.sigmaAcrossMm).toBe(6.0);
  });

  it("gives every adjacent level pair a distinct bias pair", () => {
    for (let level = 1; level < 15; level++) {
      const lower = skillProfileForLevel(level);
      const upper = skillProfileForLevel(level + 1);
      expect([upper.biasXMm, upper.biasYMm]).not.toEqual([
        lower.biasXMm,
        lower.biasYMm,
      ]);
    }
  });

  it("shrinks bias magnitude from level 7 to level 15", () => {
    for (let level = 7; level < 15; level++) {
      const weaker = skillProfileForLevel(level);
      const stronger = skillProfileForLevel(level + 1);
      expect(Math.abs(stronger.biasXMm)).toBeLessThan(Math.abs(weaker.biasXMm));
      expect(Math.abs(stronger.biasYMm)).toBeLessThan(Math.abs(weaker.biasYMm));
    }
  });
});
