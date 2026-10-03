#!/usr/bin/env bash
# Regenerates app/src/db/schema.ts from the database at DATABASE_URL, which must
# sit at the head of database/migrations/ (and be seeded). Run by
# .github/workflows/schema.yml on a chain-built Postgres; CI owns freshness (#404).
#
# Pipeline: drizzle-kit introspect -> prettier -> normalize-schema (stable order).
# Introspect writes to a temp dir so the committed file is replaced only after
# every step has succeeded. The normalizer is needed because drizzle-kit's
# declaration order follows catalog row order, which VACUUM FULL changes.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)/app"

: "${DATABASE_URL:?DATABASE_URL is required}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/drizzle.config.mjs" <<EOF
export default {
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  out: "$tmp/out",
  schema: "./src/db/schema.ts",
  tablesFilter: ["!pg_stat_statements", "!pg_stat_statements_info"],
};
EOF

npx drizzle-kit introspect --config "$tmp/drizzle.config.mjs"
npx tsx scripts/normalize-schema.ts "$tmp/out/schema.ts"
npx prettier --write "$tmp/out/schema.ts"
cp "$tmp/out/schema.ts" src/db/schema.ts
echo "schema refreshed: app/src/db/schema.ts"
