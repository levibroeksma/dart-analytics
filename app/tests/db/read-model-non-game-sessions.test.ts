import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = fileURLToPath(
  new URL("../../../database/migrations", import.meta.url),
);

/**
 * Migration `0029` relaxed `exercise_sessions.game_type_id`,
 * `ruleset_version_id`, `capture_mode_id` and `input_mode_id` to NULLABLE, and
 * `0028` did the same for `exercise_templates.game_type_id`. An INNER JOIN onto
 * any of those lookups silently deletes the whole row instead of returning a
 * NULL key, so a training exercise session becomes invisible to the read model
 * rather than appearing with an empty game type. Only a live database proves
 * the row count, and there is none in this container -- so this guards the
 * chain statically, the same way `migration-numeric-typing.test.ts` does.
 */
const upSections = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => {
    const sql = readFileSync(`${migrationsDir}/${name}`, "utf8");
    const up = sql
      .split(/^--\s*migrate:down\s*$/m)[0]
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    return { name, up };
  });

function effectiveViewDefinitions(): Map<
  string,
  { sql: string; from: string }
> {
  const definitions = new Map<string, { sql: string; from: string }>();
  for (const { name, up } of upSections) {
    for (const statement of up.split(";")) {
      const match =
        /(?:^|\n)\s*CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)\s+AS/i.exec(
          statement,
        );
      if (match) definitions.set(match[1], { sql: statement, from: name });
    }
  }
  return definitions;
}

const views = effectiveViewDefinitions();

function innerJoinedLookups(sql: string, lookup: string): number {
  const pattern = new RegExp(
    `(LEFT\\s+(?:OUTER\\s+)?)?JOIN\\s+${lookup}\\b`,
    "gi",
  );
  let inner = 0;
  for (let m = pattern.exec(sql); m; m = pattern.exec(sql)) {
    if (!m[1]) inner += 1;
  }
  return inner;
}

function joinCount(sql: string, lookup: string): number {
  return (sql.match(new RegExp(`JOIN\\s+${lookup}\\b`, "gi")) ?? []).length;
}

/**
 * Every view whose population must survive a session (or template) that has no
 * game bound to it, mapped to the nullable lookups it reaches through.
 */
const NULLABLE_LOOKUP_JOINS: Record<string, string[]> = {
  v_active_sessions: [
    "game_types",
    "ruleset_versions",
    "capture_modes",
    "input_modes",
  ],
  v_session_overview: ["game_types", "capture_modes"],
  v_dart_analytics: ["game_types"],
  v_dart_locations: ["game_types", "input_modes"],
  v_player_visit_facts: ["game_types"],
  v_player_leg_facts: ["game_types"],
  v_routine_execution: ["game_types"],
};

describe("read-model views admit non-game exercise sessions", () => {
  it("resolves an effective definition for every affected view", () => {
    for (const view of Object.keys(NULLABLE_LOOKUP_JOINS)) {
      expect(
        views.get(view),
        `${view} has no CREATE VIEW in the chain`,
      ).toBeDefined();
    }
  });

  for (const [view, lookups] of Object.entries(NULLABLE_LOOKUP_JOINS)) {
    for (const lookup of lookups) {
      it(`${view} LEFT JOINs ${lookup}`, () => {
        const definition = views.get(view)!;
        expect(
          joinCount(definition.sql, lookup),
          `${view} (last defined in ${definition.from}) no longer joins ${lookup}`,
        ).toBeGreaterThan(0);
        expect(
          innerJoinedLookups(definition.sql, lookup),
          `${view} (last defined in ${definition.from}) INNER JOINs ${lookup}, which drops every row whose FK is NULL`,
        ).toBe(0);
      });
    }
  }

  /**
   * The two deliberate exceptions. `v_configuration_presets` reads
   * `configuration_templates.game_type_id`, which is still NOT NULL, and
   * `v_x01_checkout_darts` restricts itself to 501/TUOD/ONE_TWENTY_ONE
   * VISUAL_BOARD sessions in its own WHERE clause -- a non-game session can
   * never satisfy either filter, so relaxing its joins would change nothing.
   */
  it("leaves the two deliberately game-only views inner-joined", () => {
    expect(
      innerJoinedLookups(
        views.get("v_configuration_presets")!.sql,
        "game_types",
      ),
    ).toBe(1);
    const checkoutDarts = views.get("v_x01_checkout_darts")!.sql;
    expect(innerJoinedLookups(checkoutDarts, "game_types")).toBe(1);
    expect(checkoutDarts).toMatch(
      /gt\.implementation_key\s+IN\s*\(\s*'501'\s*,\s*'TUOD'\s*,\s*'ONE_TWENTY_ONE'\s*\)/i,
    );
    expect(checkoutDarts).toMatch(
      /im\.implementation_key\s*=\s*'VISUAL_BOARD'/i,
    );
  });
});
