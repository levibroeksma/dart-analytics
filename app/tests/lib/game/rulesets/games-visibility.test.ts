import { describe, expect, it } from "vitest";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";

// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. `RECREATIONAL` +
// `DETAILED_DARTS` is the pair neither carded ruleset declares in
// `capabilities.ts`, which makes it the mode that exercises both the empty
// state and the active-session override.

describe("visibleGames", () => {
  it("shows every game under quick score", () => {
    const keys = visibleGames("RECREATIONAL", "QUICK_SCORE", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("501_V1");
    expect(keys).toContain("SCORE_TRAINING_V1");
  });

  it("shows only visual-capable games under analytics", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(["501_V1", "SCORE_TRAINING_V1"]);
  });

  it("hides every game under a mode no carded ruleset supports", () => {
    expect(visibleGames("RECREATIONAL", "DETAILED_DARTS", null)).toEqual([]);
  });

  it("never hides a game with an active session", () => {
    const keys = visibleGames("RECREATIONAL", "DETAILED_DARTS", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["501_V1"]);
  });

  it("does not duplicate a capable game that is also active", () => {
    const keys = visibleGames("ANALYTICS", "VISUAL_BOARD", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.filter((key) => key === "501_V1")).toHaveLength(1);
  });

  it("keeps the declared card order rather than the filter order", () => {
    const keys = visibleGames("RECREATIONAL", "QUICK_SCORE", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(GAME_CARDS.map((game) => game.rulesetVersionKey));
  });

  it("gives every card a setup href and copy", () => {
    for (const game of GAME_CARDS) {
      expect(game.href).toMatch(/^\/games\/.+\/setup$/);
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.caption.length).toBeGreaterThan(0);
    }
  });
});
