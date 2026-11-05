/**
 * Pair and hash icon and brand assets for the Claude Design sync.
 * Design `assets/icons/**` ↔ `app/src/icons/**`; design `assets/brand/*` ↔
 * `app/src/assets/*` or `app/public/*` by basename. SVGs are hashed after
 * normalisation, everything else raw.
 * Spec: docs/superpowers/specs/2026-10-26-design-system-sync-design.md
 * Decision: D499
 */
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { listFiles } from "./files";
import { sha256, type Side, type SyncItem } from "./lock";

const TAG =
  /<([a-zA-Z][\w:.-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTR = /([^\s=>/]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const HEX = /#[0-9a-f]{3,8}\b/gi;
const C2PA_METADATA =
  /<metadata>\s*<c2pa:manifest>[\s\S]*?<\/c2pa:manifest>\s*<\/metadata>/g;
const WHITESPACE_REF = /&#(?:x0*(?:9|a|d|20)|0*(?:9|10|13|32));/gi;
const EMPTY_PAIR = /<([a-zA-Z][\w:.-]*)([^<>]*?)><\/\1>/g;
const CODE_BRAND_DIRS = ["app/src/assets", "app/public"];
const BRAND_EXT = /\.(svg|png)$/i;
const DESIGN_EXT = /\.svg$/i;

/**
 * Canonicalise SVG markup so formatting-only differences hash the same.
 *
 * @param svg - SVG source.
 * @returns Markup without prologue/comments/c2pa provenance, sorted attributes,
 *   no inter-tag whitespace, empty pairs self-closed.
 */
export function normaliseSvg(svg: string): string {
  return svg
    .replace(/\r\n?/g, "\n")
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(C2PA_METADATA, "")
    .replace(
      />([^<]*)</g,
      (_m, text: string) => `>${text.replace(WHITESPACE_REF, " ")}<`,
    )
    .replace(TAG, (_m, name: string, attrs: string, selfClose: string) => {
      const pairs = [...attrs.matchAll(ATTR)]
        .filter(([, key]) => key !== "xmlns:c2pa")
        .map(
          ([, key, dq, sq]) =>
            `${key}="${(dq ?? sq)
              .replace(/\s+/g, " ")
              .replace(HEX, (hex) => hex.toLowerCase())
              .trim()}"`,
        )
        .sort();
      return `<${[name, ...pairs].join(" ")}${selfClose ? "/" : ""}>`;
    })
    .replace(/>\s+</g, "><")
    .replace(EMPTY_PAIR, "<$1$2/>")
    .trim();
}

function side(root: string, rel: string): Side {
  const bytes = readFileSync(join(root, rel));
  const hash = rel.toLowerCase().endsWith(".svg")
    ? sha256(normaliseSvg(bytes.toString("utf8")))
    : sha256(bytes);
  return { path: rel, hash };
}

/**
 * Build sync items for every icon and brand asset on either side.
 *
 * @param designRoot - Mirror directory holding the remote `assets/` tree.
 * @param repoRoot - Repository root (parent of `app/`).
 * @returns One comparable item per asset id.
 */
export function assetItems(designRoot: string, repoRoot: string): SyncItem[] {
  const items = new Map<string, SyncItem>();
  const item = (id: string): SyncItem => {
    const existing = items.get(id);
    if (existing) return existing;
    const created: SyncItem = {
      id,
      area: "assets",
      design: null,
      code: null,
      comparable: true,
    };
    items.set(id, created);
    return created;
  };

  for (const rel of listFiles(join(designRoot, "assets/icons"))) {
    if (!DESIGN_EXT.test(rel)) continue;
    item(`icon:${rel}`).design = side(designRoot, `assets/icons/${rel}`);
  }
  for (const rel of listFiles(join(repoRoot, "app/src/icons"))) {
    item(`icon:${rel}`).code = side(repoRoot, `app/src/icons/${rel}`);
  }
  for (const rel of listFiles(join(designRoot, "assets/brand"), false)) {
    if (!DESIGN_EXT.test(rel)) continue;
    item(`brand:${rel}`).design = side(designRoot, `assets/brand/${rel}`);
  }
  for (const dir of CODE_BRAND_DIRS) {
    for (const rel of listFiles(join(repoRoot, dir), false)) {
      if (!BRAND_EXT.test(rel)) continue;
      const target = item(`brand:${basename(rel)}`);
      target.code ??= side(repoRoot, `${dir}/${rel}`);
    }
  }
  return [...items.values()].sort((a, b) => a.id.localeCompare(b.id));
}
