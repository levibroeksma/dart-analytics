import { describe, it, expect } from "vitest";
import { ExerciseTemplateCatalogEntry } from "@routes/exercise-templates/types";

const ROW = {
  exerciseTemplateId: "et-1",
  name: "Finishing",
  description: null,
  exerciseTypeKey: "GAME",
  gameTypeKey: "TUOD",
  gameRulesetVersionKey: "TUOD_V1",
  exerciseTypeName: "Game",
  gameTypeName: "Tour of the Doubles",
  difficultyLevel: 3,
  exerciseTypeDescription: "Play a game as a step",
  gameTypeDescription: "Hit every double in order",
};

describe("ExerciseTemplateCatalogEntry", () => {
  it("accepts a catalog row with a nullable description and gameTypeKey", () => {
    expect(ExerciseTemplateCatalogEntry.safeParse(ROW).success).toBe(true);
  });

  it("keeps the exercise and game type descriptions", () => {
    const parsed = ExerciseTemplateCatalogEntry.parse(ROW);
    expect(parsed.exerciseTypeDescription).toBe("Play a game as a step");
    expect(parsed.gameTypeDescription).toBe("Hit every double in order");
  });

  it("accepts null type descriptions", () => {
    const parsed = ExerciseTemplateCatalogEntry.safeParse({
      ...ROW,
      exerciseTypeDescription: null,
      gameTypeDescription: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a null gameTypeName and difficultyLevel", () => {
    const parsed = ExerciseTemplateCatalogEntry.safeParse({
      ...ROW,
      gameTypeName: null,
      difficultyLevel: null,
    });
    expect(parsed.success).toBe(true);
  });

  it.each([0, 5, 2.5])("rejects difficultyLevel %s", (difficultyLevel) => {
    expect(
      ExerciseTemplateCatalogEntry.safeParse({ ...ROW, difficultyLevel })
        .success,
    ).toBe(false);
  });

  it("rejects a row missing exerciseTypeKey", () => {
    const parsed = ExerciseTemplateCatalogEntry.safeParse({
      exerciseTemplateId: "et-1",
      name: "Finishing",
      description: null,
      gameTypeKey: null,
    });
    expect(parsed.success).toBe(false);
  });
});
