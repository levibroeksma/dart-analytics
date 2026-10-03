import { describe, expect, it } from "vitest";
import { normalizeSchema } from "../../scripts/normalize-schema";

const header = `import { pgTable, varchar, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
`;

const tableB = `export const bravo = pgTable("bravo", {
  id: varchar().primaryKey().notNull(),
});`;

const tableA = `export const alpha = pgTable(
  "alpha",
  {
    id: varchar().primaryKey().notNull(),
  },
  (table) => [check("c", sql\`true\`)],
);`;

describe("normalizeSchema", () => {
  it("sorts declarations by name and keeps each body intact", () => {
    const out = normalizeSchema(`${header}\n${tableB}\n\n${tableA}\n`);
    expect(out.indexOf("export const alpha")).toBeLessThan(
      out.indexOf("export const bravo"),
    );
    expect(out).toContain(tableA);
    expect(out).toContain(tableB);
  });

  it("sorts import specifiers", () => {
    const out = normalizeSchema(`${header}\n${tableB}\n`);
    expect(out).toContain(
      'import { check, pgTable, varchar } from "drizzle-orm/pg-core";',
    );
  });

  it("is independent of input order", () => {
    const one = normalizeSchema(`${header}\n${tableB}\n\n${tableA}\n`);
    const two = normalizeSchema(`${header}\n${tableA}\n\n${tableB}\n`);
    expect(one).toBe(two);
  });

  it("is idempotent", () => {
    const once = normalizeSchema(`${header}\n${tableB}\n\n${tableA}\n`);
    expect(normalizeSchema(once)).toBe(once);
  });

  it("rejects input with no declaration", () => {
    expect(() => normalizeSchema(header)).toThrow(/no `export const`/);
  });

  it("rejects a duplicate declaration", () => {
    expect(() =>
      normalizeSchema(`${header}\n${tableA}\n\n${tableA}\n`),
    ).toThrow(/duplicate declaration: alpha/);
  });
});
