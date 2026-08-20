import { describe, expect, it } from "vitest";
import { GAME_CARDS, visibleGames } from "@lib/game/rulesets/games-visibility";

// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Every carded ruleset declares a pair under
// RECREATIONAL; all but TUOD_V1 (QUICK_SCORE-only, no VISUAL_BOARD path)
// also declare one under ANALYTICS.

describe("visibleGames", () => {
  it("shows every carded game under recreational", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual([
      "SCORE_TRAINING_V1",
      "501_V1",
      "BOBS27_V1",
      "SINGLES_V1",
      "DOUBLES_TRAINING_V1",
      "SHANGHAI_V1",
      "121_V1",
      "AROUND_THE_CLOCK_V1",
      "TUOD_V1",
    ]);
  });

  it("shows every ANALYTICS-capable carded game under analytics, excluding the quick-score-only TUOD_V1", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(
      [
        "SCORE_TRAINING_V1",
        "501_V1",
        "BOBS27_V1",
        "SINGLES_V1",
        "DOUBLES_TRAINING_V1",
        "SHANGHAI_V1",
        "121_V1",
        "AROUND_THE_CLOCK_V1",
      ].sort(),
    );
    expect(keys).not.toContain("TUOD_V1");
  });

  it("hides every game under a capture mode no carded ruleset supports", () => {
    expect(visibleGames("UNKNOWN_CAPTURE_MODE", null)).toEqual([]);
  });

  it("never hides a game with an active session", () => {
    const keys = visibleGames("UNKNOWN_CAPTURE_MODE", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["501_V1"]);
  });

  it("never hides TUOD_V1 under ANALYTICS when it has an active session", () => {
    const keys = visibleGames("ANALYTICS", "TUOD_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toContain("TUOD_V1");
  });

  it("does not duplicate a capable game that is also active", () => {
    const keys = visibleGames("ANALYTICS", "501_V1").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.filter((key) => key === "501_V1")).toHaveLength(1);
  });

  it("keeps the declared card order rather than the filter order", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
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
