import { isNavActive } from "./is-nav-active";
import type { NavTab } from "./types";

/** Bottom-nav tabs in display order; a tab's index is its transition position. */
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

/** Index of the tab owning `pathname`, or `null` when no tab does. */
export function navTabIndex(pathname: string): number | null {
  const index = NAV_TABS.findIndex((tab) =>
    isNavActive(pathname, tab.href, navTabMatchPrefix(tab.href)),
  );
  return index === -1 ? null : index;
}
