import { drizzle } from "drizzle-orm/pg-proxy";

export type RenderedStatement = { sql: string; params: unknown[] };

/**
 * A drizzle client that renders statements instead of executing them.
 *
 * Every other test in this directory mocks the query builder itself, so the
 * statement drizzle would emit is never seen — a malformed predicate stays
 * green (issue #397; the `exists` bug it was found through, #400). The pg-proxy
 * driver needs no connection: it hands each rendered statement to a callback,
 * which is what makes the emitted SQL assertable in a unit test.
 *
 * `rows` seeds what the statement "returns", for the functions that read their
 * own `RETURNING` clause or a looked-up row.
 */
export function renderingDb(rows: unknown[] = []) {
  const statements: RenderedStatement[] = [];
  const db = drizzle(async (sql: string, params: unknown[]) => {
    statements.push({ sql, params });
    return { rows };
  });
  return { db: db as never, statements };
}

/** The single statement the call under test rendered. */
export function onlyStatement(statements: RenderedStatement[]): string {
  if (statements.length !== 1)
    throw new Error(`expected 1 statement, rendered ${statements.length}`);
  return statements[0].sql;
}
