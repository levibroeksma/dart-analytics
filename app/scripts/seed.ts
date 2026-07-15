import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const sql = postgres(url, { max: 1 });

const seedFiles = [
  "../architecture/docs/database/seeds/0001_reference_data.sql",
  "../architecture/docs/database/seeds/0002_default_templates.sql",
];

async function run(): Promise<void> {
  for (const rel of seedFiles) {
    const file = resolve(process.cwd(), rel);
    const query = readFileSync(file, "utf8");
    await sql.unsafe(query);
    console.log(`applied seed: ${rel}`);
  }
  await sql.end();
}

run().catch(async (err) => {
  console.error(err);
  await sql.end();
  process.exit(1);
});
