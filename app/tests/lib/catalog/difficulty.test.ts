import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { DIFFICULTY_LEVEL_NAMES } from "@lib/catalog/difficulty";
import { parseVocabulary } from "../../../scripts/tags/parse-tags";

const tagsMd = readFileSync(
  fileURLToPath(
    new URL("../../../../docs/game-rules/TAGS.md", import.meta.url),
  ),
  "utf8",
);

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

  it("matches the TAGS.md Difficulty value names in order", () => {
    const difficulty = parseVocabulary(tagsMd).find(
      (axis) => axis.key === "DIFFICULTY",
    );
    expect(difficulty?.values.map((v) => v.name)).toEqual([
      ...DIFFICULTY_LEVEL_NAMES,
    ]);
  });
});
