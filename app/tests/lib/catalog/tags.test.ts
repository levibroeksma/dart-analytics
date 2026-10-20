import { describe, it, expect } from "vitest";
import { cardTags } from "@lib/catalog/tags";
import type { AxisKey, CatalogTag, CatalogTagSet } from "@lib/types";

const tag = (axis: AxisKey, key: string, primary = false): CatalogTag => ({
  axis,
  key,
  name: key,
  primary,
});

const set = (...tags: CatalogTag[]): CatalogTagSet => ({
  tags,
  difficultyLevel: null,
});

const keys = (tags: CatalogTag[]) => tags.map((t) => t.key);

describe("cardTags", () => {
  it("hides the pressure pill when pressure is NONE", () => {
    const result = cardTags(
      set(tag("SKILL", "SCORING", true), tag("PRESSURE", "NONE")),
      "game",
    );
    expect(keys(result)).toEqual(["SCORING"]);
  });

  it("shows a pressure pill other than NONE", () => {
    const result = cardTags(
      set(tag("SKILL", "SCORING", true), tag("PRESSURE", "PENALTY")),
      "game",
    );
    expect(keys(result)).toEqual(["SCORING", "PENALTY"]);
  });

  it("puts the primary skill first even when listed later", () => {
    const result = cardTags(
      set(
        tag("SKILL", "DOUBLES"),
        tag("FORMAT", "SOLO"),
        tag("SKILL", "SCORING", true),
      ),
      "exercise",
    );
    expect(keys(result)).toEqual(["SCORING", "DOUBLES"]);
  });

  it("hides secondary skills on a game and orders format, pressure, family", () => {
    const result = cardTags(
      set(
        tag("FAMILY", "X01"),
        tag("PRESSURE", "RESET"),
        tag("FORMAT", "SOLO"),
        tag("FORMAT", "ONE_V_ONE"),
        tag("SKILL", "DOUBLES"),
        tag("SKILL", "SCORING", true),
        tag("SESSION_ROLE", "CORE"),
        tag("DIFFICULTY", "BEGINNER"),
      ),
      "game",
    );
    expect(keys(result)).toEqual([
      "SCORING",
      "SOLO",
      "ONE_V_ONE",
      "RESET",
      "X01",
    ]);
  });

  it("shows session roles last on an exercise and hides format and family", () => {
    const result = cardTags(
      set(
        tag("SESSION_ROLE", "WARM_UP"),
        tag("SESSION_ROLE", "CORE"),
        tag("FORMAT", "SOLO"),
        tag("FAMILY", "X01"),
        tag("PRESSURE", "SETBACK"),
        tag("SKILL", "CHECKOUT"),
        tag("SKILL", "DOUBLES", true),
      ),
      "exercise",
    );
    expect(keys(result)).toEqual([
      "DOUBLES",
      "CHECKOUT",
      "SETBACK",
      "WARM_UP",
      "CORE",
    ]);
  });

  it("returns an empty list for an empty set", () => {
    expect(cardTags(set(), "game")).toEqual([]);
    expect(cardTags(set(), "exercise")).toEqual([]);
  });
});
