import type { APIRoute } from "astro";
import { getCatalogTags } from "@services/catalog.service";
import { ok, fail } from "@server/envelope";

export const GET: APIRoute = async ({ locals }) => {
  const result = await getCatalogTags();
  if (!result.ok) return fail(result.code, locals.requestId, result.details);
  return ok(result.data, locals.requestId);
};
