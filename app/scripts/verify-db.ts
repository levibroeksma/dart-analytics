import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const verificationDir = resolve(process.cwd(), "../database/verification");

/**
 * Runs the SQL under `database/verification/` against the live database named
 * by `DATABASE_URL`, so the checks do not require a local `psql` install —
 * `psql` ships with a PostgreSQL server, which this project deliberately does
 * not have locally (Neon `dev` branch instead of Docker Postgres, D24).
 *
 * Each script ends in its own `ROLLBACK`, so nothing it inserts survives. The
 * runner therefore never opens a transaction of its own: wrapping these in one
 * would swallow the script's rollback and leave the fixture behind.
 */
function verificationFiles(filter?: string): string[] {
  if (!existsSync(verificationDir)) return [];

  return readdirSync(verificationDir)
    .filter((name) => name.endsWith(".sql"))
    .filter((name) => !filter || name.includes(filter))
    .sort();
}

function isSummary(row: Record<string, unknown>): boolean {
  return "summary" in row;
}

function formatRow(row: Record<string, unknown>): string {
  const step = row.step ?? "";
  const result = row.result ?? "";
  const name = row.check_name ?? "";
  const detail = row.detail ? ` — ${row.detail}` : "";
  return `  [${String(result).padEnd(4)}] step ${step}: ${name}${detail}`;
}

async function run(): Promise<void> {
  const filter = process.argv[2];
  const files = verificationFiles(filter);

  if (files.length === 0) {
    throw new Error(
      filter
        ? `no verification file in ${verificationDir} matching "${filter}"`
        : `no verification files found in ${verificationDir}`,
    );
  }

  const sql = postgres(url!, { max: 1 });
  let failed = false;

  try {
    for (const name of files) {
      const query = readFileSync(resolve(verificationDir, name), "utf8");
      console.log(`\n${name}`);

      const results = await sql.unsafe(query).simple();
      const rows = (results as unknown[])
        .flatMap((result) => (Array.isArray(result) ? result : [result]))
        .filter(
          (row): row is Record<string, unknown> =>
            typeof row === "object" && row !== null,
        );

      for (const row of rows.filter((row) => !isSummary(row))) {
        console.log(formatRow(row));
        if (row.result === "FAIL") failed = true;
      }

      for (const row of rows.filter(isSummary)) {
        console.log(`  ${row.summary}`);
        if (String(row.summary).includes("FAILED")) failed = true;
      }
    }
  } finally {
    await sql.end();
  }

  if (failed) process.exit(1);
}

run().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
