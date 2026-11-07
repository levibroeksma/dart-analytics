import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it, expect } from "vitest";

import { FACTORIES, ROUTINE_GAME_FACTORIES } from "./support/factories";

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

/** CSS functions inside `:style` template strings, not Alpine calls. */
const CSS_FUNCTIONS = new Set(["translate", "rotate", "scale", "calc", "var"]);

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
    const inStyle = a.name === ":style";
    for (const c of a.value.matchAll(CALL)) {
      if (JS_GLOBALS.has(c[1]) || (inStyle && CSS_FUNCTIONS.has(c[1])))
        continue;
      out.add(c[1]);
    }
  }
}

type Scope =
  { kind: "own" } | { kind: "skip" } | { kind: "game"; panel: string };

type Calls = { own: Set<string>; nested: Map<string, Set<string>> };

const OWN: Scope = { kind: "own" };
const SKIP: Scope = { kind: "skip" };
const PANEL = /panel === '([\w-]+)'/;

/**
 * Element nesting plus the nested-`x-data` scope state while walking one file. A nested
 * `x-data="game"` is a routine step's game scope, resolved by the enclosing `panel === '…'`
 * template; any other nested `x-data` is a scope the test cannot resolve and is skipped.
 */
class ScopeWalk {
  private stack: string[] = [];
  private scopeBelow = -1; // stack length at which a nested scope ends; -1 = not nested
  private scope: Scope = OWN;
  private panel = "";
  private rootSeen: boolean;
  constructor(private isPage: boolean) {
    this.rootSeen = !isPage;
  }

  private close(tag: Tag): void {
    const at = this.stack.lastIndexOf(tag.name);
    if (at >= 0) this.stack.length = at;
    if (this.scopeBelow >= 0 && this.stack.length < this.scopeBelow) {
      this.scopeBelow = -1;
      this.scope = OWN;
    }
  }

  private declaresNestedScope(tag: Tag): Attr | null {
    const data = tag.attrs.find((a) => a.name === "x-data") ?? null;
    const nested = data !== null && (this.rootSeen || !this.isPage);
    if (data) this.rootSeen = true;
    return nested ? data : null;
  }

  private trackPanel(tag: Tag): void {
    const match = PANEL.exec(
      tag.attrs.find((a) => a.name === "x-if")?.value ?? "",
    );
    if (match) this.panel = match[1];
  }

  /** The scope the tag's attributes and component import belong to; null for a closing tag. */
  visit(tag: Tag): Scope | null {
    if (tag.closing) {
      this.close(tag);
      return null;
    }
    this.trackPanel(tag);
    const inherited = this.scopeBelow >= 0 ? this.scope : null;
    const nested = this.declaresNestedScope(tag);
    const open = !tag.selfClose && !VOID.has(tag.name);
    if (open) this.stack.push(tag.name);
    if (inherited) return inherited;
    if (!nested) return OWN;
    this.scope =
      nested.value === "game" ? { kind: "game", panel: this.panel } : SKIP;
    if (open) this.scopeBelow = this.stack.length;
    return this.scope;
  }
}

/** The call set a tag in `scope` writes to; null when the scope is skipped. */
function callsFor(scope: Scope, out: Calls): Set<string> | null {
  if (scope.kind === "own") return out.own;
  if (scope.kind === "skip") return null;
  const set = out.nested.get(scope.panel) ?? new Set<string>();
  out.nested.set(scope.panel, set);
  return set;
}

/**
 * Alpine call names (`foo(` not `.foo(`) in x-* / @* / :* / *Expr attribute values of a
 * page and every .astro component reached through its imports, split by scope: the page's
 * own, and each routine step's nested `x-data="game"` (keyed by panel). Any other nested
 * `x-data` starts a scope whose attributes, children and component import are skipped.
 */
function collectCalls(
  file: string,
  isPage: boolean,
  seen: Set<string>,
  out: Calls,
  inherited: Scope = OWN,
): void {
  const key = `${JSON.stringify(inherited)}:${file}`;
  if (seen.has(key) || !existsSync(file)) return;
  seen.add(key);
  const { front, body } = splitFrontmatter(readFileSync(file, "utf8"));
  const imports = astroImports(file, front);
  const walk = new ScopeWalk(isPage);
  for (const tag of tags(body)) {
    const own = walk.visit(tag);
    if (!own) continue;
    const scope =
      own.kind === "skip" || inherited.kind === "own" ? own : inherited;
    const calls = callsFor(scope, out);
    if (!calls) continue;
    addCalls(tag, calls);
    const target = imports.get(tag.name);
    if (target) collectCalls(target, false, seen, out, scope);
  }
}

function calledNames(page: string): Calls {
  const out: Calls = { own: new Set(), nested: new Map() };
  collectCalls(page, true, new Set(), out);
  return out;
}

describe("addCalls", () => {
  const tag = (name: string, value: string): Tag => ({
    name: "div",
    attrs: [{ name, value }],
    closing: false,
    selfClose: false,
  });
  const namesIn = (name: string, value: string) => {
    const out = new Set<string>();
    addCalls(tag(name, value), out);
    return [...out];
  };

  it("ignores CSS functions inside :style", () => {
    expect(namesIn(":style", "`translate(${x()}px) scale(1)`")).toEqual(["x"]);
  });

  it("does not ignore a CSS function name in any other attribute", () => {
    expect(namesIn("x-text", "scale()")).toEqual(["scale"]);
    expect(namesIn("@click", "translate()")).toEqual(["translate"]);
  });
});

// Limit: only call syntax (`name(`) is checked. Property reads (`x-text="total"`) and
// dynamic `attr={...}` values are not, so a missing data property goes unnoticed.
describe("page Alpine bindings resolve to factory keys", () => {
  it("finds the pages", () => {
    expect(PAGES.length).toBeGreaterThanOrEqual(30);
  });

  it("scans every routine step's nested game scope", () => {
    const page = PAGES.find((p) => p.endsWith("routines/play/index.astro"));
    const { nested } = calledNames(page!);
    expect([...nested.keys()].sort()).toEqual(
      Object.keys(ROUTINE_GAME_FACTORIES).sort(),
    );
    for (const names of nested.values()) expect(names.size).toBeGreaterThan(0);
  });

  for (const page of PAGES) {
    const rel = page.slice(PAGES_ROOT.length + 1);
    it(rel, () => {
      const source = readFileSync(page, "utf8");
      const factoryName = source.match(/x-data="(\w+)\(\)"/)?.[1];
      expect(factoryName, "root x-data factory").toBeDefined();
      const factory = FACTORIES[factoryName!];
      expect(factory, `factory ${factoryName} registered`).toBeDefined();

      const { own, nested } = calledNames(page);
      expect(own.size, "non-vacuity: page yields call names").toBeGreaterThan(
        0,
      );

      const keys = new Set(Object.keys(factory()));
      const allowed = new Set(PENDING[rel] ?? []);
      const unresolved = [...own].filter(
        (n) => !keys.has(n) && !allowed.has(n),
      );
      expect(unresolved, rel).toEqual([]);

      for (const [panel, names] of nested) {
        const gameFactory = ROUTINE_GAME_FACTORIES[panel];
        expect(gameFactory, `game factory for panel ${panel}`).toBeDefined();
        const scopeKeys = new Set([...keys, ...Object.keys(gameFactory())]);
        const missing = [...names].filter(
          (n) => !scopeKeys.has(n) && !allowed.has(n),
        );
        expect(missing, `${rel} panel ${panel}`).toEqual([]);
      }
    });
  }
});
