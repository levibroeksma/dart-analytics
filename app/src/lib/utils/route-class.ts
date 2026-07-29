import { isPublicPage, normalizePath } from "./auth-routes";
import type { RouteClass } from "./types";

const PROVISION_ROUTE = "/api/players/provision";
const AUTH_PROXY_ROOT = "/api/auth";

export function classifyRoute(path: string): RouteClass {
  if (path === AUTH_PROXY_ROOT || path.startsWith(`${AUTH_PROXY_ROOT}/`))
    return "api-auth-proxy";
  if (path === PROVISION_ROUTE) return "api-provision";
  if (path.startsWith("/api/")) return "api-protected";
  if (isPublicPage(normalizePath(path))) return "public-page";
  if (path.includes(".")) return "asset";
  return "protected-page";
}
