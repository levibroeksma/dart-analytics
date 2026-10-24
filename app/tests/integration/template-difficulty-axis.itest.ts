import postgres from "postgres";
import { describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(process.env.DATABASE_URL);

class Rollback extends Error {}

/** Runs `body` in a transaction and always rolls it back. */
async function rolledBack(
  body: (tx: postgres.TransactionSql) => Promise<void>,
): Promise<void> {
  await sql
    .begin(async (tx) => {
      await body(tx);
      throw new Rollback();
    })
    .catch((error: unknown) => {
      if (!(error instanceof Rollback)) throw error;
    });
}

async function tagOnAxis(
  tx: postgres.TransactionSql,
  axisKey: string,
  negate = false,
): Promise<number> {
  const [row] = await tx<{ id: number }[]>`
    SELECT t.id FROM tags t JOIN tag_axes ta ON ta.id = t.tag_axis_id
    WHERE (ta.implementation_key = ${axisKey}) = ${!negate}
    ORDER BY t.id LIMIT 1`;
  return row.id;
}

async function aTemplateId(tx: postgres.TransactionSql): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    SELECT id FROM exercise_templates ORDER BY id LIMIT 1`;
  return row.id;
}

describe("exercise_templates.difficulty_tag_id axis", () => {
  it("pins the generated axis column to the seeded DIFFICULTY axis", async () => {
    const [axis] = await sql<{ id: number }[]>`
      SELECT id FROM tag_axes WHERE implementation_key = 'DIFFICULTY'`;
    await rolledBack(async (tx) => {
      const id = await aTemplateId(tx);
      await tx`UPDATE exercise_templates
        SET difficulty_tag_id = ${await tagOnAxis(tx, "DIFFICULTY")} WHERE id = ${id}`;
      const [row] = await tx<{ axis: number }[]>`
        SELECT difficulty_tag_axis_id AS axis FROM exercise_templates WHERE id = ${id}`;
      expect(row.axis).toBe(axis.id);
    });
  });

  it("accepts a DIFFICULTY tag and a NULL difficulty", async () => {
    await rolledBack(async (tx) => {
      const id = await aTemplateId(tx);
      await tx`UPDATE exercise_templates
        SET difficulty_tag_id = ${await tagOnAxis(tx, "DIFFICULTY")} WHERE id = ${id}`;
      await tx`UPDATE exercise_templates SET difficulty_tag_id = NULL WHERE id = ${id}`;
      const [row] = await tx<{ axis: number | null }[]>`
        SELECT difficulty_tag_axis_id AS axis FROM exercise_templates WHERE id = ${id}`;
      expect(row.axis).toBeNull();
    });
  });

  it("rejects a tag of any other axis", async () => {
    await rolledBack(async (tx) => {
      const id = await aTemplateId(tx);
      const other = await tagOnAxis(tx, "DIFFICULTY", true);
      await tx`SAVEPOINT before_bad_tag`;
      await expect(
        tx`UPDATE exercise_templates SET difficulty_tag_id = ${other} WHERE id = ${id}`,
      ).rejects.toMatchObject({
        constraint_name: "fk_exercise_templates_difficulty_tag",
      });
      await tx`ROLLBACK TO SAVEPOINT before_bad_tag`;
    });
  });
});
