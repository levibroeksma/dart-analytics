import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseRulesFile,
  parseVocabulary,
  validateBlock,
  type Axis,
  type ContextKey,
  type TagBlock,
} from "./tags/parse-tags";

/**
 * Catalog tag seed generator.
 *
 * Reads docs/game-rules/TAGS.md plus every playable rules file's `## Tags`
 * tables and writes database/seeds/0042_catalog_tags.sql: the lookups
 * (tag_axes, tags, tag_contexts) and the three typed link tables (game types,
 * exercise types, preset cards). Tables arrive in migrations 0047 and 0049; a seed only runs after migrations, so committing it early
 * is safe. `--check` compares a fresh generation with the committed file
 * (env TAG_SEED_FILE overrides the path) and exits 1 on drift.
 *
 * Exercise and card links skip a type not yet inserted; `db:seed`'s second pass
 * links it (D248). A rules file with a `Card ruleset:` header is a preset card
 * of an existing game type: only its Standalone block is written.
 *
 * Never reads template seeds: per-template difficulty is hand-set in 0043.
 */

const CONTEXTS: { key: ContextKey; id: number; name: string }[] = [
  { key: "STANDALONE", id: 1, name: "Standalone" },
  { key: "ROUTINE_STEP", id: 2, name: "Routine step" },
];

export type SeedInput = {
  axes: Axis[];
  games: Map<string, TagBlock[]>;
  exercises: Map<string, TagBlock[]>;
  /** Preset cards: ruleset_versions.implementation_key -> the card's tag blocks. */
  cards: Map<string, TagBlock[]>;
  /** exercise_types.implementation_key values present in the DB seeds. */
  dbExerciseKeys?: string[];
};

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** A game with no ROUTINE_STEP block gets its Standalone tags minus Family. */
function withRoutineStep(blocks: TagBlock[]): TagBlock[] {
  if (blocks.some((b) => b.context === "ROUTINE_STEP")) return blocks;
  const standalone = blocks.find((b) => b.context === "STANDALONE");
  if (!standalone) return blocks;
  return [
    ...blocks,
    {
      context: "ROUTINE_STEP",
      tags: standalone.tags.filter((t) => t.axis !== "FAMILY"),
      difficultyLabels: standalone.difficultyLabels,
    },
  ];
}

