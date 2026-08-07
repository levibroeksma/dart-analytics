import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const sql = postgres(url, { max: 1 });

const seedsDir = resolve(process.cwd(), "../database/seeds");

/**
 * Every `.sql` file in `database/seeds`, in numeric filename order.
 *
 * This is read from disk rather than hardcoded: the previous hardcoded list
 * silently stopped at `0004`, so seeds `0005` and `0006` were registered in
 * `database/README.md` but never applied by `npm run db:seed`. A seed nobody
 * runs is indistinguishable from a seed nobody wrote, and the failure surfaces
 * only as a foreign-key violation much later.
 *
 * Seeds are idempotent (`ON CONFLICT DO NOTHING`), so re-running is safe.
 */
function seedFiles(): string[] {
  return readdirSync(seedsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

async function run(): Promise<void> {
  const files = seedFiles();
  if (files.length === 0) throw new Error(`no seed files found in ${seedsDir}`);

  for (const name of files) {
    const query = readFileSync(resolve(seedsDir, name), "utf8");
    await sql.unsafe(query);
    console.log(`applied seed: ${name}`);
  }
  await sql.end();
}

run().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
