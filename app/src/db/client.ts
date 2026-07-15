import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../lib/env";
import * as schema from "./schema";

export function getDb() {
  // Contract: DATABASE_URL = direct (runtime); pooled is tooling-only.
  // Sole owner: docs/architecture/05-Database/11-Neon-Integration.md
  const url = env.postgres.databaseUrl;
  neonConfig.fetchConnectionCache = true;
  const client = neon(url);
  return drizzle(client, { schema });
}
