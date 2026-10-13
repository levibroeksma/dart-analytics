import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `BoardInputPanel`'s press ring and `BoardMagnifier` are `position: fixed`
 * and placed from `clientX`/`clientY`. A `filter`, `backdrop-filter`,
 * `transform` (or `will-change`/`contain` of those) on any ancestor makes
 * that ancestor their containing block, so they drift off the finger with
 * every test still green (Style Guide "Pointer-tracked surfaces", D432,
 * #847).
 *
 * This suite walks the real ancestor chain in source: inside the panel down
 * to the overlays, up through every component and page that mounts it
 * (directly or through a component that does), and through the `<slot>` of
 * every wrapping component or layout. Each ancestor's `class` / `:class`
 * tokens must not set any of those properties — Tailwind utilities by
 * pattern, and `global.css` utilities/classes by what their body declares.
 */

const appRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const srcRoot = join(appRoot, "src");

const aliases: Record<string, string> = Object.fromEntries(
  Object.entries(
    (
      JSON.parse(readFileSync(join(appRoot, "tsconfig.json"), "utf8")) as {
        compilerOptions: { paths: Record<string, string[]> };
      }
    ).compilerOptions.paths,
  ).map(([alias, [target]]) => [
    alias.replace(/\*$/, ""),
    join(appRoot, target!.replace(/\*$/, "")),
  ]),
);

interface Tag {
  name: string;
  source: string;
}

interface Hit {
  file: string;
  ancestors: Tag[];
}

function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(path);
    return entry.name.endsWith(".astro") ? [path] : [];
  });
}

function splitAstro(source: string): { frontmatter: string; template: string } {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { frontmatter: "", template: source };
  return {
    frontmatter: match[1]!,
    template: source.slice(match[0].length),
  };
}

/** Component name → resolved file, from the frontmatter's `.astro` imports. */
function imports(file: string, frontmatter: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const [, name, spec] of frontmatter.matchAll(
    /import\s+(\w+)\s+from\s+["']([^"']+\.astro)["']/g,
  )) {
    const alias = Object.keys(aliases).find((key) => spec!.startsWith(key));
    const path = alias
      ? join(aliases[alias]!, spec!.slice(alias.length))
      : join(dirname(file), spec!);
    map.set(name!, path);
  }
  return map;
}

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/**
 * A comment, a closing tag, or a whole opening tag. Attribute values are
 * matched as quoted strings or (two-level) brace expressions, so an Alpine
 * `=>` or `>` never ends a tag early.
 */
const tagPattern =
  /<!--[\s\S]*?-->|<\/([\w.:-]+)\s*>|<([A-Za-z][\w.:-]*)(?:"[^"]*"|'[^']*'|`[^`]*`|\{(?:[^{}]|\{[^{}]*\})*\}|[^"'`{}>])*>/g;

interface Entry {
  tag: Tag;
  ancestors: Tag[];
}

function closeTag(stack: Tag[], name: string): void {
  const at = stack.map((tag) => tag.name).lastIndexOf(name);
  if (at !== -1) stack.length = at;
}

function openTag(out: Entry[], stack: Tag[], tag: Tag): void {
  out.push({ tag, ancestors: [...stack] });
  const selfClosing =
    tag.source.endsWith("/>") || voidElements.has(tag.name.toLowerCase());
  if (!selfClosing) stack.push(tag);
}

/** Every opening tag in `template` with the stack of still-open tags above it. */
function walkTags(template: string): Entry[] {
  const out: Entry[] = [];
  const stack: Tag[] = [];
  for (const [source, closing, name] of template.matchAll(tagPattern)) {
    if (closing) closeTag(stack, closing);
    else if (name) openTag(out, stack, { name, source });
  }
  return out;
}

