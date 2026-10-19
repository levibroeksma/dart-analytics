import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildSeedSql } from "../../scripts/generate-tag-seed";
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

  it("writes no DIFFICULTY row for a multi-label ROUTINE_STEP block, one for a single", () => {
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
      games: new Map(),
      exercises: new Map([
        ["HIT_COUNT", [multi]],
        ["BULL_UP", [single]],
      ]),
    });
    const hit = sql
      .slice(
        sql.indexOf("-- exercise HIT_COUNT"),
        sql.indexOf("-- exercise HIT_COUNT") + 1500,
      )
      .split(";")[0];
    const difficultyIds = axes[3].values.map((_, i) => beginnerId + i);
    for (const id of difficultyIds) expect(hit).not.toContain(`, ${id},`);
    const bull = sql.slice(sql.indexOf("-- exercise BULL_UP")).split(";")[0];
    expect(bull).toContain(`, ${beginnerId},`);
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
