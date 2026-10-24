import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GAME_CARDS,
  GAME_GROUPS,
  cardForRuleset,
  groupedGames,
  primaryCards,
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
      "501_V2",
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
      "AROUND_THE_CLOCK_V3",
      "BASEBALL_V1",
    ]);
  });

  it("shows every ANALYTICS-capable carded game under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(
      [
        "SCORE_TRAINING_V1",
        "501_V2",
        "BOBS27_V1",
        "SINGLES_V1",
        "DOUBLES_TRAINING_V1",
        "SHANGHAI_V1",
        "121_V1",
        "AROUND_THE_CLOCK_V1",
        "AROUND_THE_CLOCK_V3",
        "BASEBALL_V1",
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
    const keys = visibleGames("UNKNOWN_CAPTURE_MODE", "501_V2").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(["501_V2"]);
  });

  it("does not duplicate a capable game that is also active", () => {
    const keys = visibleGames("ANALYTICS", "501_V2").map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys.filter((key) => key === "501_V2")).toHaveLength(1);
  });

  it("keeps the declared card order rather than the filter order", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual(GAME_CARDS.map((game) => game.rulesetVersionKey));
  });

  it("gives every card a setup href and copy", () => {
    for (const game of GAME_CARDS) {
      expect(game.href).toMatch(/^\/games\/[^/?]+\/setup(\?[^?]+)?$/);
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
      ["MATCH PLAY", ["501_V2", "121_V1", "CRICKET_V1", "TACTICS_V1"]],
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
      [
        "CLASSICS",
        [
          "SHANGHAI_V1",
          "AROUND_THE_CLOCK_V1",
          "AROUND_THE_CLOCK_V3",
          "BASEBALL_V1",
        ],
      ],
    ]);
  });

  it("drops a group with no cards", () => {
    const only501 = GAME_CARDS.filter(
      (game) => game.rulesetVersionKey === "501_V2",
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

describe("cardForRuleset", () => {
  it("maps both 501 ruleset versions to the single 501 card", () => {
    expect(cardForRuleset(GAME_CARDS, "501_V1")?.rulesetVersionKey).toBe(
      "501_V2",
    );
    expect(cardForRuleset(GAME_CARDS, "501_V2")?.rulesetVersionKey).toBe(
      "501_V2",
    );
  });

  it("resolves a ruleset with no card of its own to its game type's primary card", () => {
    expect(
      cardForRuleset(GAME_CARDS, "AROUND_THE_CLOCK_V2")?.rulesetVersionKey,
    ).toBe("AROUND_THE_CLOCK_V1");
    expect(cardForRuleset(GAME_CARDS, "SHANGHAI_V2")?.rulesetVersionKey).toBe(
      "SHANGHAI_V1",
    );
    expect(cardForRuleset(GAME_CARDS, "121_V2")?.rulesetVersionKey).toBe(
      "121_V1",
    );
    expect(cardForRuleset(GAME_CARDS, "SINGLES_V3")?.rulesetVersionKey).toBe(
      "SINGLES_V1",
    );
  });

  it("keeps a ruleset's own card over the primary one", () => {
    expect(
      cardForRuleset(GAME_CARDS, "AROUND_THE_CLOCK_V3")?.rulesetVersionKey,
    ).toBe("AROUND_THE_CLOCK_V3");
  });

  it("returns undefined for null or an uncarded key", () => {
    expect(cardForRuleset(GAME_CARDS, null)).toBeUndefined();
    expect(cardForRuleset(GAME_CARDS, "NOPE")).toBeUndefined();
  });
});

describe("GAME_CARDS gameTypeKey parity", () => {
  it("equals the Game type header of a ruleset doc, for every card", () => {
    const dir = join(process.cwd(), "..", "docs", "game-rules", "rulesets");
    const docKeys = readdirSync(dir)
      .map((file) =>
        /^Game type: `([^`]+)`/m.exec(readFileSync(join(dir, file), "utf8")),
      )
      .flatMap((match) => (match ? [match[1]] : []));

    for (const card of GAME_CARDS) {
      expect(docKeys, card.rulesetVersionKey).toContain(card.gameTypeKey);
    }
  });
});

describe("the Nine Lives card", () => {
  const card = GAME_CARDS.find(
    (game) => game.rulesetVersionKey === "AROUND_THE_CLOCK_V3",
  );

  it("is in CLASSICS with the lives href and the V3 key", () => {
    expect(card).toMatchObject({
      gameTypeKey: "AROUND_THE_CLOCK",
      group: "CLASSICS",
      href: "/games/around-the-clock/setup?lives=3",
      title: "Nine Lives",
    });
  });

  it("shows under both canonical capture modes", () => {
    for (const mode of ["RECREATIONAL", "ANALYTICS"]) {
      expect(
        visibleGames(mode, null).map((game) => game.rulesetVersionKey),
      ).toContain("AROUND_THE_CLOCK_V3");
    }
  });

  it("leaves the Around the Clock card unchanged", () => {
    expect(
      GAME_CARDS.find(
        (game) => game.rulesetVersionKey === "AROUND_THE_CLOCK_V1",
      ),
    ).toMatchObject({
      href: "/games/around-the-clock/setup",
      title: "Around the Clock",
    });
  });
});

describe("primaryCards", () => {
  it("keeps the first card of each game type, dropping a preset card", () => {
    const keys = primaryCards().map((card) => card.rulesetVersionKey);
    expect(keys).toContain("AROUND_THE_CLOCK_V1");
    expect(keys).not.toContain("AROUND_THE_CLOCK_V3");
  });

  it("has one card per game type", () => {
    const types = primaryCards().map((card) => card.gameTypeKey);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe("cardForRuleset — Bob's 27 Easy", () => {
  it("keeps a BOBS27_V2 session on the Bob's 27 card", () => {
    const card = cardForRuleset(GAME_CARDS, "BOBS27_V2");
    expect(card?.gameTypeKey).toBe("BOBS27");
    expect(card?.rulesetVersionKey).toBe("BOBS27_V1");
  });
});

describe("cardForRuleset — Cricket 1v1", () => {
  it("keeps a CRICKET_V2 session on the Cricket card", () => {
    const card = cardForRuleset(GAME_CARDS, "CRICKET_V2");
    expect(card?.gameTypeKey).toBe("CRICKET");
    expect(card?.rulesetVersionKey).toBe("CRICKET_V1");
  });
});

describe("cardForRuleset — Tactics 1v1", () => {
  it("keeps a TACTICS_V2 session on the Tactics card", () => {
    const card = cardForRuleset(GAME_CARDS, "TACTICS_V2");
    expect(card?.gameTypeKey).toBe("TACTICS");
    expect(card?.rulesetVersionKey).toBe("TACTICS_V1");
  });
});
