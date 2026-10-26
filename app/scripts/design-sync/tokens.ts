/**
 * Parse design-system tokens out of CSS for the Claude Design sync.
 * Reads custom properties (:root, @theme), single-class rules / @utility and
 * @keyframes from either side, so both are compared by id + normalised value.
 * Spec: docs/superpowers/specs/2026-10-26-design-system-sync-design.md
 * Decision: D498
 */

export type TokenKind = "var" | "rule" | "keyframes";

export interface ParsedToken {
  id: string;
  kind: TokenKind;
  name: string;
  value: string;
}

type Context = "top" | "vars" | "skip";

interface Statement {
  type: "decl";
  text: string;
}

interface Block {
  type: "block";
  prelude: string;
  body: string;
}

const SINGLE_CLASS = /^\.([a-z0-9_-]+)$/i;
const PASSTHROUGH = /^var\(--([a-z0-9_-]+)\)$/i;

/**
 * Normalise a CSS value or declaration so formatting-only differences vanish.
 *
 * @param value - Raw CSS text.
 * @returns Lower-cased text with collapsed whitespace and no trailing `;`.
 */
export function normaliseCss(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;+\s*$/, "")
    .trim()
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*:\s*/g, ": ")
    .toLowerCase();
}

/**
 * Split CSS text into top-level declarations and blocks, honouring quotes
 * and parentheses so `url(data:…;…)` and `content: "{"` stay intact.
 */
function split(css: string): (Statement | Block)[] {
  const out: (Statement | Block)[] = [];
  let buf = "";
  let quote: string | null = null;
  let parens = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      buf += ch;
      if (ch === "\\") buf += css[++i] ?? "";
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") parens++;
    else if (ch === ")") parens = Math.max(0, parens - 1);
    if (parens === 0 && ch === ";") {
      if (buf.trim()) out.push({ type: "decl", text: buf.trim() });
      buf = "";
      continue;
    }
    if (parens === 0 && ch === "{") {
      const end = matchBrace(css, i);
      out.push({
        type: "block",
        prelude: buf.trim(),
        body: css.slice(i + 1, end),
      });
      buf = "";
      i = end;
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push({ type: "decl", text: buf.trim() });
  return out;
}

function matchBrace(css: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return i;
  }
  return css.length;
}

/** Normalised rule body: sorted declarations, then nested blocks in order. */
function normaliseBody(body: string): string {
  const parts = split(body);
  const decls = parts
    .filter((p): p is Statement => p.type === "decl")
    .map((p) => normaliseCss(p.text))
    .sort();
  const blocks = parts
    .filter((p): p is Block => p.type === "block")
    .map((p) => `${normaliseCss(p.prelude)}{${normaliseBody(p.body)}}`);
  return [...decls, ...blocks].join("; ");
}

function walk(css: string, ctx: Context, out: ParsedToken[]): void {
  for (const part of split(css)) {
    if (part.type === "decl") {
      if (ctx !== "vars" || !part.text.startsWith("--")) continue;
      const colon = part.text.indexOf(":");
      if (colon < 0) continue;
      const name = part.text.slice(0, colon).trim();
      const value = normaliseCss(part.text.slice(colon + 1));
      const ref = PASSTHROUGH.exec(value);
      if (ref && name.endsWith(`-${ref[1]}`)) continue;
      out.push({ id: `var:${name}`, kind: "var", name, value });
      continue;
    }
    const prelude = part.prelude.replace(/\s+/g, " ");
    const keyframes = /^@keyframes ([\w-]+)$/i.exec(prelude);
    if (keyframes) {
      out.push({
        id: `keyframes:${keyframes[1]}`,
        kind: "keyframes",
        name: keyframes[1],
        value: normaliseBody(part.body),
      });
      continue;
    }
    if (ctx !== "top") continue;
    const utility = /^@utility ([\w-]+)$/i.exec(prelude);
    const cls = SINGLE_CLASS.exec(prelude);
    const ruleName = utility?.[1] ?? cls?.[1];
    if (ruleName) {
      out.push({
        id: `rule:${ruleName}`,
        kind: "rule",
        name: ruleName,
        value: normaliseBody(part.body),
      });
    } else if (prelude === ":root" || prelude.startsWith("@theme")) {
      walk(part.body, "vars", out);
    } else if (prelude.startsWith("@layer base")) {
      continue;
    } else if (/^@(layer|media|supports)\b/.test(prelude)) {
      walk(part.body, "top", out);
    }
  }
}

/**
 * Parse every comparable token out of a stylesheet.
 *
 * @param css - Stylesheet text (global.css or a design tokens file).
 * @returns Tokens in source order; a later duplicate id replaces an earlier one.
 */
export function parseTokens(css: string): ParsedToken[] {
  const out: ParsedToken[] = [];
  walk(css.replace(/\/\*[\s\S]*?\*\//g, ""), "top", out);
  const byId = new Map<string, ParsedToken>();
  for (const t of out) {
    byId.delete(t.id);
    byId.set(t.id, t);
  }
  return [...byId.values()];
}
