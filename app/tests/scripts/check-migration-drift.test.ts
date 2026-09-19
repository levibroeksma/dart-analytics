import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  expectedViews,
  findDrift,
  readMigrations,
  upRegion,
  type Migration,
} from "../../scripts/check-migration-drift";

const migrationsDir = fileURLToPath(
  new URL("../../../database/migrations", import.meta.url),
);

function migration(version: string, up: string): Migration {
  return { version, file: `${version}_probe.sql`, up };
}

function drift(
  input: Partial<Parameters<typeof findDrift>[0]>,
): ReturnType<typeof findDrift> {
  return findDrift({
    applied: new Set(),
    onDisk: new Set(),
    liveViews: new Set(),
    chainViews: new Set(),
    ...input,
  });
}

/**
 * #503: Neon `dev` carried migration 0038 from an unpushed branch — it had
 * dropped `v_double_out_checkout_darts` and created `v_x01_checkout_darts` —
 * while `dbmate status` reported `Applied: 37 / Pending: 0`, because dbmate
 * enumerates files and never sees an applied row without one. These cover the
 * four shapes that failure can take, plus the chain replay the view halves
 * depend on.
 */
describe("upRegion", () => {
  it("keeps only the applied-forward region", () => {
    const sql = "-- header\n-- migrate:up\nUP;\n-- migrate:down\nDOWN;\n";
    expect(upRegion(sql)).toContain("UP;");
    expect(upRegion(sql)).not.toContain("DOWN;");
    expect(upRegion(sql)).not.toContain("-- header");
  });

  it("returns the whole file when there are no dbmate markers", () => {
    expect(upRegion("SELECT 1;")).toBe("SELECT 1;");
  });

  it("keeps everything after migrate:up when there is no down section", () => {
    expect(upRegion("-- migrate:up\nUP;")).toContain("UP;");
  });
});

describe("expectedViews", () => {
  it("replays creates and drops in migration order", () => {
    const views = expectedViews([
      migration("0001", "CREATE VIEW v_one AS SELECT 1;"),
      migration("0002", "CREATE VIEW v_two AS SELECT 2;"),
      migration("0003", "DROP VIEW IF EXISTS v_one;"),
    ]);
    expect([...views]).toEqual(["v_two"]);
  });

  it("re-adds a view a later migration drops and recreates", () => {
    const views = expectedViews([
      migration("0001", "CREATE VIEW v_one AS SELECT 1;"),
      migration(
        "0002",
        "DROP VIEW IF EXISTS v_one;\nCREATE VIEW v_one AS SELECT 2;",
      ),
    ]);
    expect([...views]).toEqual(["v_one"]);
  });

  it("handles CREATE OR REPLACE and a multi-name DROP", () => {
    const views = expectedViews([
      migration("0001", "CREATE OR REPLACE VIEW v_one AS SELECT 1;"),
      migration("0002", "CREATE VIEW v_two AS SELECT 2;"),
      migration("0003", "DROP VIEW IF EXISTS v_one, v_two;"),
    ]);
    expect([...views]).toEqual([]);
  });

  it("ignores a view that only a migrate:down section recreates", () => {
    const parsed = readMigrations(migrationsDir);
    const views = expectedViews(parsed);
    expect(views.has("v_double_out_checkout_darts")).toBe(false);
    expect(views.has("v_x01_checkout_darts")).toBe(true);
  });
});

describe("readMigrations", () => {
  it("reads the real chain in filename order and derives each version", () => {
    const parsed = readMigrations(migrationsDir);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed[0].version).toBe("0001");
    expect(parsed.map((entry) => entry.version)).toEqual(
      [...parsed.map((entry) => entry.version)].sort(),
    );
  });
});

describe("findDrift", () => {
  it("reports nothing when the database matches the chain", () => {
    expect(
      drift({
        applied: new Set(["0001"]),
        onDisk: new Set(["0001"]),
        liveViews: new Set(["v_one"]),
        chainViews: new Set(["v_one"]),
      }),
    ).toEqual([]);
  });

  it("reports an applied version with no file — the #503 case", () => {
    const findings = drift({
      applied: new Set(["0037", "0038"]),
      onDisk: new Set(["0037"]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].names).toEqual(["0038"]);
    expect(findings[0].label).toContain("no file in database/migrations/");
  });

  it("reports a file that was never applied", () => {
    const findings = drift({
      applied: new Set(["0037"]),
      onDisk: new Set(["0037", "0038"]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].names).toEqual(["0038"]);
    expect(findings[0].hint).toContain("db:migrate");
  });

  it("reports a live view no migration creates", () => {
    const findings = drift({
      liveViews: new Set(["v_x01_checkout_darts"]),
      chainViews: new Set(),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].names).toEqual(["v_x01_checkout_darts"]);
  });

  it("reports a chain view the database does not have", () => {
    const findings = drift({
      liveViews: new Set(),
      chainViews: new Set(["v_double_out_checkout_darts"]),
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].names).toEqual(["v_double_out_checkout_darts"]);
    expect(findings[0].hint).toContain("resolves to nothing");
  });

  it("reports every shape at once when the #503 drift is present", () => {
    const findings = drift({
      applied: new Set(["0038"]),
      onDisk: new Set(["0037"]),
      liveViews: new Set(["v_x01_checkout_darts"]),
      chainViews: new Set(["v_double_out_checkout_darts"]),
    });
    expect(findings).toHaveLength(4);
  });
});
