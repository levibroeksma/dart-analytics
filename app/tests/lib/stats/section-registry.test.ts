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
    for (const id of ["completion", "volume", "session-result"] as const) {
      expect(SECTIONS[id].computeSite).toBe("sql");
      expect(SECTIONS[id].bucketable).toBe(true);
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
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("orders an intent-stored game's sections per the catalog", () => {
    const expected = [
      "target-accuracy",
      "confusion",
      "grouping",
      "miss-direction",
      "loose-darts",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ];
    expect(sectionsForGame("DOUBLES_TRAINING")).toEqual(expected);
    expect(sectionsForGame("BOBS27")).toEqual(expected);
  });

  it("gives Singles Training heatmap but no intent section (phase 4 defers its accuracy)", () => {
    const sections = sectionsForGame("SINGLES_TRAINING");
    expect(sections).toContain("heatmap");
    expect(sections).not.toContain("target-accuracy");
    expect(sections).not.toContain("confusion");
    expect(sections).not.toContain("grouping");
    expect(sections).not.toContain("miss-direction");
    expect(sections).not.toContain("loose-darts");
  });

  it("declares the six board sections with their registry shape", () => {
    expect(SECTIONS.heatmap).toMatchObject({
      requires: ["board"],
      bucketable: false,
      params: ["target"],
    });
    expect(SECTIONS["target-accuracy"]).toMatchObject({
      requires: ["intent-stored"],
      bucketable: true,
      params: [],
    });
    expect(SECTIONS.confusion).toMatchObject({
      requires: ["intent-stored"],
      bucketable: false,
      params: [],
    });
    expect(SECTIONS.grouping).toMatchObject({
      requires: ["board", "intent-stored"],
      bucketable: true,
      params: [],
    });
    expect(SECTIONS["miss-direction"]).toMatchObject({
      requires: ["board", "intent-stored"],
      bucketable: false,
      params: [],
    });
    expect(SECTIONS["loose-darts"]).toMatchObject({
      requires: ["board", "intent-stored"],
      bucketable: true,
      params: [],
    });
    for (const id of [
      "heatmap",
      "target-accuracy",
      "confusion",
      "grouping",
      "miss-direction",
      "loose-darts",
    ] as const) {
      expect(SECTIONS[id].computeSite).toBe("sql");
      expect(SECTIONS[id].includesAbandoned).toBe(false);
      expect(SECTIONS[id].configSensitive).toEqual([]);
      expect(SECTIONS[id].version).toBe(1);
    }
  });

  it("declares params as [] for every phase-1 section", () => {
    expect(SECTIONS.completion.params).toEqual([]);
    expect(SECTIONS.volume.params).toEqual([]);
    expect(SECTIONS["session-result"].params).toEqual([]);
  });

  it("rejects a section id outside phase 1 and phase 2", () => {
    expect(isSectionId("unknown-section")).toBe(false);
    expect(isSectionId("completion")).toBe(true);
    expect(isSectionId("heatmap")).toBe(true);
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
