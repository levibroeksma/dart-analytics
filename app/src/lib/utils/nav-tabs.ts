import type { NavTab } from "./types";

/** Bottom-nav tabs in display order. */
export const NAV_TABS: readonly NavTab[] = [
  { label: "Home", href: "/" },
  { label: "Games", href: "/games" },
  { label: "Training", href: "/training" },
  { label: "Stats", href: "/statistics" },
  { label: "Profile", href: "/profile" },
];

/** Default nested-path prefix for a tab: none for `/`, else `href + "/"`. */
export function navTabMatchPrefix(href: string): string | undefined {
  return href === "/" ? undefined : `${href}/`;
}
