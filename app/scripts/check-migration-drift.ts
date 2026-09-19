import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

/**
 * Migration-drift gate (#503, D333).
 *
 * `dbmate status` is not an authority on whether a database matches
 * `database/migrations/`. It enumerates the migration *files* and reports
 * each one's applied flag, so a `schema_migrations` row with no matching file
 * is invisible to it: on 2026-09-19 Neon `dev` carried migration 0038 from
 * the never-pushed branch `fix/x01-checkout-percentage`, which drops
 * `v_double_out_checkout_darts` and creates `v_x01_checkout_darts` — and
 * `npm run db:status` still reported `Applied: 37 / Pending: 0`.
 *
 * That matters because `validate:app` regenerates `app/src/db/schema.ts` from
 * the live database one step later. Introspecting a drifted database silently
 * rewrites the committed schema to the wrong shape, and the unit suite mocks
 * the query builder, so a read against a view that no longer exists stays
 * green. This gate runs between the two, so the chain stops before introspect
 * rather than after the damage is committed.
 *
 * WHAT THIS CANNOT CATCH: view *bodies*. A view whose name matches but whose
 * SELECT was edited in place passes here; body agreement between `schema.ts`
 * and the migrations is `app/tests/db/schema-view-drift.test.ts`, and nothing
 * compares live bodies to the chain. Tables, columns, indexes and constraints
 * are equally out of scope — drift in those still surfaces only as an
 * introspect diff nobody is required to read.
 */

const migrationsDir = resolve(process.cwd(), "../database/migrations");

export type Migration = { version: string; file: string; up: string };

/**
 * The applied-forward SQL only. `migrate:down` is rollback SQL describing a
 * schema that is deliberately not the current one — reading it would make
 * every superseded view look live again.
 */
export function upRegion(sql: string): string {
  const marker = "-- migrate:up";
  const start = sql.indexOf(marker);
  if (start === -1) return sql;
  const body = sql.slice(start + marker.length);
  const end = body.indexOf("-- migrate:down");
  return end === -1 ? body : body.slice(0, end);
}

/**
 * Replays the chain's CREATE VIEW / DROP VIEW statements in migration order
 * and returns the names still standing at the head. Order matters: 0023 drops
 * views it replaces with owner-scoped ones, and 0036 drops and recreates two
 * views 0024 and 0033 created.
 */
export function expectedViews(migrations: Migration[]): Set<string> {
  const live = new Set<string>();
  const create = /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(v_[a-z0-9_]+)/gi;
  const drop = /DROP\s+VIEW\s+(?:IF\s+EXISTS\s+)?((?:v_[a-z0-9_]+\s*,?\s*)+)/gi;

  for (const migration of migrations) {
    for (const statement of migration.up.split(";")) {
      for (const match of statement.matchAll(drop)) {
        for (const name of match[1].split(",")) live.delete(name.trim());
      }
      for (const match of statement.matchAll(create)) live.add(match[1]);
    }
  }

  return live;
}

export function readMigrations(dir: string = migrationsDir): Migration[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((file) => ({
      version: file.split("_")[0],
      file,
      up: upRegion(readFileSync(resolve(dir, file), "utf8")),
    }));
}

export type Finding = { label: string; names: string[]; hint: string };

/**
 * Both directions of both comparisons. The applied-versions check is the #503
 * case; the view check is the only one that can see DDL run by hand, which
 * leaves no `schema_migrations` row at all.
 */
export function findDrift(input: {
  applied: Set<string>;
  onDisk: Set<string>;
  liveViews: Set<string>;
  chainViews: Set<string>;
}): Finding[] {
  const only = (a: Set<string>, b: Set<string>): string[] =>
    [...a].filter((value) => !b.has(value)).sort();

  return [
    {
      label: `${input.applied.size} migration(s) applied to this database, but these versions have no file in database/migrations/`,
      names: only(input.applied, input.onDisk),
      hint: "the database ran a migration from a branch this checkout does not have — roll it back (`npx dbmate rollback` with that branch's file present) or land the branch. `dbmate status` cannot see this.",
    },
    {
      label: "migration file(s) never applied to this database",
      names: only(input.onDisk, input.applied),
      hint: "run `npm run db:migrate`.",
    },
    {
      label: "view(s) in the database that no migration creates",
      names: only(input.liveViews, input.chainViews),
      hint: "created outside the chain, or left behind by a migration rolled back without its down section.",
    },
    {
      label:
        "view(s) the migration chain creates but the database does not have",
      names: only(input.chainViews, input.liveViews),
      hint: "dropped outside the chain — every read through one of these resolves to nothing.",
    },
  ].filter((finding) => finding.names.length > 0);
}

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const migrations = readMigrations();
  if (migrations.length === 0) {
    throw new Error(`no migrations found under ${migrationsDir}`);
  }

  const sql = postgres(url, { max: 1 });
  let findings: Finding[] = [];
  let liveViewCount = 0;
  let appliedCount = 0;

  try {
    const appliedRows = await sql<{ version: string }[]>`
      SELECT version FROM schema_migrations ORDER BY version
    `;
    const viewRows = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public' AND table_name LIKE 'v\\_%'
      ORDER BY table_name
    `;

    const applied = new Set(appliedRows.map((row) => row.version));
    const liveViews = new Set(viewRows.map((row) => row.table_name));
    appliedCount = applied.size;
    liveViewCount = liveViews.size;

    findings = findDrift({
      applied,
      onDisk: new Set(migrations.map((migration) => migration.version)),
      liveViews,
      chainViews: expectedViews(migrations),
    });
  } finally {
    await sql.end();
  }

  if (findings.length === 0) {
    console.log(
      `OK: ${appliedCount} migration(s) applied, exactly matching database/migrations/; ${liveViewCount} v_* view(s) live, exactly matching the chain.`,
    );
    return;
  }

  for (const finding of findings) {
    console.error(`FAIL: ${finding.label}: ${finding.names.join(", ")}`);
    console.error(`      ${finding.hint}`);
  }
  console.error(
    "\nRefusing to continue: `db:introspect` would rewrite app/src/db/schema.ts from this database (#503).",
  );
  process.exit(1);
}

if (!process.env.VITEST) {
  run().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
