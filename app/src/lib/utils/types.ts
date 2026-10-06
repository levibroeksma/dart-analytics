export type RouteClass =
  | "public-page"
  | "asset"
  | "api-auth-proxy"
  | "api-provision"
  | "api-protected"
  | "protected-page";

export interface NavTab {
  label: string;
  href: string;
}
