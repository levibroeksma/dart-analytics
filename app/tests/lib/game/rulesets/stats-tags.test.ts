import { describe, it, expect } from "vitest";
import {
  GAME_TYPE_BY_RULESET,
  RULESET_CAPABILITIES,
  STATS_TAGS,
  isGameTypeKey,
  rulesetsOfGameType,
} from "@lib/game/rulesets/capabilities";

describe("statistics capability tags", () => {
  it("tags and maps every ruleset that declares a mode", () => {
    const keys = Object.keys(RULESET_CAPABILITIES).sort();
    expect(Object.keys(STATS_TAGS).sort()).toEqual(keys);
    expect(Object.keys(GAME_TYPE_BY_RULESET).sort()).toEqual(keys);
  });

  it("gives every VISUAL_BOARD ruleset the board tag", () => {
    for (const tags of Object.values(STATS_TAGS))
      expect(tags).toContain("board");
  });

  it("stores intent only for Doubles Training and Bob's 27", () => {
    const stored = Object.entries(STATS_TAGS)
      .filter(([, tags]) => tags.includes("intent-stored"))
      .map(([key]) => key)
      .sort();
    expect(stored).toEqual(["BOBS27_V1", "DOUBLES_TRAINING_V1"].sort());
  });

  it("groups ruleset versions under their game type", () => {
    expect(rulesetsOfGameType("SINGLES_TRAINING").sort()).toEqual([
      "SINGLES_V1",
      "SINGLES_V2",
      "SINGLES_V3",
    ]);
    expect(isGameTypeKey("ONE_TWENTY_ONE")).toBe(true);
    expect(isGameTypeKey("121_V1")).toBe(false);
  });
});
