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

/** Value after `=` at `i`: quoted text is readable; `{...}` and bare values are skipped. */
function readAttrValue(
  src: string,
  i: number,
): { value: string | null; end: number } {
  const q = src[i];
  if (q === '"' || q === "'") {
    const end = src.indexOf(q, i + 1);
    return { value: src.slice(i + 1, end), end: end + 1 };
  }
  if (q === "{") return { value: null, end: skipBraces(src, i) };
  const bare = /^[^\s>]+/.exec(src.slice(i));
  return { value: null, end: i + (bare ? bare[0].length : 0) };
}

/** One `name` or `name=value` attribute at `i`, or null when no name starts there. */
function readAttr(src: string, i: number): { attr: Attr; end: number } | null {
  const an = /^[^\s=>/]+/.exec(src.slice(i, i + 200));
  if (!an) return null;
  const at = i + an[0].length;
  if (src[at] !== "=") return { attr: { name: an[0], value: null }, end: at };
  const { value, end } = readAttrValue(src, at + 1);
  return { attr: { name: an[0], value }, end };
}

/** Attributes from `i` up to and including the tag's `>` or `/>`. */
function readAttrs(
  src: string,
  start: number,
): { attrs: Attr[]; selfClose: boolean; end: number } {
  const attrs: Attr[] = [];
  let i = start;
  while (i < src.length) {
    while (/\s/.test(src[i] ?? "")) i++;
    if (src.startsWith("/>", i)) return { attrs, selfClose: true, end: i + 2 };
    if (src[i] === ">") return { attrs, selfClose: false, end: i + 1 };
    if (src[i] === "{") {
      i = skipBraces(src, i);
      continue;
    }
    const read = readAttr(src, i);
    if (!read) {
      i++;
      continue;
    }
    attrs.push(read.attr);
    i = read.end;
  }
  return { attrs, selfClose: false, end: i };
}

/** Tag whose `<` is at `lt`; null when no tag name follows. */
function readTag(src: string, lt: number): { tag: Tag; end: number } | null {
  const closing = src[lt + 1] === "/";
  const nameStart = lt + (closing ? 2 : 1);
  const nm = /^[A-Za-z][\w.:-]*/.exec(src.slice(nameStart, nameStart + 80));
  if (!nm) return null;
  const { attrs, selfClose, end } = readAttrs(src, nameStart + nm[0].length);
  return { tag: { name: nm[0], attrs, closing, selfClose }, end };
}

function hasRawBody(tag: Tag): boolean {
  return (
    !tag.closing &&
    !tag.selfClose &&
    (tag.name === "script" || tag.name === "style")
  );
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
    const read = readTag(src, lt);
    if (!read) {
      i = lt + 1;
      continue;
    }
    i = read.end;
    yield read.tag;
    if (hasRawBody(read.tag)) {
      i = src.indexOf(`</${read.tag.name}`, i);
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

/** `import Name from "x.astro"` entries of a frontmatter, resolved to absolute paths. */
function astroImports(file: string, front: string): Map<string, string> {
  const imports = new Map<string, string>();
  const re = /import\s+(\w+)\s+from\s+["']([^"']+\.astro)["']/g;
  for (const m of front.matchAll(re)) {
    const target = resolveImport(file, m[2]);
    if (target) imports.set(m[1], target);
  }
  return imports;
}

/** Add the call names found in a tag's Alpine attributes. */
function addCalls(tag: Tag, out: Set<string>): void {
  for (const a of tag.attrs) {
    if (a.value == null || a.name === "x-data" || !ATTR_NAME.test(a.name))
      continue;
    for (const c of a.value.matchAll(CALL)) {
      if (!JS_GLOBALS.has(c[1])) out.add(c[1]);
    }
  }
}

/** Element nesting plus the nested-`x-data` skip state while walking one file. */
class ScopeWalk {
  private stack: string[] = [];
  private skipBelow = -1; // stack length at which a nested scope ends; -1 = not skipping
  private rootSeen: boolean;
  constructor(private isPage: boolean) {
    this.rootSeen = !isPage;
  }

  private close(tag: Tag): void {
    const at = this.stack.lastIndexOf(tag.name);
    if (at >= 0) this.stack.length = at;
    if (this.skipBelow >= 0 && this.stack.length < this.skipBelow)
      this.skipBelow = -1;
  }

  private declaresNestedScope(tag: Tag): boolean {
    const hasData = tag.attrs.some((a) => a.name === "x-data");
    const nested = hasData && (this.rootSeen || !this.isPage);
    if (hasData) this.rootSeen = true;
    return nested;
  }

  /** True when the tag's attributes and component import belong to this file's scope. */
  visit(tag: Tag): boolean {
    if (tag.closing) {
      this.close(tag);
      return false;
    }
    const skipping = this.skipBelow >= 0;
    const nested = this.declaresNestedScope(tag);
    const open = !tag.selfClose && !VOID.has(tag.name);
    if (open) this.stack.push(tag.name);
    if (skipping) return false;
    if (nested) {
      if (open) this.skipBelow = this.stack.length;
      return false;
    }
    return true;
  }
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
  const imports = astroImports(file, front);
  const walk = new ScopeWalk(isPage);
  for (const tag of tags(body)) {
    if (!walk.visit(tag)) continue;
    addCalls(tag, out);
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
