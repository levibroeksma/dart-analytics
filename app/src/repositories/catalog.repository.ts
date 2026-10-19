import { asc } from "drizzle-orm";
import type { getDb } from "@db/client";
import { vCatalogTags } from "@db/schema";
import { nonNull } from "./row-helpers";
import type { CatalogTagRow } from "./interfaces";

type Db = ReturnType<typeof getDb>;

/** Every `v_catalog_tags` row, ordered by type then tag `sort_order`. */
export async function findCatalogTagRows(db: Db): Promise<CatalogTagRow[]> {
  const rows = await db
    .select({
      entityKind: vCatalogTags.entityKind,
      typeKey: vCatalogTags.typeKey,
      contextKey: vCatalogTags.contextKey,
      axisKey: vCatalogTags.axisKey,
      tagKey: vCatalogTags.tagKey,
      tagName: vCatalogTags.tagName,
      isPrimary: vCatalogTags.isPrimary,
      sortOrder: vCatalogTags.sortOrder,
      axisRank: vCatalogTags.axisRank,
    })
    .from(vCatalogTags)
    .orderBy(asc(vCatalogTags.typeKey), asc(vCatalogTags.sortOrder));
  return rows.map((row) => ({
    entityKind: nonNull(row.entityKind, "entity_kind"),
    typeKey: nonNull(row.typeKey, "type_key"),
    contextKey: nonNull(row.contextKey, "context_key"),
    axisKey: nonNull(row.axisKey, "axis_key"),
    tagKey: nonNull(row.tagKey, "tag_key"),
    tagName: nonNull(row.tagName, "tag_name"),
    isPrimary: nonNull(row.isPrimary, "is_primary"),
    sortOrder: nonNull(row.sortOrder, "sort_order"),
    axisRank: nonNull(row.axisRank, "axis_rank"),
  }));
}
