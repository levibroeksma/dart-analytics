import postgres from "postgres";
import { describe, expect, it } from "vitest";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(process.env.DATABASE_URL);

const V3_ID = "0198f100-0000-7000-8000-000000000019";

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

async function withoutCardTags(tx: postgres.TransactionSql): Promise<void> {
  await tx`DELETE FROM ruleset_version_tags WHERE ruleset_version_id = ${V3_ID}`;
}

async function tagIds(
  tx: postgres.TransactionSql,
  axisKey: string,
): Promise<number[]> {
  const rows = await tx<{ id: number }[]>`
    SELECT t.id FROM tags t JOIN tag_axes ta ON ta.id = t.tag_axis_id
    WHERE ta.implementation_key = ${axisKey} ORDER BY t.sort_order`;
  return rows.map((row) => row.id);
}

describe("ruleset_version_tags", () => {
  it("surfaces a card's tags in v_catalog_tags as CARD rows", async () => {
    await rolledBack(async (tx) => {
      await withoutCardTags(tx);
      const [difficulty] = await tagIds(tx, "DIFFICULTY");
      await tx`
        INSERT INTO ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)
        VALUES (${V3_ID}, ${difficulty!}, TRUE, now())`;
      const rows = await tx<
        { entity_kind: string; type_key: string; context_key: string }[]
      >`
        SELECT entity_kind, type_key, context_key FROM v_catalog_tags
        WHERE entity_kind = 'CARD' AND type_key = 'AROUND_THE_CLOCK_V3'`;
      expect(rows).toEqual([
        {
          entity_kind: "CARD",
          type_key: "AROUND_THE_CLOCK_V3",
          context_key: "STANDALONE",
        },
      ]);
    });
  });

  it("allows at most one primary tag per ruleset version", async () => {
    await rolledBack(async (tx) => {
      await withoutCardTags(tx);
      const [first, second] = await tagIds(tx, "DIFFICULTY");
      await tx`
        INSERT INTO ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)
        VALUES (${V3_ID}, ${first!}, TRUE, now())`;
      await expect(
        tx.savepoint(
          (inner) => inner`
            INSERT INTO ruleset_version_tags (ruleset_version_id, tag_id, is_primary, created_at)
            VALUES (${V3_ID}, ${second!}, TRUE, now())`,
        ),
      ).rejects.toThrow(/uq_ruleset_version_tags_primary/);
    });
  });
});
