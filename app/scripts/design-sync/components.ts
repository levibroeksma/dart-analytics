/**
 * Pair design-system components with app components for the Claude Design
 * sync. React and Astro are never compared line by line, so items are not
 * comparable: the hashes only tell which side changed since the last sync.
 * Spec: docs/superpowers/specs/2026-10-26-design-system-sync-design.md
 * Decision: D498
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listFiles } from "./files";
import { sha256, type ComponentPair, type Side, type SyncItem } from "./lock";

const DESIGN_EXTS = [".jsx", ".d.ts", ".prompt.md"];
const CODE_DIRS = ["app/src/components/ui", "app/src/components/forms"];

function hashFiles(root: string, paths: string[]): string {
  return sha256(
    paths
      .filter((p) => existsSync(join(root, p)))
      .map((p) => readFileSync(join(root, p), "utf8"))
      .join(""),
  );
}

function designSide(root: string, stem: string): Side {
  return {
    path: stem,
    hash: hashFiles(
      root,
      DESIGN_EXTS.map((ext) => stem + ext),
    ),
  };
}

function codeSide(root: string, paths: string[]): Side | null {
  if (paths.length === 0) return null;
  return { path: paths[0], hash: hashFiles(root, paths) };
}

function designStems(designRoot: string): string[] {
  const stems = new Set<string>();
  for (const rel of listFiles(join(designRoot, "components"))) {
    const ext = DESIGN_EXTS.find((e) => rel.endsWith(e));
    if (ext) stems.add(`components/${rel.slice(0, -ext.length)}`);
  }
  return [...stems];
}

/**
 * Build one non-comparable item per component pair and per one-sided component.
 *
 * @param designRoot - Mirror directory holding the remote `components/` tree.
 * @param repoRoot - Repository root (parent of `app/`).
 * @param pairs - Pairs from the lock; `design` is a stem, `code` repo-relative paths.
 * @returns Items sorted by id.
 */
export function componentItems(
  designRoot: string,
  repoRoot: string,
  pairs: ComponentPair[],
): SyncItem[] {
  const pairedStems = new Set(
    pairs.flatMap((p) => (p.design ? [p.design] : [])),
  );
  const pairedCode = new Set(pairs.flatMap((p) => p.code));
  const items: SyncItem[] = pairs.map((p) => ({
    id: `component:${basename(p.design ?? p.code[0] ?? "", ".astro")}`,
    area: "components",
    design: p.design ? designSide(designRoot, p.design) : null,
    code: codeSide(repoRoot, p.code),
    comparable: false,
  }));

  for (const stem of designStems(designRoot)) {
    if (pairedStems.has(stem)) continue;
    items.push({
      id: `component:${basename(stem)}`,
      area: "components",
      design: designSide(designRoot, stem),
      code: null,
      comparable: false,
    });
  }
  for (const dir of CODE_DIRS) {
    for (const rel of listFiles(join(repoRoot, dir), false)) {
      const path = `${dir}/${rel}`;
      if (!rel.endsWith(".astro") || pairedCode.has(path)) continue;
      items.push({
        id: `component:${basename(rel, ".astro")}`,
        area: "components",
        design: null,
        code: codeSide(repoRoot, [path]),
        comparable: false,
      });
    }
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}