export function buildSeedSql(input: SeedInput): {
  sql: string;
  warnings: string[];
} {
  const { axes } = input;
  const warnings: string[] = [];
  const tagId = new Map<string, number>();
  const axisId = new Map<string, number>();
  const tagRows: string[] = [];
  let nextTag = 1;
  axes.forEach((axis, ai) => {
    axisId.set(axis.key, ai + 1);
    axis.values.forEach((v, vi) => {
      tagId.set(`${axis.key}:${v.key}`, nextTag);
      tagRows.push(
        `  (${nextTag}, ${ai + 1}, ${q(v.key)}, ${q(v.name)}, ${vi + 1}, now(), now())`,
      );
      nextTag++;
    });
  });

  const guardedInsert = (
    table: "exercise_type_tags" | "ruleset_version_tags",
    column: "exercise_type_id" | "ruleset_version_id",
    typeSel: string,
    rows: { id: number; primary: boolean }[],
  ): string =>
    `INSERT INTO ${table} (${column}, tag_id, is_primary, created_at)\n` +
    `SELECT * FROM (VALUES\n` +
    rows
      .map(
        (r) =>
          `  (${typeSel}, ${r.id}, ${r.primary ? "TRUE" : "FALSE"}, now())`,
      )
      .join(",\n") +
    `\n) AS v (${column}, tag_id, is_primary, created_at)\n` +
    `WHERE v.${column} IS NOT NULL;`;

  const linkInserts = (
    table: "game_type_tags" | "exercise_type_tags" | "ruleset_version_tags",
    typeTable: "game_types" | "exercise_types" | "ruleset_versions",
    typeKey: string,
    blocks: TagBlock[],
  ): string[] => {
    const out: string[] = [];
    const ordered = [...blocks].sort(
      (a, b) =>
        CONTEXTS.findIndex((c) => c.key === a.context) -
        CONTEXTS.findIndex((c) => c.key === b.context),
    );
    for (const block of ordered) {
      validateBlock(
        block,
        axes,
        `${typeTable} ${typeKey} (${block.context})`,
        table === "exercise_type_tags" ? "exercise" : "game",
      );
      const multiLabelled =
        block.context === "ROUTINE_STEP" && block.difficultyLabels.length > 1;
      const rows = block.tags
        .filter((t) => !(multiLabelled && t.axis === "DIFFICULTY"))
        .map((t) => ({ ...t, id: tagId.get(`${t.axis}:${t.key}`) as number }))
        .sort((a, b) => a.id - b.id);
      const typeSel = `(SELECT id FROM ${typeTable} WHERE implementation_key = ${q(typeKey)})`;
      if (table === "game_type_tags") {
        const ctx = `(SELECT id FROM tag_contexts WHERE implementation_key = ${q(block.context)})`;
        out.push(
          `INSERT INTO game_type_tags (game_type_id, tag_context_id, tag_id, is_primary, created_at) VALUES\n` +
            rows
              .map(
                (r) =>
                  `  (${typeSel}, ${ctx}, ${r.id}, ${r.primary ? "TRUE" : "FALSE"}, now())`,
              )
              .join(",\n") +
            ";",
        );
      } else if (table === "exercise_type_tags") {
        out.push(guardedInsert(table, "exercise_type_id", typeSel, rows));
      } else {
        out.push(guardedInsert(table, "ruleset_version_id", typeSel, rows));
      }
    }
    return out;
  };

  const noSource = new Set<string>();
  const gameSql: string[] = [];
  for (const key of [...input.games.keys()].sort()) {
    const raw = input.games.get(key) as TagBlock[];
    if (raw.length === 0) {
      noSource.add(key); // rules file without a ## Tags section
      continue;
    }
    const blocks = withRoutineStep(raw);
    gameSql.push(
      `-- game ${key}`,
      ...linkInserts("game_type_tags", "game_types", key, blocks),
    );
  }

  const exerciseSql: string[] = [];
  for (const key of [...input.exercises.keys()].sort()) {
    const blocks = input.exercises.get(key) as TagBlock[];
    if (blocks.length === 0) {
      noSource.add(key);
      continue;
    }
    if (blocks.some((b) => b.context !== "ROUTINE_STEP")) {
      throw new Error(
        `exercise ${key}: tags must be one flat (ROUTINE_STEP) table`,
      );
    }
    exerciseSql.push(
      `-- exercise ${key}`,
      ...linkInserts("exercise_type_tags", "exercise_types", key, blocks),
    );
  }

  const cardSql: string[] = [];
  for (const key of [...input.cards.keys()].sort()) {
    const standalone = (input.cards.get(key) as TagBlock[]).filter(
      (b) => b.context === "STANDALONE",
    );
    if (standalone.length === 0) {
      throw new Error(`card ${key}: tags need a Standalone block`);
    }
    cardSql.push(
      `-- card ${key}`,
      ...linkInserts(
        "ruleset_version_tags",
        "ruleset_versions",
        key,
        standalone,
      ),
    );
  }

  for (const key of [...(input.dbExerciseKeys ?? [])].sort()) {
    if (key === "GAME" || input.exercises.has(key)) continue;
    noSource.add(key);
  }
  warnings.push(...[...noSource].sort().map((k) => `no tag source: ${k}`));

  const lines = [
    "-- GENERATED — do not edit. Run `npm run tags:generate` (app/).",
    "-- Source: docs/game-rules/TAGS.md and the `## Tags` tables of the playable",
    "-- rules files. Drift is gated by `npm run tags:generate -- --check`.",
    "-- Idempotent: lookups upsert by id; link tables are cleared and refilled.",
    "BEGIN;",
    "",
    "INSERT INTO tag_axes (id, implementation_key, name, created_at, updated_at) VALUES",
    axes
      .map((a, i) => `  (${i + 1}, ${q(a.key)}, ${q(a.name)}, now(), now())`)
      .join(",\n"),
    "ON CONFLICT (id) DO UPDATE SET implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, updated_at = now();",
    "",
    "INSERT INTO tag_contexts (id, implementation_key, name, created_at, updated_at) VALUES",
    CONTEXTS.map(
      (c) => `  (${c.id}, ${q(c.key)}, ${q(c.name)}, now(), now())`,
    ).join(",\n"),
    "ON CONFLICT (id) DO UPDATE SET implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, updated_at = now();",
    "",
    "INSERT INTO tags (id, tag_axis_id, implementation_key, name, sort_order, created_at, updated_at) VALUES",
    tagRows.join(",\n"),
    "ON CONFLICT (id) DO UPDATE SET tag_axis_id = EXCLUDED.tag_axis_id, implementation_key = EXCLUDED.implementation_key, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now();",
    "",
    "DELETE FROM game_type_tags;",
    "DELETE FROM exercise_type_tags;",
    "DELETE FROM ruleset_version_tags;",
    "",
    ...gameSql,
    "",
    ...exerciseSql,
    "",
    ...cardSql,
    "",
    "COMMIT;",
    "",
  ];
  return { sql: lines.join("\n"), warnings };
}

