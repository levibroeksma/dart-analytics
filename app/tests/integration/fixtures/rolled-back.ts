import type postgres from "postgres";

class Rollback extends Error {}

/** Runs `body` in a transaction on `sql` and always rolls it back. */
export async function rolledBack(
  sql: postgres.Sql,
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
