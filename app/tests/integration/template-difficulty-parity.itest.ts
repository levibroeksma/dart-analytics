import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import {
  parseRulesFile,
  parseVocabulary,
  type TagBlock,
} from "../../scripts/tags/parse-tags";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

/**
 * Seed 0043 hand-sets exercise_templates.difficulty_tag_id; the docs'
 * `### Routine step` Difficulty row is the human-readable statement of the
 * same fact. Per type, the set of difficulties the docs name must equal the
 * set of difficulty_levels across that type's system templates in
 * v_exercise_template_catalog. Set equality only: no label-to-name matching.
 */

const rulesRoot = fileURLToPath(
  new URL("../../../docs/game-rules/", import.meta.url),
);
const axes = parseVocabulary(readFileSync(join(rulesRoot, "TAGS.md"), "utf8"));
const difficultyAxis = axes.find((a) => a.key === "DIFFICULTY");
if (!difficultyAxis) throw new Error("TAGS.md has no Difficulty axis");
/** Level n (1-based, TAGS.md row order = tags.sort_order) -> tag key. */
const keyForLevel = (level: number | null): string =>
  level === null
    ? "NULL"
    : (difficultyAxis.values[level - 1]?.key ?? `?${level}`);

function difficultySet(block: TagBlock | undefined): string[] {
  return [...new Set(block?.difficultyLabels.map((d) => d.key) ?? [])].sort();
}

/** `GAME:<key>` / `EXERCISE:<key>` -> the docs' routine-step Difficulty set. */
function docsDifficulties(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const dir of ["rulesets", "training/exercises"]) {
    for (const file of readdirSync(join(rulesRoot, dir))) {
      if (!file.endsWith(".md") || file === "README.md") continue;
      const parsed = parseRulesFile(
        readFileSync(join(rulesRoot, dir, file), "utf8"),
        axes,
      );
      const routine = parsed.blocks.find((b) => b.context === "ROUTINE_STEP");
      if (parsed.gameTypeKey) {
        // A game with no Routine step block uses its Standalone block (spec,
        // "Missing tag sources"); seed 0042 writes it that way.
        const block =
          routine ?? parsed.blocks.find((b) => b.context === "STANDALONE");
        out.set(`GAME:${parsed.gameTypeKey}`, difficultySet(block));
      } else if (parsed.exerciseTypeKey) {
        out.set(`EXERCISE:${parsed.exerciseTypeKey}`, difficultySet(routine));
      }
    }
  }
  return out;
}

type Row = {
  exercise_type_key: string;
  game_type_key: string | null;
  difficulty_level: number | null;
};

describe("template difficulty parity (docs vs seed 0043)", () => {
  it("each type's seeded difficulty set equals its docs' routine-step set", async () => {
    const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
    let rows: Row[];
    try {
      rows = await sql<Row[]>`
        SELECT exercise_type_key, game_type_key, difficulty_level
        FROM v_exercise_template_catalog`;
    } finally {
      await sql.end();
    }

    const seeded = new Map<string, Set<string>>();
    for (const r of rows) {
      const owner = r.game_type_key
        ? `GAME:${r.game_type_key}`
        : `EXERCISE:${r.exercise_type_key}`;
      const set = seeded.get(owner) ?? new Set<string>();
      set.add(keyForLevel(r.difficulty_level));
      seeded.set(owner, set);
    }

    const docs = docsDifficulties();
    const actual: Record<string, string[]> = {};
    const expected: Record<string, string[]> = {};
    for (const [owner, set] of seeded) {
      actual[owner] = [...set].sort();
      // A type with no rules file (SWITCHING, DOUBLE_PATTERN) has no tags.
      expected[owner] = docs.get(owner) ?? ["NULL"];
    }

    expect(Object.keys(actual).length).toBeGreaterThan(0);
    expect(
      Object.values(expected).some((keys) => keys.length > 1),
      "at least one compared type labels several difficulties",
    ).toBe(true);
    expect(actual).toEqual(expected);
  });
});
