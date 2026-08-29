import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

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

/**
 * Files run in filename order, twice.
 *
 * `0007_ruleset_version_capabilities.sql` is a running ledger: every new
 * ruleset version appends its capability rows there, joined against
 * `ruleset_versions` by `implementation_key`. When that ruleset's own row is
 * created by a higher-numbered seed (e.g. `0013`), the first pass runs 0007
 * before that row exists, so the join matches nothing and the insert is a
 * silent no-op — `ON CONFLICT DO NOTHING` gives no error either way. A second
 * pass re-runs 0007 once every other file has committed its rows, so the join
 * now matches. Both passes are safe: every seed is `ON CONFLICT DO NOTHING`.
 */
export function buildExecutionPlan(files: string[]): string[] {
  return [...files, ...files];
}

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const sql = postgres(url, { max: 1 });

  try {
    const files = seedFiles();
    if (files.length === 0)
      throw new Error(`no seed files found in ${seedsDir}`);

    for (const name of buildExecutionPlan(files)) {
      const query = readFileSync(resolve(seedsDir, name), "utf8");
      await sql.unsafe(query);
      console.log(`applied seed: ${name}`);
    }
  } finally {
    await sql.end();
  }
}

if (!process.env.VITEST) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
