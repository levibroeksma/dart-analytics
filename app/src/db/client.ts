import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../lib/env";
import * as schema from "./schema";

export function getDb() {
  const url = env.postgres.databaseUrlUnpooled ?? env.postgres.databaseUrl;
  neonConfig.fetchConnectionCache = true;
  const client = neon(url);
  return drizzle(client, { schema });
}
