import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { FACTORIES } from "./support/factories";

/**
 * Names called inside a page's Alpine attributes that a nested `x-data` scope
 * supplies (not the page factory). Keyed by page path under src/pages; one line each.
 */
const NESTED: Record<string, string[]> = {
  // nested x-data="game" panels (tuod etc.) call the game store's subtitle()
  "training/routines/play/index.astro": ["subtitle"],
};

/** Pre-existing unresolved bindings on main — "issue pending". Keyed by page path. */
const PENDING: Record<string, string[]> = {};

const JS_GLOBALS = new Set([
  "Math",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "JSON",
  "Date",
  "parseInt",
  "parseFloat",
  "isNaN",
]);

const PAGES_ROOT = resolve(__dirname, "../../../src/pages");

function pagesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pagesUnder(full));
    else if (entry.name === "index.astro") out.push(full);
  }
  return out;
}

const ROOTS = [
  join(PAGES_ROOT, "games"),
  join(PAGES_ROOT, "training/quick-subtract"),
  join(PAGES_ROOT, "training/routines/play"),
].filter(existsSync);

const PAGES = ROOTS.flatMap(pagesUnder)
  .filter((p) =>
    /\/(play|setup)\/index\.astro$|quick-subtract\/index\.astro$/.test(p),
  )
  .sort();

// x-*, @*, :* attributes, plus the `*Expr` props layout components forward into Alpine.
const ATTR =
  /(?<![\w-])((?:x-[\w:.-]+|@[\w:.-]+|:[\w.-]+|\w+Expr))\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const CALL = /(?<![.\w$])([A-Za-z_]\w*)\s*\(/g;

function calledNames(source: string): Set<string> {
  const body = source.replace(/^---[\s\S]*?\n---/, "");
  const names = new Set<string>();
  for (const m of body.matchAll(ATTR)) {
    if (m[1] === "x-data") continue;
    const value = m[2] ?? m[3] ?? "";
    for (const c of value.matchAll(CALL)) {
      if (!JS_GLOBALS.has(c[1])) names.add(c[1]);
    }
  }
  return names;
}

describe("page Alpine bindings resolve to factory keys", () => {
  it("finds the pages", () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(30);
  });

  for (const page of PAGES) {
    const rel = page.slice(PAGES_ROOT.length + 1);
    it(rel, () => {
      const source = readFileSync(page, "utf8");
      const factoryName = source.match(/x-data="(\w+)\(\)"/)?.[1];
      expect(factoryName, "root x-data factory").toBeDefined();
      const factory = FACTORIES[factoryName!];
      expect(factory, `factory ${factoryName} registered`).toBeDefined();

      const keys = new Set(Object.keys(factory()));
      const allowed = new Set([
        ...(NESTED[rel] ?? []),
        ...(PENDING[rel] ?? []),
      ]);
      const unresolved = [...calledNames(source)].filter(
        (n) => !keys.has(n) && !allowed.has(n),
      );
      expect(unresolved).toEqual([]);
    });
  }
});