// --- CLI (fs lives only below) ---------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const DEFAULT_SEED = "database/seeds/0042_catalog_tags.sql";

function mdFiles(dir: string): string[] {
  return readdirSync(resolve(repoRoot, dir))
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .sort()
    .map((f) => resolve(repoRoot, dir, f));
}

/** exercise_types.implementation_key values inserted by database/seeds/*.sql. */
function dbExerciseKeys(): string[] {
  const dir = resolve(repoRoot, "database/seeds");
  const keys = new Set<string>();
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(resolve(dir, f), "utf8");
    const re =
      /INSERT INTO exercise_types\b[\s\S]*?VALUES([\s\S]*?)ON CONFLICT/g;
    for (const m of sql.matchAll(re)) {
      for (const t of m[1].matchAll(
        /\(\s*'[0-9a-f-]{36}'\s*,\s*'([A-Z0-9_]+)'/g,
      )) {
        keys.add(t[1]);
      }
    }
  }
  return [...keys].sort();
}

export function generate(): { sql: string; warnings: string[] } {
  const axes = parseVocabulary(
    readFileSync(resolve(repoRoot, "docs/game-rules/TAGS.md"), "utf8"),
  );
  const exerciseKeys = dbExerciseKeys();
  const games = new Map<string, TagBlock[]>();
  const exercises = new Map<string, TagBlock[]>();
  const cards = new Map<string, TagBlock[]>();
  for (const file of mdFiles("docs/game-rules/rulesets")) {
    const parsed = parseRulesFile(readFileSync(file, "utf8"), axes);
    if (parsed.cardRulesetKey) {
      if (cards.has(parsed.cardRulesetKey))
        throw new Error(`duplicate Card ruleset ${parsed.cardRulesetKey}`);
      cards.set(parsed.cardRulesetKey, parsed.blocks);
    }
    if (!parsed.gameTypeKey) continue; // unbuilt game: skipped, not an error
    if (games.has(parsed.gameTypeKey))
      throw new Error(`duplicate Game type ${parsed.gameTypeKey}`);
    games.set(parsed.gameTypeKey, parsed.blocks);
  }
  for (const file of mdFiles("docs/game-rules/training/exercises")) {
    const parsed = parseRulesFile(readFileSync(file, "utf8"), axes);
    const key = parsed.exerciseTypeKey;
    if (!key || key === "GAME" || !exerciseKeys.includes(key)) continue; // docs-only
    if (exercises.has(key))
      throw new Error(`duplicate exercise Type constant ${key}`);
    exercises.set(key, parsed.blocks);
  }
  return buildSeedSql({
    axes,
    games,
    exercises,
    cards,
    dbExerciseKeys: exerciseKeys,
  });
}

function main(): void {
  const check = process.argv.includes("--check");
  const { sql, warnings } = generate();
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (check) {
    const target = resolve(repoRoot, process.env.TAG_SEED_FILE ?? DEFAULT_SEED);
    const current = existsSync(target) ? readFileSync(target, "utf8") : null;
    if (current !== sql) {
      console.error("catalog tag seed is stale — run npm run tags:generate");
      process.exit(1);
    }
    console.log("catalog tag seed is up to date");
    return;
  }
  const out = resolve(repoRoot, DEFAULT_SEED);
  writeFileSync(out, sql);
  console.log(`wrote ${DEFAULT_SEED}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
