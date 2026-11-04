/**
 * Pair design-system components (one folder per component in the Design
 * System artifact: `components/<Name>/`) with app components. React and Astro are never compared line by line, so items are not
 * comparable: the hashes only tell which side changed since the last sync.
 * Spec: docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md
 * Decision: D499
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { listFiles } from "./files";
import { sha256, type ComponentPair, type Side, type SyncItem } from "./lock";

const NOT_COMPONENTS = new Set(["Cover"]);
const CODE_DIRS = ["app/src/components/ui", "app/src/components/forms"];

/** Side for the files that exist, or null when none do (deleted or renamed). */
function sideOf(root: string, path: string, files: string[]): Side | null {
  const present = files.filter((p) => existsSync(join(root, p)));
  if (present.length === 0) return null;
  const text = present.map((p) => readFileSync(join(root, p), "utf8"));
  return { path, hash: sha256(text.join("")) };
}

/** `components/<Name>/<Name>` → its source, types and guide; never preview.html. */
function designFiles(stem: string): string[] {
  return [`${stem}.jsx`, `${stem}.d.ts`, `${dirname(stem)}/README.md`];
}

function designSide(root: string, stem: string): Side | null {
  return sideOf(root, stem, designFiles(stem));
}

function codeSide(root: string, paths: string[]): Side | null {
  return paths.length === 0 ? null : sideOf(root, paths[0], paths);
}

function designStems(designRoot: string): string[] {
  const dir = join(designRoot, "components");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[A-Z]/.test(d.name))
    .filter((d) => !NOT_COMPONENTS.has(d.name))
    .map((d) => `components/${d.name}/${d.name}`)
    .filter((stem) =>
      designFiles(stem).some((p) => existsSync(join(designRoot, p))),
    );
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
