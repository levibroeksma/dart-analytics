import { describe, it, expect } from "vitest";
import { DIFFICULTY_LEVEL_NAMES } from "@lib/catalog/difficulty";

describe("DIFFICULTY_LEVEL_NAMES", () => {
  it("names levels 1-4 in order, indexed by level - 1", () => {
    expect(DIFFICULTY_LEVEL_NAMES).toEqual([
      "Beginner",
      "Intermediate",
      "Advanced",
      "Expert",
    ]);
    expect(DIFFICULTY_LEVEL_NAMES[3 - 1]).toBe("Advanced");
  });
});
