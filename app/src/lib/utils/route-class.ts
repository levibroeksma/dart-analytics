import { isPublicPage, normalizePath } from "./auth-routes";
import type { RouteClass } from "./types";

const PROVISION_ROUTE = "/api/players/provision";

export function classifyRoute(path: string): RouteClass {
  if (path === PROVISION_ROUTE) return "api-provision";
  if (path.startsWith("/api/")) return "api-protected";
  if (isPublicPage(normalizePath(path))) return "public-page";
  if (path.includes(".")) return "asset";
  return "protected-page";
}
