import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../database/migrations", import.meta.url),
);

const migrations = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .map((name) => ({
    name,
    sql: readFileSync(`${migrationsDir}/${name}`, "utf8"),
  }));

/**
 * `MOD()` has no `double precision` overload in PostgreSQL, and the cast from
 * `double precision` to `numeric` is assignment-only — so it is not considered
 * during function resolution. `MOD(DEGREES(...) + 360, 360)` therefore fails at
 * `CREATE VIEW` with "function mod(double precision, integer) does not exist",
 * which no amount of unit testing catches: the SQL only runs against a real
 * database. `0018_dart_location_read_model.sql` shipped with exactly that bug.
 *
 * Every trigonometric SQL function in this list returns `double precision`, so
 * a `MOD()` whose first argument reaches one of them without an intervening
 * `::NUMERIC` cast is the same defect again.
 */
const DOUBLE_RETURNING = ["DEGREES", "RADIANS", "ATAN2", "SQRT", "POWER"];

function modArguments(sql: string): string[] {
  const args: string[] = [];
  const pattern = /\bMOD\s*\(/gi;

  for (let match = pattern.exec(sql); match; match = pattern.exec(sql)) {
    let depth = 1;
    let index = match.index + match[0].length;
    const start = index;

    while (index < sql.length && depth > 0) {
      if (sql[index] === "(") depth += 1;
      if (sql[index] === ")") depth -= 1;
      index += 1;
    }
    args.push(sql.slice(start, index - 1));
  }

  return args;
}

describe("migration SQL numeric typing", () => {
  it("reads the migration chain", () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it.each(migrations.map(({ name }) => name))(
    "%s casts double-precision expressions before MOD()",
    (name) => {
      const migration = migrations.find((entry) => entry.name === name);
      const offenders = modArguments(migration!.sql).filter((argument) => {
        const usesDouble = DOUBLE_RETURNING.some((fn) =>
          new RegExp(`\\b${fn}\\s*\\(`, "i").test(argument),
        );
        return usesDouble && !/::\s*NUMERIC/i.test(argument);
      });

      expect(offenders).toEqual([]);
    },
  );
});
