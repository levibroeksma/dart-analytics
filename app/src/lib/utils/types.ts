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

export interface ViewTransitionLike {
  types: { add(type: string): void };
  skipTransition(): void;
}

export interface TabRevealEventLike {
  viewTransition: ViewTransitionLike | null;
}
