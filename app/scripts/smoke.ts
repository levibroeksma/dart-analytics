import postgres from "postgres";

const dbUrl = process.env.DATABASE_URL_POOLED;
const jwksUrl = process.env.NEON_AUTH_JWKS_URL;

if (!dbUrl) throw new Error("DATABASE_URL_POOLED is required");
if (!jwksUrl) throw new Error("NEON_AUTH_JWKS_URL is required");

async function run(): Promise<void> {
  const sql = postgres(dbUrl, { max: 1 });
  const [{ ok }] = await sql`SELECT 1 AS ok`;
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM game_types`;
  await sql.end();

  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);

  console.log(JSON.stringify({ db: { ok, gameTypes: count }, jwks: res.status }, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
