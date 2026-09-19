import { describe, it, expect } from "vitest";
import { ExerciseTemplateCatalogEntry } from "@routes/exercise-templates/types";

describe("ExerciseTemplateCatalogEntry", () => {
  it("accepts a catalog row with a nullable description and gameTypeKey", () => {
    const parsed = ExerciseTemplateCatalogEntry.safeParse({
      exerciseTemplateId: "et-1",
      name: "Finishing",
      description: null,
      exerciseTypeKey: "GAME",
      gameTypeKey: "TUOD",
    });
    expect(parsed.success).toBe(true);
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
