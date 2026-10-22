import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSeedSql, generate } from "../../scripts/generate-tag-seed";
import {
  parseVocabulary,
  type TagBlock,
  type TagRef,
} from "../../scripts/tags/parse-tags";

const axes = parseVocabulary(
  readFileSync(
    fileURLToPath(new URL("../../../docs/game-rules/TAGS.md", import.meta.url)),
    "utf8",
  ),
);

function tags(difficulty: string[], extra: TagRef[] = []): TagRef[] {
  return [
    { axis: "SKILL", key: "SCORING", primary: true },
    { axis: "SESSION_ROLE", key: "CORE", primary: false },
    { axis: "FORMAT", key: "SOLO", primary: false },
    ...difficulty.map((key) => ({ axis: "DIFFICULTY", key, primary: false })),
    { axis: "MECHANIC", key: "SEQUENTIAL", primary: false },
    { axis: "PRESSURE", key: "NONE", primary: false },
    ...extra,
  ];
}
const family: TagRef = { axis: "FAMILY", key: "STANDARD", primary: false };

const standalone: TagBlock = {
  context: "STANDALONE",
  tags: tags(["BEGINNER"], [family]),
  difficultyLabels: [{ key: "BEGINNER", label: null }],
};

function build(overrides: Partial<Parameters<typeof buildSeedSql>[0]> = {}) {
  return buildSeedSql({
    axes,
    games: new Map([["CRICKET", [standalone]]]),
    exercises: new Map(),
    cards: new Map(),
    ...overrides,
  });
}

