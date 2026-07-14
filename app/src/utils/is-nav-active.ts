export function isNavActive(
  pathname: string,
  href: string,
  matchPrefix?: string,
): boolean {
  if (pathname === href) return true;
  if (matchPrefix != null && pathname.startsWith(matchPrefix)) return true;
  return false;
}
