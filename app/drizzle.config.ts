import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL_POOLED ?? "" },
  out: "./src/db",
  schema: "./src/db/schema.ts",
  tablesFilter: ["!pg_stat_statements", "!pg_stat_statements_info"],
});
