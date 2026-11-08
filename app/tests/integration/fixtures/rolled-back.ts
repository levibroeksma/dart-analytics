import type postgres from "postgres";

/** Thrown inside a transaction to force its rollback; callers swallow it. */
export class Rollback extends Error {}

/**
 * Runs `body` in a transaction on `sql` and always rolls it back.
 *
 * For raw `postgres.js` tagged SQL on a caller-owned client, where a rejected
 * statement surfaces the driver's error (`constraint_name`). Code that needs a
 * drizzle handle, with nested transactions as savepoints, uses `inRolledBackTx`
 * in `itest-db.ts`, which owns its client. They cannot share a body: drizzle
 * over a `TransactionSql` does not support nested `transaction()` here (#1238).
 */
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
