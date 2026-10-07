import { describe, expect, it } from "vitest";
import {
  GAME_CARDS,
  GAME_GROUPS,
  groupedGames,
  visibleGames,
} from "@lib/game/rulesets/games-visibility";

// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Every carded ruleset now declares a pair under both
// RECREATIONAL and ANALYTICS. Descriptions are meant to be short, so they stay
// on a single line in the ui

describe("visibleGames", () => {
  it("shows every carded game under recreational", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual([
      "501_V1",
      "121_V1",
      "CRICKET_V1",
      "TACTICS_V1",
      "SCORE_TRAINING_V1",
      "SINGLES_V1",
      "DOUBLES_TRAINING_V1",
      "BOBS27_V1",
      "TUOD_V1",
      "SHANGHAI_V1",
      "AROUND_THE_CLOCK_V1",
    ]);
  });

  it("shows every ANALYTICS-capable carded game under analytics", () => {
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
        "CRICKET_V1",
        "TACTICS_V1",
        "TUOD_V1",
      ].sort(),
    );
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
      expect(game.caption).not.toMatch(/\n/);
    }
  });
});

describe("groupedGames", () => {
  it("groups every card in design order", () => {
    expect(
      groupedGames().map((group) => [
        group.title,
        group.games.map((game) => game.rulesetVersionKey),
      ]),
    ).toEqual([
      ["MATCH PLAY", ["501_V1", "121_V1", "CRICKET_V1", "TACTICS_V1"]],
      [
        "TRAINING",
        [
          "SCORE_TRAINING_V1",
          "SINGLES_V1",
          "DOUBLES_TRAINING_V1",
          "BOBS27_V1",
          "TUOD_V1",
        ],
      ],
      ["CLASSICS", ["SHANGHAI_V1", "AROUND_THE_CLOCK_V1"]],
    ]);
  });

  it("drops a group with no cards", () => {
    const only501 = GAME_CARDS.filter(
      (game) => game.rulesetVersionKey === "501_V1",
    );
    expect(groupedGames(only501).map((group) => group.key)).toEqual([
      "MATCH_PLAY",
    ]);
  });

  it("puts every card in a known group", () => {
    const keys = GAME_GROUPS.map((group) => group.key);
    for (const card of GAME_CARDS) expect(keys).toContain(card.group);
  });
});
