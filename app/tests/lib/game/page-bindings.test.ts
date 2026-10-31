import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { FACTORIES } from "./support/factories";

/**
 * Names called inside a page's Alpine attributes that a nested `x-data` scope
 * supplies (nested x-data subtrees are skipped automatically, so this is rarely needed) (not the page factory). Keyed by page path under src/pages; one line each.
 */
const NESTED: Record<string, string[]> = {};

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
  // CSS functions inside :style template strings, not Alpine calls
  "translate",
  "rotate",
  "scale",
  "calc",
  "var",
]);

const SRC = resolve(__dirname, "../../../src");
const PAGES_ROOT = join(SRC, "pages");
// Mirrors tsconfig `paths`; only the aliases astro components import through.
const ALIASES: Record<string, string> = {
  "@components/": join(SRC, "components/"),
  "@layouts/": join(SRC, "layouts/"),
  "@pages/": join(SRC, "pages/"),
  "@icons/": join(SRC, "icons/"),
};

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
const ATTR_NAME = /^(?:x-[\w:.-]+|@[\w:.-]+|:[\w.-]+|\w+Expr)$/;
const CALL = /(?<![.\w$])([A-Za-z_]\w*)\s*\(/g;
const VOID = new Set([
  "input",
  "img",
  "br",
  "hr",
  "meta",
  "link",
  "source",
  "wbr",
]);

type Attr = { name: string; value: string | null };
type Tag = {
  name: string;
  attrs: Attr[];
  closing: boolean;
  selfClose: boolean;
};

/** Balanced `{...}` starting at `i` (which points at `{`); returns index after it. */
function skipBraces(src: string, i: number): number {
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i + 1;
  }
  return i;
}

/** Minimal tag tokenizer: quote- and brace-aware, skips comments and script/style bodies. */
function* tags(src: string): Generator<Tag> {
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) return;
    if (src.startsWith("<!--", lt)) {
      i = src.indexOf("-->", lt) + 3 || src.length;
      continue;
    }
    const closing = src[lt + 1] === "/";
    const nameStart = lt + (closing ? 2 : 1);
    const nm = /^[A-Za-z][\w.:-]*/.exec(src.slice(nameStart, nameStart + 80));
    if (!nm) {
      i = lt + 1;
      continue;
    }
    const name = nm[0];
    i = nameStart + name.length;
    const attrs: Attr[] = [];
    let selfClose = false;
    while (i < src.length) {
      while (/\s/.test(src[i] ?? "")) i++;
      if (src.startsWith("/>", i)) {
        selfClose = true;
        i += 2;
        break;
      }
      if (src[i] === ">") {
        i++;
        break;
      }
      if (src[i] === "{") {
        i = skipBraces(src, i);
        continue;
      }
      const an = /^[^\s=>/]+/.exec(src.slice(i, i + 200));
      if (!an) {
        i++;
        continue;
      }
      i += an[0].length;
      let value: string | null = null;
      if (src[i] === "=") {
        i++;
        const q = src[i];
        if (q === '"' || q === "'") {
          const end = src.indexOf(q, i + 1);
          value = src.slice(i + 1, end);
          i = end + 1;
        } else if (q === "{") {
          const end = skipBraces(src, i);
          i = end; // dynamic value: not statically readable
        } else {
          const um = /^[^\s>]+/.exec(src.slice(i));
          i += um ? um[0].length : 0;
        }
      }
      attrs.push({ name: an[0], value });
    }
    yield { name, attrs, closing, selfClose };
    if (!closing && (name === "script" || name === "style") && !selfClose) {
      i = src.indexOf(`</${name}`, i);
      if (i < 0) return;
    }
  }
}

function resolveImport(from: string, spec: string): string | null {
  for (const [prefix, dir] of Object.entries(ALIASES)) {
    if (spec.startsWith(prefix)) return dir + spec.slice(prefix.length);
  }
  if (spec.startsWith(".")) return resolve(dirname(from), spec);
  return null;
}

function splitFrontmatter(source: string): { front: string; body: string } {
  const m = /^---\n([\s\S]*?)\n---/.exec(source);
  return m
    ? { front: m[1], body: source.slice(m[0].length) }
    : { front: "", body: source };
}

/**
 * Alpine call names (`foo(` not `.foo(`) in x-* / @* / :* / *Expr attribute values of a
 * page and every .astro component reached through its imports. An element that declares its
 * own `x-data` (other than the page's root one) starts a different scope: its attributes,
 * children and component import are skipped.
 */
function collectCalls(
  file: string,
  isPage: boolean,
  seen: Set<string>,
  out: Set<string>,
): void {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const { front, body } = splitFrontmatter(readFileSync(file, "utf8"));

  const imports = new Map<string, string>();
  for (const m of front.matchAll(
    /import\s+(\w+)\s+from\s+["']([^"']+\.astro)["']/g,
  )) {
    const target = resolveImport(file, m[2]);
    if (target) imports.set(m[1], target);
  }

  let rootSeen = !isPage;
  const stack: string[] = [];
  let skipBelow = -1; // stack length at which a nested scope ends; -1 = not skipping
  for (const tag of tags(body)) {
    if (tag.closing) {
      const at = stack.lastIndexOf(tag.name);
      if (at >= 0) stack.length = at;
      if (skipBelow >= 0 && stack.length < skipBelow) skipBelow = -1;
      continue;
    }
    const skipping = skipBelow >= 0;
    const hasData = tag.attrs.some((a) => a.name === "x-data");
    const nested = hasData && (rootSeen || !isPage);
    if (hasData && !rootSeen) rootSeen = true;
    const open = !tag.selfClose && !VOID.has(tag.name);
    if (open) stack.push(tag.name);
    if (skipping) continue;
    if (nested) {
      if (open) skipBelow = stack.length;
      continue;
    }
    for (const a of tag.attrs) {
      if (a.value == null || a.name === "x-data" || !ATTR_NAME.test(a.name))
        continue;
      for (const c of a.value.matchAll(CALL)) {
        if (!JS_GLOBALS.has(c[1])) out.add(c[1]);
      }
    }
    const target = imports.get(tag.name);
    if (target) collectCalls(target, false, seen, out);
  }
}

function calledNames(page: string): Set<string> {
  const out = new Set<string>();
  collectCalls(page, true, new Set(), out);
  return out;
}

// Limit: only call syntax (`name(`) is checked. Property reads (`x-text="total"`) and
// dynamic `attr={...}` values are not, so a missing data property goes unnoticed.
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

      const names = calledNames(page);
      expect(names.size, "non-vacuity: page yields call names").toBeGreaterThan(
        0,
      );

      const keys = new Set(Object.keys(factory()));
      const allowed = new Set([
        ...(NESTED[rel] ?? []),
        ...(PENDING[rel] ?? []),
      ]);
      const unresolved = [...names].filter(
        (n) => !keys.has(n) && !allowed.has(n),
      );
      expect(unresolved, rel).toEqual([]);
    });
  }
});
