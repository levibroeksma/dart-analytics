import { describe, it, expect } from "vitest";
import { stepTagSet } from "@lib/training/routines/step-tag-set";
import type {
  CatalogTag,
  CatalogTagsResponse,
  CatalogTagSet,
} from "@lib/types";

const skill: CatalogTag = {
  axis: "SKILL",
  key: "SCORING",
  name: "Scoring",
  primary: true,
};
const set = (level: 1 | 2 | 3 | 4 | null): CatalogTagSet => ({
  tags: [skill],
  difficultyLevel: level,
});
const tags: CatalogTagsResponse = {
  games: {
    TUOD: { standalone: set(1), routineStep: set(3) },
    AROUND_THE_CLOCK: { standalone: set(1), routineStep: set(2) },
  },
  exercises: { BULL_UP: set(2) },
  cards: {},
};

describe("stepTagSet", () => {
  it("returns routineStep set for a GAME step", () => {
    expect(stepTagSet(tags, "GAME", "TUOD")).toBe(tags.games.TUOD.routineStep);
  });

  it("returns the exercise set for an exercise step", () => {
    expect(stepTagSet(tags, "BULL_UP", null)).toBe(tags.exercises.BULL_UP);
  });

  it("undefined for GAME without gameTypeKey", () => {
    expect(stepTagSet(tags, "GAME", null)).toBeUndefined();
  });

  it("undefined for unknown key", () => {
    expect(stepTagSet(tags, "NOPE", null)).toBeUndefined();
  });

  it("undefined when tags is null", () => {
    expect(stepTagSet(null, "BULL_UP", null)).toBeUndefined();
  });
});
