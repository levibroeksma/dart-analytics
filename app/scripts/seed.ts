import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const sql = postgres(url, { max: 1 });

const seedFiles = [
  "../database/seeds/0001_reference_data.sql",
  "../database/seeds/0002_default_templates.sql",
  "../database/seeds/0003_game_engine_reference.sql",
  "../database/seeds/0004_score_training_minutes_preset.sql",
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
