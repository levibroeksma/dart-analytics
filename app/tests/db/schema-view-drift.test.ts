import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../database/migrations", import.meta.url),
);
const schemaPath = fileURLToPath(
  new URL("../../src/db/schema.ts", import.meta.url),
);

/**
 * `schema.ts`'s `pgView(...).as(sql`...`)` bodies are what `drizzle-kit` diffs
 * against, and the only in-repo restatement of a view's shape a TypeScript
 * reader is likely to trust -- but nothing compared them to the migration
 * chain, so `v_dart_analytics` and `v_dart_locations` carried the pre-`0023`
 * definition for three weeks (issue #363). The chain is authority; this fails
 * when a body stops matching the last `CREATE VIEW` that defines it.
 *
 * Only a live database can prove the view's real shape, and there is none in
 * this container -- so this compares text statically, the way
 * `read-model-non-game-sessions.test.ts` does.
 */
function upSection(sql: string): string {
  return sql
    .split(/^--\s*migrate:down\s*$/m)[0]
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
}

function chainViewBodies(): Map<string, { body: string; from: string }> {
  const bodies = new Map<string, { body: string; from: string }>();
  for (const name of readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    const up = upSection(readFileSync(`${migrationsDir}/${name}`, "utf8"));
    for (const statement of up.split(";")) {
      const match =
        /(?:^|\n)\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)\s+AS([\s\S]*)$/i.exec(
          statement,
        );
      if (match) bodies.set(match[1], { body: match[2], from: name });
    }
  }
  return bodies;
}

function schemaViewBodies(): Map<string, string> {
  const source = readFileSync(schemaPath, "utf8");
  const declaration =
    /pgView\(\s*"(\w+)"[\s\S]*?\}\)\.as\(\s*sql`([\s\S]*?)`,?\s*\)/g;
  const bodies = new Map<string, string>();
  for (let m = declaration.exec(source); m; m = declaration.exec(source)) {
    bodies.set(m[1], m[2]);
  }
  return bodies;
}

/**
 * Postgres echoes a view definition back with its own casts, parentheses and
 * spacing, and the chain is hand-formatted -- so comparing raw text reports a
 * diff on every view. Normalizing case, whitespace, `::type` casts and
 * parentheses away leaves exactly the drift #363 is about: which tables are
 * joined, how, which columns are selected, and what the predicate says.
 *
 * Dropping parentheses is what makes the comparison survive a real
 * `drizzle-kit introspect`, whose output wraps subexpressions the migration
 * does not (`extract(epoch FROM (a - b))`, `(- d.location_y)::double
 * precision`). The cost is that a drift which only regroups an existing
 * expression -- `a AND (b OR c)` becoming `(a AND b) OR c` -- reads as a
 * match here.
 */
function normalize(sql: string): string {
  return sql
    .replace(
      /::\s*[a-z_]+(\s+(?:precision|varying|with\s+time\s+zone|without\s+time\s+zone))?(\s*\[\])?/gi,
      "",
    )
    .replace(/[()]/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;+$/, "")
    .toLowerCase();
}

const chain = chainViewBodies();
const schema = schemaViewBodies();

describe("schema.ts view bodies match the migration chain", () => {
  it("declares a pgView for every view the chain creates", () => {
    expect([...schema.keys()].sort()).toEqual([...chain.keys()].sort());
  });

  for (const [view, { body, from }] of chain) {
    it(`${view} matches its definition in ${from}`, () => {
      const declared = schema.get(view);
      expect(declared, `${view} has no pgView in schema.ts`).toBeDefined();
      expect(
        normalize(declared!),
        `${view}'s pgView body has drifted from ${from}`,
      ).toBe(normalize(body));
    });
  }
});
