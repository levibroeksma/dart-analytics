import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  parseRulesFile,
  parseVocabulary,
} from "../../../scripts/tags/parse-tags";

const rules = (p: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../../docs/game-rules/${p}`, import.meta.url)),
    "utf8",
  );

const axes = parseVocabulary(rules("TAGS.md"));

function routineDoc(difficulty: string): string {
  return [
    "Game type: `X`",
    "## Tags",
    "### Standalone",
    "| Axis | Tags |",
    "| --- | --- |",
    "| Skill | ACCURACY (primary) |",
    "| Session role | CORE |",
    "| Format | SOLO |",
    "| Difficulty | BEGINNER |",
    "| Mechanic | SEQUENTIAL |",
    "| Pressure | NONE |",
    "| Family | STANDARD |",
    "### Routine step",
    "| Axis | Tags |",
    "| --- | --- |",
    "| Skill | ACCURACY (primary) |",
    "| Session role | CORE |",
    "| Format | SOLO |",
    `| Difficulty | ${difficulty} |`,
    "| Mechanic | SEQUENTIAL |",
    "| Pressure | NONE |",
    "## Objective",
  ].join("\n");
}

describe("parseVocabulary", () => {
  it("parses the 7 axes of the real TAGS.md", () => {
    expect(axes.map((a) => a.key)).toEqual([
      "SKILL",
      "SESSION_ROLE",
      "FORMAT",
      "DIFFICULTY",
      "MECHANIC",
      "PRESSURE",
      "FAMILY",
    ]);
    const skill = axes[0];
    expect(skill.rule).toBe("primary");
    expect(skill.values).toHaveLength(7);
    expect(axes[2].values[1].key).toBe("ONE_V_ONE");
    expect(axes[2].values[1].name).toBe("1v1");
    expect(axes.find((a) => a.key === "PRESSURE")?.exclusive).toBe("NONE");
    expect(skill.exclusive).toBeNull();
  });
});

describe("parseRulesFile", () => {
  it("reads the game type key and the standalone block of cricket.md", () => {
    const r = parseRulesFile(rules("rulesets/cricket.md"), axes);
    expect(r.gameTypeKey).toBe("CRICKET");
    expect(r.exerciseTypeKey).toBeNull();
    const standalone = r.blocks.find((b) => b.context === "STANDALONE");
    expect(standalone?.tags).toContainEqual({
      axis: "SKILL",
      key: "SCORING",
      primary: true,
    });
  });

  it("reads an exercise's flat table as one ROUTINE_STEP block", () => {
    const r = parseRulesFile(rules("training/exercises/doubles-lock.md"), axes);
    expect(r.exerciseTypeKey).toBe("DOUBLES_LOCK");
    expect(r.gameTypeKey).toBeNull();
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].context).toBe("ROUTINE_STEP");
  });

  it("splits a label such as INTERMEDIATE (1 dart)", () => {
    const r = parseRulesFile(
      routineDoc("INTERMEDIATE (1 dart), ADVANCED (2 darts)"),
      axes,
    );
    const routine = r.blocks.find((b) => b.context === "ROUTINE_STEP");
    expect(routine?.difficultyLabels).toEqual([
      { key: "INTERMEDIATE", label: "1 dart" },
      { key: "ADVANCED", label: "2 darts" },
    ]);
    const standalone = r.blocks.find((b) => b.context === "STANDALONE");
    expect(standalone?.difficultyLabels).toEqual([
      { key: "BEGINNER", label: null },
    ]);
  });

  it("throws on shape breaches", () => {
    expect(() =>
      parseRulesFile(routineDoc("INTERMEDIATE, ADVANCED"), axes),
    ).toThrow(/needs a preset label/);
    expect(() =>
      parseRulesFile(
        routineDoc("BEGINNER").replace("ACCURACY (primary)", "ACCURACY"),
        axes,
      ),
    ).toThrow(/exactly one \(primary\)/);
    expect(() =>
      parseRulesFile(
        routineDoc("BEGINNER").replace(
          "| Pressure | NONE |\n| Family",
          "| Pressure | NONE, SETBACK |\n| Family",
        ),
        axes,
      ),
    ).toThrow(/cannot be combined/);
    expect(() =>
      parseRulesFile(
        routineDoc("BEGINNER").replace(
          "| Format | SOLO |",
          "| Format | NOPE |",
        ),
        axes,
      ),
    ).toThrow(/not a Format value/);
  });

  it("parses every playable rules file in the repo without throwing", () => {
    for (const p of [
      "rulesets/501.md",
      "rulesets/singles-training.md",
      "rulesets/score-training.md",
      "training/exercises/hit-count.md",
    ]) {
      expect(() => parseRulesFile(rules(p), axes)).not.toThrow();
    }
  });
});
