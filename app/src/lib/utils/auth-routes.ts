export const PUBLIC_PAGES = new Set(["/login"]);

export function normalizePath(path: string): string {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

export function isPublicPage(path: string): boolean {
  return PUBLIC_PAGES.has(normalizePath(path));
}