describe("buildSeedSql", () => {
  it("clears links before inserting and upserts lookups by id", () => {
    const { sql } = build();
    expect(sql).toContain("GENERATED");
    const del = sql.indexOf("DELETE FROM game_type_tags;");
    expect(del).toBeGreaterThan(-1);
    expect(sql.indexOf("DELETE FROM exercise_type_tags;")).toBeGreaterThan(-1);
    expect(del).toBeLessThan(sql.indexOf("INSERT INTO game_type_tags"));
    expect(sql).toMatch(
      /INSERT INTO tag_axes[\s\S]*ON CONFLICT \(id\) DO UPDATE/,
    );
    expect(sql).toMatch(/INSERT INTO tags[\s\S]*ON CONFLICT \(id\) DO UPDATE/);
    expect(sql).toMatch(
      /INSERT INTO tag_contexts[\s\S]*ON CONFLICT \(id\) DO UPDATE/,
    );
  });

  it("emits card tags into ruleset_version_tags guarded by the ruleset existing", () => {
    const { sql } = build({
      cards: new Map([["AROUND_THE_CLOCK_V3", [standalone]]]),
    });
    expect(sql).toContain("INSERT INTO ruleset_version_tags");
    expect(sql).toContain(
      "(SELECT id FROM ruleset_versions WHERE implementation_key = 'AROUND_THE_CLOCK_V3')",
    );
    expect(sql).toContain("WHERE v.ruleset_version_id IS NOT NULL;");
  });

  it("clears the card table before refilling it", () => {
    const { sql } = build({
      cards: new Map([["AROUND_THE_CLOCK_V3", [standalone]]]),
    });
    expect(sql.indexOf("DELETE FROM ruleset_version_tags;")).toBeLessThan(
      sql.indexOf("INSERT INTO ruleset_version_tags"),
    );
  });

  it("uses a card's STANDALONE block only", () => {
    const routine: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["ADVANCED"]),
      difficultyLabels: [{ key: "ADVANCED", label: null }],
    };
    const { sql } = build({
      cards: new Map([["AROUND_THE_CLOCK_V3", [routine, standalone]]]),
    });
    const card = sql.slice(sql.indexOf("INSERT INTO ruleset_version_tags"));
    expect(card).not.toContain("INSERT INTO game_type_tags");
    expect((card.match(/AROUND_THE_CLOCK_V3/g) ?? []).length).toBe(
      standalone.tags.length,
    );
  });

  it("throws for a card with no STANDALONE block", () => {
    const routine: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["BEGINNER"]),
      difficultyLabels: [{ key: "BEGINNER", label: null }],
    };
    expect(() =>
      build({ cards: new Map([["AROUND_THE_CLOCK_V3", [routine]]]) }),
    ).toThrow(/card AROUND_THE_CLOCK_V3/);
  });

  it("writes timestamps explicitly: now() on insert, updated_at on upsert", () => {
    const { sql } = build();
    for (const table of ["tag_axes", "tag_contexts", "tags"]) {
      const stmt = sql
        .slice(sql.indexOf(`INSERT INTO ${table} (`))
        .split(";")[0];
      expect(stmt).toMatch(/, created_at, updated_at\) VALUES/);
      const rows = stmt.split("\n").filter((l) => l.startsWith("  ("));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) expect(row).toMatch(/, now\(\), now\(\)\),?$/);
      expect(stmt).toMatch(
        /ON CONFLICT \(id\) DO UPDATE SET .*updated_at = now\(\)$/,
      );
    }
    const link = sql
      .slice(sql.indexOf("INSERT INTO game_type_tags"))
      .split(";")[0];
    expect(link).toContain("is_primary, created_at) VALUES");
    for (const row of link.split("\n").filter((l) => l.startsWith("  (")))
      expect(row).toMatch(/, (TRUE|FALSE), now\(\)\),?$/);
  });

  it("writes created_at on exercise link rows", () => {
    const single: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["BEGINNER"]),
      difficultyLabels: [{ key: "BEGINNER", label: null }],
    };
    const { sql } = build({ exercises: new Map([["BULL_UP", [single]]]) });
    const link = sql
      .slice(sql.indexOf("INSERT INTO exercise_type_tags"))
      .split(";")[0];
    expect(link).toContain(
      "(exercise_type_id, tag_id, is_primary, created_at)\nSELECT * FROM (VALUES",
    );
    for (const row of link.split("\n").filter((l) => l.startsWith("  (")))
      expect(row).toMatch(/, (TRUE|FALSE), now\(\)\),?$/);
  });

  it("skips a type the seeds have not inserted yet instead of inserting a null id", () => {
    const single: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["BEGINNER"]),
      difficultyLabels: [{ key: "BEGINNER", label: null }],
    };
    const { sql } = build({ exercises: new Map([["BULL_UP", [single]]]) });
    const link = sql
      .slice(sql.indexOf("INSERT INTO exercise_type_tags"))
      .split(";")[0];
    expect(link).toContain("SELECT * FROM (VALUES");
    expect(link).toContain(
      ") AS v (exercise_type_id, tag_id, is_primary, created_at)",
    );
    expect(link).toContain("WHERE v.exercise_type_id IS NOT NULL");
  });

  it("resolves type and context by implementation key", () => {
    const { sql } = build();
    expect(sql).toContain(
      "(SELECT id FROM game_types WHERE implementation_key = 'CRICKET')",
    );
    expect(sql).toContain(
      "(SELECT id FROM tag_contexts WHERE implementation_key = 'ROUTINE_STEP')",
    );
  });

  it("copies Standalone minus Family into ROUTINE_STEP when the game has none", () => {
    const { sql } = build();
    const familyId =
      axes
        .slice(
          0,
          axes.findIndex((a) => a.key === "FAMILY"),
        )
        .reduce((n, a) => n + a.values.length, 0) + 1;
    const routine = sql
      .split("\n")
      .filter((l) => l.includes("'ROUTINE_STEP')") && l.includes("'CRICKET')"));
    expect(routine.length).toBeGreaterThan(0);
    expect(routine.some((l) => l.includes(`, ${familyId},`))).toBe(false);
    const standaloneRows = sql
      .split("\n")
      .filter((l) => l.includes("'STANDALONE')") && l.includes("'CRICKET')"));
    expect(standaloneRows.some((l) => l.includes(`, ${familyId},`))).toBe(true);
  });

  it("writes no DIFFICULTY row for a multi-label game ROUTINE_STEP block, one for a single", () => {
    const beginnerId =
      axes[0].values.length + axes[1].values.length + axes[2].values.length + 1;
    const multi: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["INTERMEDIATE", "ADVANCED"]),
      difficultyLabels: [
        { key: "INTERMEDIATE", label: "1 dart" },
        { key: "ADVANCED", label: "2 darts" },
      ],
    };
    const single: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["BEGINNER"]),
      difficultyLabels: [{ key: "BEGINNER", label: null }],
    };
    const { sql } = build({
      games: new Map([["SINGLES_TRAINING", [standalone, multi]]]),
      exercises: new Map([["BULL_UP", [single]]]),
    });
    const hit = sql
      .slice(sql.indexOf("-- game SINGLES_TRAINING"))
      .split("INSERT INTO game_type_tags")[2]
      .split(";")[0];
    const difficultyIds = axes[3].values.map((_, i) => beginnerId + i);
    for (const id of difficultyIds) expect(hit).not.toContain(`, ${id},`);
    const bull = sql.slice(sql.indexOf("-- exercise BULL_UP")).split(";")[0];
    expect(bull).toContain(`, ${beginnerId},`);
  });

  it("writes no DIFFICULTY row for a multi-label exercise flat block", () => {
    const beginnerId =
      axes[0].values.length + axes[1].values.length + axes[2].values.length + 1;
    const multi: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["BEGINNER", "INTERMEDIATE"]),
      difficultyLabels: [
        { key: "BEGINNER", label: "Standard" },
        { key: "INTERMEDIATE", label: "Chain" },
      ],
    };
    const { sql } = build({
      games: new Map(),
      exercises: new Map([["HIT_COUNT", [multi]]]),
    });
    const hit = sql.slice(sql.indexOf("-- exercise HIT_COUNT")).split(";")[0];
    expect(hit).toContain("INSERT INTO exercise_type_tags");
    const difficultyIds = axes[3].values.map((_, i) => beginnerId + i);
    for (const id of difficultyIds) expect(hit).not.toContain(`, ${id},`);
  });

  it("throws on an unlabelled multi-value Difficulty in an exercise", () => {
    const multi: TagBlock = {
      context: "ROUTINE_STEP",
      tags: tags(["INTERMEDIATE", "ADVANCED"]),
      difficultyLabels: [
        { key: "INTERMEDIATE", label: null },
        { key: "ADVANCED", label: null },
      ],
    };
    expect(() =>
      build({ games: new Map(), exercises: new Map([["HIT_COUNT", [multi]]]) }),
    ).toThrow(/takes exactly one value/);
  });

  it("warns and writes no rows for a rules file with no Tags section", () => {
    const { sql, warnings } = build({
      games: new Map([["CRICKET", []]]),
      exercises: new Map([["HIT_COUNT", []]]),
    });
    expect(warnings).toEqual([
      "no tag source: CRICKET",
      "no tag source: HIT_COUNT",
    ]);
    expect(sql).not.toContain("INSERT INTO game_type_tags");
    expect(sql).not.toContain("INSERT INTO exercise_type_tags");
  });

  it("has no cardinality column on tag_axes", () => {
    expect(build().sql).not.toContain("cardinality");
  });

  it("throws on two primary SKILL rows in one block", () => {
    const bad: TagBlock = {
      ...standalone,
      tags: [
        { axis: "SKILL", key: "SCORING", primary: true },
        { axis: "SKILL", key: "BULL", primary: true },
        ...standalone.tags.slice(1),
      ],
    };
    expect(() => build({ games: new Map([["CRICKET", [bad]]]) })).toThrow(
      /exactly one \(primary\)/,
    );
  });

  it("warns, not throws, for an exercise type with no rules file", () => {
    const { warnings } = build({
      dbExerciseKeys: ["GAME", "SWITCHING", "HIT_COUNT"],
      exercises: new Map([
        [
          "HIT_COUNT",
          [
            {
              ...standalone,
              context: "ROUTINE_STEP",
              tags: tags(["BEGINNER"]),
            },
          ],
        ],
      ]),
    });
    expect(warnings).toEqual(["no tag source: SWITCHING"]);
  });

  it("never touches exercise_templates and is deterministic", () => {
    const a = build();
    const b = build();
    expect(a.sql).not.toContain("exercise_templates");
    expect(a.sql).toBe(b.sql);
  });
});

