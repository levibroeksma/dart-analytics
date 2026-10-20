import { apiRequest } from "./client";
import { unwrapOrThrow } from "./unwrap";
import type { CatalogTagsResponseData } from "./types";

export async function fetchCatalogTags(): Promise<CatalogTagsResponseData> {
  return unwrapOrThrow(
    await apiRequest<CatalogTagsResponseData>("/api/catalog-tags", {
      method: "GET",
    }),
  );
}
