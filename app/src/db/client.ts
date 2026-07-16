import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@lib/env";
import * as schema from "./schema";

export function getDb() {
  // Contract: DATABASE_URL_UNPOOLED = direct (runtime); DATABASE_URL is tooling-only (pooled).
  // Sole owner: docs/architecture/05-Database/11-Neon-Integration.md
  const url = env.postgres.databaseUrlUnpooled;
  neonConfig.fetchConnectionCache = true;
  const client = neon(url);
  return drizzle(client, { schema });
}