describe("generate() over the real rules files", () => {
  it("parses every in-scope rules file, matches the committed seed, and warns for no type", () => {
    const { sql, warnings } = generate();
    // SWITCHING dropped off this list when
    // docs/game-rules/training/exercises/switching.md landed, and
    // DOUBLE_PATTERN when double-pattern.md did: every seeded exercise type
    // now has a rules file with a `## Tags` table. GAME has one too, but the
    // generator skips that key by design, so it is never a warning either.
    expect(warnings).toEqual([]);
    expect(sql).toBe(
      readFileSync(
        fileURLToPath(
          new URL(
            "../../../database/seeds/0042_catalog_tags.sql",
            import.meta.url,
          ),
        ),
        "utf8",
      ),
    );
  });
});

describe("generate-tag-seed CLI --check", () => {
  const script = fileURLToPath(
    new URL("../../scripts/generate-tag-seed.ts", import.meta.url),
  );
  const run = (seed: string) =>
    spawnSync(process.execPath, ["--import", "tsx", script, "--check"], {
      env: { ...process.env, TAG_SEED_FILE: seed },
      encoding: "utf8",
    });

  it("exits 1 with the stale message when the seed differs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tag-seed-"));
    const seed = join(dir, "seed.sql");
    writeFileSync(seed, "-- stale\n");
    const r = run(seed);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(
      "catalog tag seed is stale — run npm run tags:generate",
    );
  });
});
