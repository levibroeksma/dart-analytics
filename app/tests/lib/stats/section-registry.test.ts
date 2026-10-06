import { describe, it, expect } from "vitest";
import {
  MAX_FOLD_DARTS,
  PAGE_ORDER_OVERRIDES,
  RESULT_DIRECTION,
  ROUTINE_SECTIONS,
  SECTIONS,
  isSectionId,
  sectionSite,
  sectionsForGame,
  sectionsForRoutine,
  sectionsForStep,
  tagsForGameType,
} from "@lib/stats/section-registry";
import { GAME_TYPE_BY_RULESET } from "@lib/game/rulesets/capabilities";
import type { GameTypeKey, SectionId } from "@lib/types";

/** The tag- and game-gated set for a game, in `SECTIONS`' declaration order, before `PAGE_ORDER_OVERRIDES` reorders it — the baseline decision 11's permutation invariant is checked against. */
function tagDerivedSections(gameTypeKey: GameTypeKey): SectionId[] {
  const tags = tagsForGameType(gameTypeKey);
  return (Object.keys(SECTIONS) as SectionId[]).filter((id) => {
    const meta = SECTIONS[id];
    if (meta.games && !meta.games.includes(gameTypeKey)) return false;
    return meta.requires.every((requirement) =>
      typeof requirement === "string"
        ? tags.has(requirement)
        : requirement.anyOf.some((tag) => tags.has(tag)),
    );
  });
}

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

  it("session-result is at version 2: the bestAverage pair joined its metrics", () => {
    expect(SECTIONS["session-result"].version).toBe(2);
  });

  it("declares session-result as config-sensitive to the ruleset version", () => {
    expect(SECTIONS["session-result"].configSensitive).toEqual([
      "ruleset_version_key",
    ]);
  });

  it("orders a game's sections per the catalog", () => {
    expect(sectionsForGame("501")).toEqual([
      "scoring-trend",
      "checkout-rate",
      "double-performance",
      "checkout-path",
      "bust-rate",
      "leg-stats",
      "treble-rate",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("orders the ladder games' sections per the catalog", () => {
    const expected = [
      "ladder-progress",
      "checkout-rate",
      "double-performance",
      "checkout-path",
      "bust-rate",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ];
    expect(sectionsForGame("ONE_TWENTY_ONE")).toEqual(expected);
    expect(sectionsForGame("TUOD")).toEqual(expected);
  });

  it("orders Score Training's sections per the catalog", () => {
    expect(sectionsForGame("SCORE_TRAINING")).toEqual([
      "scoring-trend",
      "treble-rate",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("orders Doubles Training's sections per the catalog", () => {
    expect(sectionsForGame("DOUBLES_TRAINING")).toEqual([
      "training-result",
      "target-accuracy",
      "confusion",
      "grouping",
      "miss-direction",
      "loose-darts",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("orders Bob's 27's sections per the catalog, with the survival section (decision 10)", () => {
    expect(sectionsForGame("BOBS27")).toEqual([
      "target-accuracy",
      "bobs27-survival",
      "confusion",
      "grouping",
      "miss-direction",
      "loose-darts",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("gives Singles Training the derived-intent sections but not grouping (decision 6)", () => {
    expect(sectionsForGame("SINGLES_TRAINING")).toEqual([
      "training-result",
      "target-accuracy",
      "confusion",
      "miss-direction",
      "loose-darts",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("orders Shanghai's sections per the catalog, session-result moved by the override (decision 11)", () => {
    expect(sectionsForGame("SHANGHAI")).toEqual([
      "target-accuracy",
      "shanghai-count",
      "session-result",
      "confusion",
      "miss-direction",
      "loose-darts",
      "heatmap",
      "completion",
      "volume",
    ]);
  });

  it("orders Around the Clock's sections per the catalog, darts-per-target first (decision 10)", () => {
    expect(sectionsForGame("AROUND_THE_CLOCK")).toEqual([
      "atc-darts-per-target",
      "target-accuracy",
      "confusion",
      "miss-direction",
      "loose-darts",
      "heatmap",
      "session-result",
      "completion",
      "volume",
    ]);
  });

  it("declares the six board sections with their registry shape", () => {
    const intentAnyOf = [{ anyOf: ["intent-stored", "intent-derived"] }];
    expect(SECTIONS.heatmap).toMatchObject({
      requires: ["board"],
      bucketable: false,
      params: ["target"],
    });
    expect(SECTIONS["target-accuracy"]).toMatchObject({
      requires: intentAnyOf,
      siteByTag: { "intent-derived": "server" },
      bucketable: true,
      params: [],
    });
    expect(SECTIONS.confusion).toMatchObject({
      requires: intentAnyOf,
      siteByTag: { "intent-derived": "server" },
      bucketable: false,
      params: [],
    });
    expect(SECTIONS.grouping).toMatchObject({
      requires: ["board", "intent-stored"],
      bucketable: true,
      params: [],
    });
    expect(SECTIONS.grouping.siteByTag).toBeUndefined();
    expect(SECTIONS["miss-direction"]).toMatchObject({
      requires: ["board", ...intentAnyOf],
      siteByTag: { "intent-derived": "server" },
      bucketable: false,
      params: [],
    });
    expect(SECTIONS["loose-darts"]).toMatchObject({
      requires: ["board", ...intentAnyOf],
      siteByTag: { "intent-derived": "server" },
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
      expect(SECTIONS[id].version).toBe(id === "heatmap" ? 2 : 1);
    }
  });

  it("versions leg-stats at 2 so buckets cached before bestLeg joined the metrics are not reused", () => {
    expect(SECTIONS["leg-stats"].version).toBe(2);
  });

  it("versions scoring-trend at 2 so closed buckets cached under the old first-nine clause are not reused", () => {
    expect(SECTIONS["scoring-trend"].version).toBe(2);
  });

  it("declares the three game-specific sections with their registry shape (decision 10, 13)", () => {
    expect(SECTIONS["atc-darts-per-target"]).toMatchObject({
      requires: ["intent-derived"],
      games: ["AROUND_THE_CLOCK"],
      computeSite: "server",
      bucketable: true,
      includesAbandoned: false,
      configSensitive: ["ruleset_version_key", "difficulty", "segment_rule"],
      params: [],
      version: 1,
    });
    expect(SECTIONS["bobs27-survival"]).toMatchObject({
      requires: ["intent-stored"],
      games: ["BOBS27"],
      computeSite: "server",
      bucketable: true,
      includesAbandoned: false,
      configSensitive: [
        "ruleset_version_key",
        "start_score",
        "miss_penalty_multiplier",
        "bull_hit_value",
      ],
      params: [],
      version: 1,
    });
    expect(SECTIONS["training-result"]).toMatchObject({
      games: ["SINGLES_TRAINING", "DOUBLES_TRAINING"],
      computeSite: "server",
      bucketable: true,
      includesAbandoned: false,
      configSensitive: ["ruleset_version_key", "difficulty", "scoring_mode"],
      version: 1,
    });
    expect(SECTIONS["shanghai-count"]).toMatchObject({
      requires: ["intent-derived"],
      games: ["SHANGHAI"],
      computeSite: "server",
      bucketable: true,
      includesAbandoned: false,
      configSensitive: [],
      params: [],
      version: 1,
    });
  });

  it("resolves site by tag: target-accuracy is server on a derived game, sql on a stored one", () => {
    expect(sectionSite(SECTIONS["target-accuracy"], "SHANGHAI")).toBe("server");
    expect(sectionSite(SECTIONS["target-accuracy"], "DOUBLES_TRAINING")).toBe(
      "sql",
    );
  });

  it("resolves site by tag for every widened section across derived and stored games", () => {
    for (const id of [
      "target-accuracy",
      "confusion",
      "miss-direction",
      "loose-darts",
    ] as const) {
      expect(sectionSite(SECTIONS[id], "SHANGHAI")).toBe("server");
      expect(sectionSite(SECTIONS[id], "AROUND_THE_CLOCK")).toBe("server");
      expect(sectionSite(SECTIONS[id], "SINGLES_TRAINING")).toBe("server");
      expect(sectionSite(SECTIONS[id], "DOUBLES_TRAINING")).toBe("sql");
      expect(sectionSite(SECTIONS[id], "BOBS27")).toBe("sql");
    }
  });

  it("resolves heatmap to server only for a derived game with a target", () => {
    const meta = SECTIONS.heatmap;
    for (const game of [
      "SHANGHAI",
      "SINGLES_TRAINING",
      "AROUND_THE_CLOCK",
    ] as const) {
      expect(sectionSite(meta, game)).toBe("sql");
      expect(sectionSite(meta, game, true)).toBe("server");
    }
    expect(sectionSite(meta, "DOUBLES_TRAINING", true)).toBe("sql");
    expect(sectionSite(meta, "BOBS27", true)).toBe("sql");
    expect(sectionSite(SECTIONS["target-accuracy"], "SHANGHAI", true)).toBe(
      "server",
    );
  });

  it("versions heatmap at 2 so cached heatmaps are not reused after the derived-target change", () => {
    expect(SECTIONS.heatmap.version).toBe(2);
  });

  it("falls back to computeSite when a section declares no siteByTag", () => {
    expect(sectionSite(SECTIONS.grouping, "BOBS27")).toBe("sql");
  });

  it("keeps every PAGE_ORDER_OVERRIDES entry a permutation of the tag-derived set for its game", () => {
    const entries = Object.entries(PAGE_ORDER_OVERRIDES) as [
      GameTypeKey,
      readonly SectionId[],
    ][];
    expect(entries.length).toBeGreaterThan(0);
    for (const [gameTypeKey, override] of entries) {
      const derived = tagDerivedSections(gameTypeKey);
      expect(new Set(override)).toEqual(new Set(derived));
      expect(override.length).toBe(derived.length);
    }
  });

  it("holds the Shanghai override named in decision 11", () => {
    expect(PAGE_ORDER_OVERRIDES.SHANGHAI).toEqual(sectionsForGame("SHANGHAI"));
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

  it("gives Cricket no result direction and only the board tag", () => {
    expect(RESULT_DIRECTION.CRICKET).toBeNull();
    expect(tagsForGameType("CRICKET")).toEqual(new Set(["board"]));
  });

  it("tagsForGameType unions the tags of every ruleset version", () => {
    expect(tagsForGameType("DOUBLES_TRAINING")).toEqual(
      new Set(["board", "intent-stored", "target-sequence"]),
    );
    expect(tagsForGameType("501")).toEqual(
      new Set(["board", "scoring", "checkout", "leg"]),
    );
  });

  it("declares the eight checkout-family sections with their registry shape", () => {
    expect(SECTIONS["scoring-trend"]).toMatchObject({
      requires: ["scoring"],
      computeSite: "sql",
      bucketable: true,
      configSensitive: [],
    });
    expect(SECTIONS["ladder-progress"]).toMatchObject({
      requires: ["ladder"],
      computeSite: "server",
      bucketable: true,
      configSensitive: ["ruleset_version_key"],
    });
    expect(SECTIONS["checkout-rate"]).toMatchObject({
      requires: ["checkout"],
      computeSite: "server",
      bucketable: true,
      configSensitive: [],
    });
    expect(SECTIONS["double-performance"]).toMatchObject({
      requires: ["checkout"],
      computeSite: "server",
      bucketable: true,
      configSensitive: [],
    });
    expect(SECTIONS["checkout-path"]).toMatchObject({
      requires: ["checkout"],
      computeSite: "server",
      bucketable: false,
      configSensitive: [],
    });
    expect(SECTIONS["bust-rate"]).toMatchObject({
      requires: ["checkout"],
      computeSite: "server",
      bucketable: true,
      configSensitive: [],
    });
    expect(SECTIONS["leg-stats"]).toMatchObject({
      requires: ["leg"],
      computeSite: "server",
      bucketable: true,
      configSensitive: [],
    });
    expect(SECTIONS["treble-rate"]).toMatchObject({
      requires: ["scoring", "board"],
      computeSite: "sql",
      bucketable: true,
      configSensitive: [],
    });
    for (const id of [
      "scoring-trend",
      "ladder-progress",
      "checkout-rate",
      "double-performance",
      "checkout-path",
      "bust-rate",
      "leg-stats",
      "treble-rate",
    ] as const) {
      expect(SECTIONS[id].includesAbandoned).toBe(false);
      expect(SECTIONS[id].params).toEqual([]);
      expect(SECTIONS[id].version).toBe(
        id === "scoring-trend" || id === "leg-stats" ? 2 : 1,
      );
    }
  });

  it("exports the server fold dart cap", () => {
    expect(MAX_FOLD_DARTS).toBe(5_000);
  });
});

describe("routine section registry (phase 6b plan decision 6)", () => {
  it("keys every entry by its own id, disjoint from SECTIONS", () => {
    for (const [key, meta] of Object.entries(ROUTINE_SECTIONS)) {
      expect(meta.id).toBe(key);
      expect(isSectionId(key)).toBe(false);
    }
  });

  it("matches decision 6's includesAbandoned column", () => {
    expect(ROUTINE_SECTIONS["routine-volume"].includesAbandoned).toBe(false);
    expect(ROUTINE_SECTIONS["routine-completion"].includesAbandoned).toBe(true);
    expect(ROUTINE_SECTIONS["step-volume"].includesAbandoned).toBe(false);
    expect(ROUTINE_SECTIONS["step-result"].includesAbandoned).toBe(false);
  });

  it("computes routine-volume/routine-completion/step-volume in sql and step-result on the server, all bucketable", () => {
    for (const id of [
      "routine-volume",
      "routine-completion",
      "step-volume",
    ] as const) {
      expect(ROUTINE_SECTIONS[id].computeSite).toBe("sql");
      expect(ROUTINE_SECTIONS[id].bucketable).toBe(true);
    }
    expect(ROUTINE_SECTIONS["step-result"].computeSite).toBe("server");
    expect(ROUTINE_SECTIONS["step-result"].bucketable).toBe(true);
  });

  it("tags run sections routine-surface and step sections step-surface", () => {
    expect(ROUTINE_SECTIONS["routine-volume"].surface).toBe("routine");
    expect(ROUTINE_SECTIONS["routine-completion"].surface).toBe("routine");
    expect(ROUTINE_SECTIONS["step-volume"].surface).toBe("step");
    expect(ROUTINE_SECTIONS["step-result"].surface).toBe("step");
  });

  it("sectionsForRoutine returns the two run-level sections in page order", () => {
    expect(sectionsForRoutine().map((meta) => meta.id)).toEqual([
      "routine-volume",
      "routine-completion",
    ]);
  });

  it("sectionsForStep gives a GAME step exactly sectionsForGame's metas", () => {
    const result = sectionsForStep({
      exerciseTypeKey: "GAME",
      gameTypeKey: "SCORE_TRAINING",
    });

    expect(result.kind).toBe("game");
    if (result.kind !== "game") throw new Error("expected a game step");
    expect(result.gameTypeKey).toBe("SCORE_TRAINING");
    expect(result.sections.map((meta) => meta.id)).toEqual(
      sectionsForGame("SCORE_TRAINING"),
    );
  });

  it("sectionsForStep gives a dart exercise step-result and step-volume", () => {
    const result = sectionsForStep({
      exerciseTypeKey: "SWITCHING",
      gameTypeKey: null,
    });

    expect(result.kind).toBe("exercise");
    expect(result.sections.map((meta) => meta.id)).toEqual([
      "step-result",
      "step-volume",
    ]);
  });

  it("sectionsForStep gives Warm-Up step-volume only", () => {
    const result = sectionsForStep({
      exerciseTypeKey: "WARM_UP",
      gameTypeKey: null,
    });

    expect(result.kind).toBe("exercise");
    expect(result.sections.map((meta) => meta.id)).toEqual(["step-volume"]);
  });

  it("fixes requires to [] for every routine section", () => {
    for (const meta of Object.values(ROUTINE_SECTIONS)) {
      expect(meta.requires).toEqual([]);
    }
  });
});
