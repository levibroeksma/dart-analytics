import { neon, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleServerless } from 'drizzle-orm/neon-serverless';
import { env } from '@lib/env';
import * as schema from './schema';

export function getDb() {
  // Contract: DATABASE_URL_UNPOOLED = direct (runtime); DATABASE_URL is tooling-only (pooled).
  // Sole owner: docs/architecture/05-Database/11-Neon-Integration.md
  const url = env.postgres.databaseUrlUnpooled;
  const client = neon(url);
  return drizzle(client, { schema });
}

type ServerlessDb = ReturnType<typeof drizzleServerless<typeof schema>>;
type TransactionDb = Parameters<ServerlessDb['transaction']>[0] extends (
  tx: infer TX,
) => unknown
  ? TX
  : never;

/**
 * Multi-table transactional writes need the WebSocket client, not the HTTP
 * client `getDb()` uses — per 06-API/02-Middleware-And-Layering.md. Opens a
 * pool per call and always closes it, matching the serverless request lifecycle.
 */
export async function withTransaction<T>(
  fn: (tx: TransactionDb) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: env.postgres.databaseUrlUnpooled });
  const db = drizzleServerless(pool, { schema });
  try {
    return await db.transaction(fn);
  } finally {
    await pool.end();
  }
}
