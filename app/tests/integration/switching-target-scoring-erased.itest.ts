import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

/**
 * Migration 0048 erased the SWITCHING_TARGET_SCORING exercise type and every
 * row descending from it. These assertions read the live database named by
 * `DATABASE_URL` and check the three facts the erasure must leave behind: the
 * type is gone, no routine step points at a template the erasure took with it,
 * and every routine the deletion shortened is renumbered back to a gapless
 * 1..n sequence.
 *
 * Queried through `postgres` rather than a Drizzle client, as the other
 * integration suites do: this file also runs against the CI-local `postgres:16`
 * built from the migration chain (D433), where the Neon HTTP driver has no
 * endpoint to talk to.
 */

const db = postgres(process.env.DATABASE_URL, { max: 1 });

afterAll(async () => {
  await db.end();
});

describe("switching target scoring erasure", () => {
  it("has no switching target scoring exercise type", async () => {
    const rows = await db`
      SELECT 1 FROM exercise_types
      WHERE implementation_key = 'SWITCHING_TARGET_SCORING'`;
    expect(rows).toHaveLength(0);
  });

  it("leaves no routine step pointing at a missing template", async () => {
    const rows = await db`
      SELECT 1 FROM routine_steps rs
        LEFT JOIN exercise_templates et ON et.id = rs.exercise_template_id
      WHERE et.id IS NULL`;
    expect(rows).toHaveLength(0);
  });

  it("numbers every routine's steps consecutively from 1", async () => {
    const rows = await db`
      SELECT routine_template_id FROM routine_steps
      GROUP BY routine_template_id
      HAVING max(sequence_number) <> count(*) OR min(sequence_number) <> 1`;
    expect(rows).toHaveLength(0);
  });
});
