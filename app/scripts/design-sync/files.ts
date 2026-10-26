/**
 * File listing shared by the Claude Design sync pairers.
 * Decision: D498
 */
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * List files under a directory, recursively, as `/`-separated relative paths.
 *
 * @param dir - Directory to scan; a missing directory yields no files.
 * @param recursive - Descend into subdirectories.
 * @returns Sorted paths relative to `dir`.
 */
export function listFiles(dir: string, recursive = true): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const visit = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (recursive) visit(full);
      } else if (entry.isFile() && !entry.name.startsWith(".")) {
        out.push(relative(dir, full).split("\\").join("/"));
      }
    }
  };
  visit(dir);
  return out.sort();
}
