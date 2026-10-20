import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

/**
 * Seed `0044_switching_chain.sql` gives the existing `SWITCHING` exercise type
 * a second ruleset version (`SWITCHING_CHAIN_V1`) and a second system template
 * ("Chain"), then pins a difficulty on both templates. Seed
 * `0046_switching_standard_name.sql` renames the first template
 * (`0199b000-…-002`) to "Standard" so the one Switching card reads Standard /
 * Chain rather than Chain / Switching.
 *
 * What these assertions guard, beyond "the rows exist":
 *
 * - The Standard template's `default_configuration` and ruleset pin must stay
 *   byte-identical. Routine statistics fingerprint a step by its stored
 *   configuration and its ruleset version key (`v_stats_routine_step_facts`,
 *   migration `0045`), so touching either would restart every player's
 *   Balanced Training trend. `name` and `description` are not in that
 *   fingerprint, which is why `0046` may change them.
 * - `npm run db:seed` runs the whole seed list twice per invocation (D248), so
 *   the seed must insert nothing on a second run, and `0046`'s guarded
 *   `UPDATE` must leave `updated_at` alone.
 */

const seedsDir = fileURLToPath(
  new URL("../../../database/seeds/", import.meta.url),
);

const STANDARD_TEMPLATE_ID = "0199b000-0000-7000-8000-000000000002";
const STANDARD_DESCRIPTION =
  "One dart at each target in turn, every dart scored by the ring it hits: single 1, double 2, treble 3.";

type CatalogRow = { templateName: string; difficultyLevel: number | null };
type TemplateRow = {
  name: string;
  description: string | null;
  defaultConfiguration: Record<string, unknown> | null;
  rulesetVersionKey: string | null;
  updatedAt: string;
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

/** One template's own columns and the ruleset version key it pins. */
async function templateById(id: string): Promise<TemplateRow> {
  return withSql(async (sql) => {
    const rows = await sql<
      {
        name: string;
        description: string | null;
        default_configuration: Record<string, unknown> | null;
        implementation_key: string | null;
        updated_at: Date;
      }[]
    >`
      SELECT t.name, t.description, t.default_configuration, t.updated_at,
        erv.implementation_key
      FROM exercise_templates t
        LEFT JOIN exercise_ruleset_versions erv
          ON erv.id = t.exercise_ruleset_version_id
      WHERE t.id = ${id}`;
    if (rows.length !== 1) throw new Error(`no template ${id}`);
    return {
      name: rows[0].name,
      description: rows[0].description,
      defaultConfiguration: rows[0].default_configuration,
      rulesetVersionKey: rows[0].implementation_key,
      updatedAt: rows[0].updated_at.toISOString(),
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
      "Standard",
    ]);
  });

  it("pins Beginner on Standard and Intermediate on Chain", async () => {
    const rows = await catalogRowsForType("SWITCHING");
    expect(levelOf(rows, "Standard")).toBe(1);
    expect(levelOf(rows, "Chain")).toBe(2);
  });

  it("leaves the Standard template's configuration byte-identical", async () => {
    const row = await templateById(STANDARD_TEMPLATE_ID);
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

describe("seed 0046: switching standard name", () => {
  it("names the first template Standard and describes that config", async () => {
    const row = await templateById(STANDARD_TEMPLATE_ID);
    expect(row.name).toBe("Standard");
    expect(row.description).toBe(STANDARD_DESCRIPTION);
  });

  it("leaves updated_at alone on a second seed run", async () => {
    const before = await templateById(STANDARD_TEMPLATE_ID);
    await runSeed("0046_switching_standard_name.sql");
    const after = await templateById(STANDARD_TEMPLATE_ID);
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.name).toBe("Standard");
    expect(after.description).toBe(STANDARD_DESCRIPTION);
  });
});
