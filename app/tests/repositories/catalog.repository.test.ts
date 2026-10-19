import { describe, it, expect } from "vitest";
import { renderingDb, onlyStatement } from "./render-sql";
import { findCatalogTagRows } from "@repositories/catalog.repository";

describe("findCatalogTagRows", () => {
  it("reads v_catalog_tags ordered by type key then sort order", async () => {
    const { db, statements } = renderingDb([]);
    await findCatalogTagRows(db);
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_catalog_tags"');
    expect(sql).toMatch(/order by .*"type_key".*"sort_order"/);
  });
});