/** The string literals of one `class` / `:class` value. */
function literals(value: string): string[] {
  if (!value.startsWith('"')) {
    return [...value.matchAll(/["'`]([^"'`]*)["'`]/g)].map((m) => m[1]!);
  }
  if (!value.includes("'")) return [value.slice(1, -1)];
  return [...value.matchAll(/'([^']*)'/g)].map((m) => m[1]!);
}

/** The class tokens of an opening tag's `class` / `:class` values, variants stripped. */
function classTokens(tag: Tag): string[] {
  return [
    ...tag.source.matchAll(
      /(?:^|\s):?class(?::list)?=("[^"]*"|\{[\s\S]*?\}(?=\s|\/?>))/g,
    ),
  ]
    .flatMap((match) => literals(match[1]!))
    .join(" ")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.split(":").pop()!);
}

const tailwindForbidden = [
  /^-?(translate|rotate|scale|skew)(-|$)/,
  /^transform(-gpu|-cpu)?$/,
  /^(filter|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia)(-|$)/,
  /^backdrop-/,
  /^will-change-(transform|filter)/,
  /^contain-(paint|layout|strict|content)$/,
];

function tailwindBanned(token: string): boolean {
  return tailwindForbidden.some((pattern) => pattern.test(token));
}

/** Each `global.css` utility or simple class with its concatenated bodies. */
function cssBodies(): Map<string, string> {
  const css = readFileSync(join(srcRoot, "styles/global.css"), "utf8");
  const bodies = new Map<string, string>();
  for (const [, name, body] of css.matchAll(
    /(?:@utility\s+|^\s*\.)([\w-]+)\s*\{([^}]*)\}/gm,
  )) {
    bodies.set(name!, (bodies.get(name!) ?? "") + body!);
  }
  return bodies;
}

function setsContainingBlock(body: string, banned: Set<string>): boolean {
  if (
    /(^|[\s;])(backdrop-filter|filter|transform|will-change|contain)\s*:/.test(
      body,
    )
  ) {
    return true;
  }
  const applied = (/@apply\s+([^;]*);/.exec(body)?.[1] ?? "").split(/\s+/);
  return applied.some((token) => banned.has(token) || tailwindBanned(token));
}

/** `global.css` names that set a containing-block property, through `@apply` too. */
function cssForbidden(): Set<string> {
  const bodies = cssBodies();
  const banned = new Set<string>();
  let size = -1;
  while (size !== banned.size) {
    size = banned.size;
    for (const [name, body] of bodies) {
      if (setsContainingBlock(body, banned)) banned.add(name);
    }
  }
  return banned;
}

const cssBanned = cssForbidden();

function isForbidden(token: string): boolean {
  return cssBanned.has(token) || tailwindBanned(token);
}

const files = new Map(
  astroFiles(srcRoot).map((file) => {
    const { frontmatter, template } = splitAstro(readFileSync(file, "utf8"));
    return [
      file,
      { imports: imports(file, frontmatter), tags: walkTags(template) },
    ];
  }),
);

const panelFile = join(
  srcRoot,
  "components/layout/games/BoardInputPanel.astro",
);

/** A file whose mounts to follow, or a component's `<slot>` (named or default). */
interface Target {
  kind: "mount" | "slot";
  file: string;
  slot: string | null;
}

function attr(tag: Tag, name: string): string | null {
  return new RegExp(`\\s${name}="([^"]+)"`).exec(tag.source)?.[1] ?? null;
}

/** The slot of every imported component among `ancestors` that the content fills. */
function wrapperSlots(file: string, tag: Tag, ancestors: Tag[]): Target[] {
  const imported = files.get(file)!.imports;
  return ancestors.flatMap((ancestor, index) => {
    const wrapper = imported.get(ancestor.name);
    if (!wrapper) return [];
    const child = ancestors[index + 1] ?? tag;
    return [
      { kind: "slot" as const, file: wrapper, slot: attr(child, "slot") },
    ];
  });
}

function matcher(target: Target): (file: string, tag: Tag) => boolean {
  if (target.kind === "slot") {
    return (file, tag) =>
      file === target.file &&
      tag.name === "slot" &&
      attr(tag, "name") === target.slot;
  }
  return (file, tag) => files.get(file)!.imports.get(tag.name) === target.file;
}

/** The ancestor chains of the ring and magnifier inside the panel itself. */
function panelOverlayHits(): Hit[] {
  return files
    .get(panelFile)!
    .tags.filter(
      ({ tag }) =>
        tag.name === "BoardMagnifier" || classTokens(tag).includes("fixed"),
    )
    .map(({ ancestors }) => ({ file: panelFile, ancestors }));
}

/**
 * Every ancestor chain above the fixed overlays: inside the panel, then each
 * mount of a file that (transitively) contains them, then each wrapping
 * component's `<slot>` chain.
 */
function overlayAncestorChains(): Hit[] {
  const hits = panelOverlayHits();
  const queue: Target[] = [{ kind: "mount", file: panelFile, slot: null }];
  const seen = new Set<string>();
  while (queue.length) {
    const target = queue.shift()!;
    const key = `${target.kind}:${target.file}#${target.slot ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const matches = matcher(target);
    for (const [file, { tags }] of files) {
      for (const { tag, ancestors } of tags.filter((e) =>
        matches(file, e.tag),
      )) {
        hits.push({ file, ancestors });
        queue.push(
          { kind: "mount", file, slot: null },
          ...wrapperSlots(file, tag, ancestors),
        );
      }
    }
  }
  return hits;
}

const chains = overlayAncestorChains();

describe("BoardInputPanel fixed overlays: no containing-block ancestor", () => {
  it("derives the banned global.css surfaces, glass included", () => {
    expect(cssBanned).toContain("glass");
    expect(cssBanned).toContain("input-well");
    expect(cssBanned).toContain("board-dim");
  });

  it("finds the overlays and the pages that mount them", () => {
    const reached = new Set(chains.map((hit) => relative(srcRoot, hit.file)));
    expect(reached).toContain("components/layout/games/BoardInputPanel.astro");
    expect(reached).toContain("layouts/GameLayout.astro");
    expect([...reached].some((file) => file.startsWith("pages/games/"))).toBe(
      true,
    );
    expect(
      [...reached].some((file) => file.startsWith("pages/training/")),
    ).toBe(true);
  });

  it("puts no filter, backdrop-filter or transform class on any ancestor", () => {
    const offenders = chains.flatMap(({ file, ancestors }) =>
      ancestors.flatMap((ancestor) =>
        classTokens(ancestor)
          .filter(isForbidden)
          .map(
            (token) =>
              `${relative(srcRoot, file)}: <${ancestor.name}> carries "${token}"`,
          ),
      ),
    );
    expect([...new Set(offenders)]).toEqual([]);
  });

  it("flags glass on the panel root", () => {
    const [root] = walkTags(
      '<div class="glass relative">\n<span class="fixed"></span></div>',
    );
    expect(classTokens(root!.tag).filter(isForbidden)).toEqual(["glass"]);
  });
});
