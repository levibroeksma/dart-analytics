import { describe, it, expect } from "vitest";
import {
  RESULT_DIRECTION,
  SECTIONS,
  isSectionId,
  sectionsForGame,
} from "@lib/stats/section-registry";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";

describe("statistics section registry", () => {
  it("keys every entry by its own id", () => {
    for (const [key, meta] of Object.entries(SECTIONS))
      expect(meta.id).toBe(key);
  });

  it("computes all three phase-1 sections in sql, bucketable", () => {
    for (const meta of Object.values(SECTIONS)) {
      expect(meta.computeSite).toBe("sql");
      expect(meta.bucketable).toBe(true);
    }
  });

  it("only completion includes abandoned sessions", () => {
    expect(SECTIONS.completion.includesAbandoned).toBe(true);
    expect(SECTIONS.volume.includesAbandoned).toBe(false);
    expect(SECTIONS["session-result"].includesAbandoned).toBe(false);
  });

  it("declares session-result as config-sensitive to the ruleset version", () => {
    expect(SECTIONS["session-result"].configSensitive).toEqual([
      "ruleset_version_key",
    ]);
  });

  it("orders a game's sections per the catalog", () => {
    expect(sectionsForGame("501")).toEqual([
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("rejects a section id outside phase 1", () => {
    expect(isSectionId("heatmap")).toBe(false);
    expect(isSectionId("completion")).toBe(true);
  });

  it("declares a result direction for every game type", () => {
    const gameTypes = new Set(Object.values(GAME_TYPE_BY_RULESET));
    for (const gameType of gameTypes) {
      expect(
        Object.prototype.hasOwnProperty.call(RESULT_DIRECTION, gameType),
      ).toBe(true);
    }
  });
});
