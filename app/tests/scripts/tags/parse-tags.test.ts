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
    "Entry points: standalone, routine step",
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

/** An exercise rules file: one flat table, no subsections unless `sub`. */
function exerciseDoc(difficulty: string, sub = false): string {
  return [
    "## Tags",
    sub ? "### Standalone" : "",
    "| Axis | Tags |",
    "| --- | --- |",
    "| Skill | DOUBLES (primary) |",
    "| Session role | CORE |",
    "| Format | SOLO |",
    `| Difficulty | ${difficulty} |`,
    "| Mechanic | LADDER |",
    "| Pressure | SETBACK |",
    "## Exercise type",
    "- Type constant: `X_TYPE`",
  ].join("\n");
}

/** A standalone-only game: its flat table is a STANDALONE block. */
function gameDoc(difficulty: string): string {
  return [
    "Game type: `X`",
    "Entry points: standalone",
    "## Tags",
    "| Axis | Tags |",
    "| --- | --- |",
    "| Skill | ACCURACY (primary) |",
    "| Session role | CORE |",
    "| Format | SOLO |",
    `| Difficulty | ${difficulty} |`,
    "| Mechanic | SEQUENTIAL |",
    "| Pressure | NONE |",
    "| Family | STANDARD |",
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

  function vocab(axisRow: string, body: string[] | null): string {
    return [
      "## Axes",
      "| Axis | Rule | Exclusive | Scope |",
      "| --- | --- | --- | --- |",
      axisRow,
      ...(body === null ? [] : ["## Skill", ...body]),
    ].join("\n");
  }
  const skillBody = [
    "| Key | Name |",
    "| --- | --- |",
    "| SCORING | Scoring |",
  ];

  it("parses a minimal vocabulary", () => {
    const [skill] = parseVocabulary(
      vocab("| Skill | primary | — | all |", skillBody),
    );
    expect(skill).toMatchObject({ key: "SKILL", exclusive: null });
  });

  it.each([
    [
      "an unknown scope",
      vocab("| Skill | primary | — | some |", skillBody),
      'TAGS.md: axis "Skill" has unknown scope "some"',
    ],
    [
      "an unknown rule",
      vocab("| Skill | several | — | all |", skillBody),
      'TAGS.md: axis "Skill" has unknown rule "several"',
    ],
    [
      "a missing axis section",
      vocab("| Skill | primary | — | all |", null),
      "TAGS.md: no ## Skill section",
    ],
    [
      "an axis with no values",
      vocab("| Skill | primary | — | all |", [
        "| Key | Name |",
        "| --- | --- |",
      ]),
      "TAGS.md: Skill has no values",
    ],
    ["no Axes section", "## Skill", "TAGS.md: no ## Axes section"],
    [
      "an empty Axes table",
      "## Axes\n| Axis | Rule | Exclusive | Scope |\n| --- | --- | --- | --- |",
      "TAGS.md: no axes parsed",
    ],
  ])("throws on %s", (_name, md, message) => {
    expect(() => parseVocabulary(md)).toThrow(message);
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

  it("rejects what check-game-rules.sh rejects", () => {
    expect(() =>
      parseRulesFile(exerciseDoc("INTERMEDIATE (1 dart)"), axes),
    ).toThrow(/unexpected label/);
    expect(() =>
      parseRulesFile(exerciseDoc("INTERMEDIATE (1 dart), ADVANCED"), axes),
    ).toThrow(/unexpected label/);
    expect(() =>
      parseRulesFile(exerciseDoc("INTERMEDIATE, ADVANCED"), axes),
    ).toThrow(/takes exactly one value/);
    expect(() => parseRulesFile(exerciseDoc("BEGINNER", true), axes)).toThrow(
      /no subsections/,
    );
    expect(() => parseRulesFile(exerciseDoc("BEGINNER"), axes)).not.toThrow();
  });

  it("accepts labelled difficulties in an exercise's flat table", () => {
    const r = parseRulesFile(
      exerciseDoc("BEGINNER (Standard), INTERMEDIATE (Chain)"),
      axes,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].difficultyLabels).toEqual([
      { key: "BEGINNER", label: "Standard" },
      { key: "INTERMEDIATE", label: "Chain" },
    ]);
  });

  it("still rejects an unlabelled second difficulty in an exercise", () => {
    expect(() =>
      parseRulesFile(exerciseDoc("BEGINNER, INTERMEDIATE"), axes),
    ).toThrow(/Difficulty takes exactly one value/);
  });

  it("still rejects subsections in an exercise", () => {
    expect(() => parseRulesFile(exerciseDoc("BEGINNER", true), axes)).toThrow(
      /an exercise has one flat table, no subsections/,
    );
  });

  it("still rejects labelled difficulties in a game's flat table", () => {
    expect(() =>
      parseRulesFile(
        gameDoc("BEGINNER (Standard), INTERMEDIATE (Chain)"),
        axes,
      ),
    ).toThrow(/unexpected label/);
    expect(() => parseRulesFile(gameDoc("BEGINNER"), axes)).not.toThrow();
  });

  it("drives axis scope from the Scope column", () => {
    expect(axes.find((a) => a.key === "FAMILY")?.scope).toBe("game-standalone");
    expect(axes.find((a) => a.key === "SKILL")?.scope).toBe("all");
  });

  it("parses a sample of playable rules files without throwing", () => {
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
