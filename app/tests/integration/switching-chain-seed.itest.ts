import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

/**
 * Seed `0044_switching_chain.sql` gives the existing `SWITCHING` exercise type
 * a second ruleset version (`SWITCHING_CHAIN_V1`) and a second system template
 * ("Chain"), then pins a difficulty on both templates.
 *
 * What these assertions guard, beyond "the rows exist":
 *
 * - The Standard template (`0199b000-…-002`) must stay byte-identical in
 *   everything except `difficulty_tag_id`. Routine statistics fingerprint a
 *   step by its stored configuration and its ruleset version key
 *   (`v_stats_routine_step_facts`, migration `0045`), so touching its name,
 *   configuration or pinned ruleset would restart every player's Balanced
 *   Training trend.
 * - `npm run db:seed` runs the whole seed list twice per invocation (D248), so
 *   the seed must insert nothing on a second run.
 */

const seedsDir = fileURLToPath(
  new URL("../../../database/seeds/", import.meta.url),
);

type CatalogRow = { templateName: string; difficultyLevel: number | null };
type TemplateRow = {
  defaultConfiguration: Record<string, unknown> | null;
  rulesetVersionKey: string | null;
};

/** Opens a connection, runs `body`, and always closes it. */
async function withSql<T>(body: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
  try {
    return await body(sql);
  } finally {
    await sql.end();
  }
}

/** The system templates `v_exercise_template_catalog` offers for one type. */
async function catalogRowsForType(
  exerciseTypeKey: string,
): Promise<CatalogRow[]> {
  return withSql(async (sql) => {
    const rows = await sql<{ name: string; difficulty_level: number | null }[]>`
      SELECT name, difficulty_level
      FROM v_exercise_template_catalog
      WHERE exercise_type_key = ${exerciseTypeKey}`;
    return rows.map((r) => ({
      templateName: r.name,
      difficultyLevel:
        r.difficulty_level === null ? null : Number(r.difficulty_level),
    }));
  });
}

/** The 1-4 difficulty level the catalog reports for one named template. */
function levelOf(rows: CatalogRow[], templateName: string): number | null {
  const row = rows.find((r) => r.templateName === templateName);
  if (!row) throw new Error(`no catalog row named ${templateName}`);
  return row.difficultyLevel;
}

/** One template's stored configuration and the ruleset version key it pins. */
async function templateById(id: string): Promise<TemplateRow> {
  return withSql(async (sql) => {
    const rows = await sql<
      {
        default_configuration: Record<string, unknown> | null;
        implementation_key: string | null;
      }[]
    >`
      SELECT t.default_configuration, erv.implementation_key
      FROM exercise_templates t
        LEFT JOIN exercise_ruleset_versions erv
          ON erv.id = t.exercise_ruleset_version_id
      WHERE t.id = ${id}`;
    if (rows.length !== 1) throw new Error(`no template ${id}`);
    return {
      defaultConfiguration: rows[0].default_configuration,
      rulesetVersionKey: rows[0].implementation_key,
    };
  });
}

/** How many ruleset versions one exercise type owns. */
async function countRulesetVersions(exerciseTypeKey: string): Promise<number> {
  return withSql(async (sql) => {
    const rows = await sql<{ count: string }[]>`
      SELECT count(*) AS count
      FROM exercise_ruleset_versions erv
        JOIN exercise_types et ON et.id = erv.exercise_type_id
      WHERE et.implementation_key = ${exerciseTypeKey}`;
    return Number(rows[0].count);
  });
}

/** Applies one seed file, exactly as `app/scripts/seed.ts` does. */
async function runSeed(fileName: string): Promise<void> {
  const query = readFileSync(join(seedsDir, fileName), "utf8");
  await withSql((sql) => sql.unsafe(query));
}

describe("seed 0044: switching chain", () => {
  it("gives the Switching type two system templates", async () => {
    const rows = await catalogRowsForType("SWITCHING");
    expect(rows.map((r) => r.templateName).sort()).toEqual([
      "Chain",
      "Switching",
    ]);
  });

  it("pins Beginner on Standard and Intermediate on Chain", async () => {
    const rows = await catalogRowsForType("SWITCHING");
    expect(levelOf(rows, "Switching")).toBe(1);
    expect(levelOf(rows, "Chain")).toBe(2);
  });

  it("leaves the Standard template's configuration byte-identical", async () => {
    const row = await templateById("0199b000-0000-7000-8000-000000000002");
    expect(row.defaultConfiguration).toEqual({
      targets: [20, 19, 18],
      scoring: { single: 1, double: 2, treble: 3 },
    });
    expect(row.rulesetVersionKey).toBe("SWITCHING_V1");
  });

  it("inserts nothing on a second seed run", async () => {
    const before = await countRulesetVersions("SWITCHING");
    await runSeed("0044_switching_chain.sql");
    expect(await countRulesetVersions("SWITCHING")).toBe(before);
  });
});
