import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@db/schema";

/** The transaction handle every integration-suite insert and read uses. */
export type Db = PostgresJsDatabase<typeof schema>;

/** UUIDv7-shaped literal; `n` is the low 48 bits. */
export function uuid(n: number): string {
  return `01990000-0000-7000-8000-${n.toString(16).padStart(12, "0")}`;
}

class Rollback extends Error {}

/**
 * Runs `body` in a transaction that always rolls back, so no row survives.
 * `publish` receives the transaction handle on entry and `null` once the
 * transaction has closed, before the client ends. `H` is the handle type the
 * caller's code expects (the repositories type theirs as neon-http).
 */
export async function inRolledBackTx<T, H = Db>(
  body: (db: H) => Promise<T>,
  publish: (db: H | null) => void = () => {},
): Promise<T> {
  const client = postgres(process.env.DATABASE_URL as string, { max: 1 });
  const db = drizzle(client, { schema });
  let result: T | undefined;
  try {
    await db.transaction(async (tx) => {
      const handle = tx as unknown as H;
      publish(handle);
      result = await body(handle);
      throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  } finally {
    publish(null);
    await client.end();
  }
  return result as T;
}
