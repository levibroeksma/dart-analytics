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

type Context = "top" | "vars";

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
const QUOTED = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g;
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
 * Blank out quoted strings and parenthesised text (same length), so `;`, `{`
 * and `}` inside `url(data:…;…)` or `content: "{"` are not structural.
 */
function mask(css: string): string {
  const unquoted = css.replace(QUOTED, (m) => " ".repeat(m.length));
  let out = "";
  let parens = 0;
  for (let i = 0; i < unquoted.length; i++) {
    const ch = unquoted[i];
    const inside = parens > 0;
    if (ch === "(") parens++;
    else if (ch === ")") parens = Math.max(0, parens - 1);
    out += inside ? " " : ch;
  }
  return out;
}

function matchBrace(masked: string, open: number): number {
  let depth = 0;
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++;
    else if (masked[i] === "}" && --depth === 0) return i;
  }
  return masked.length;
}

/** Split CSS text into top-level declarations and blocks. */
function split(css: string): (Statement | Block)[] {
  const masked = mask(css);
  const out: (Statement | Block)[] = [];
  let start = 0;
  const pushDecl = (end: number): void => {
    const text = css.slice(start, end).trim();
    if (text) out.push({ type: "decl", text });
  };
  for (let i = 0; i < masked.length; i++) {
    if (masked[i] === ";") {
      pushDecl(i);
      start = i + 1;
    } else if (masked[i] === "{") {
      const end = matchBrace(masked, i);
      out.push({
        type: "block",
        prelude: css.slice(start, i).trim(),
        body: css.slice(i + 1, end),
      });
      i = end;
      start = end + 1;
    }
  }
  pushDecl(css.length);
  return out;
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

/** A custom property declaration as a token, or null for a passthrough alias. */
function varToken(text: string): ParsedToken | null {
  const colon = text.indexOf(":");
  if (!text.startsWith("--") || colon < 0) return null;
  const name = text.slice(0, colon).trim();
  const value = normaliseCss(text.slice(colon + 1));
  const ref = PASSTHROUGH.exec(value);
  if (ref && name.endsWith(`-${ref[1]}`)) return null;
  return { id: `var:${name}`, kind: "var", name, value };
}

function bodyToken(kind: TokenKind, name: string, body: string): ParsedToken {
  return { id: `${kind}:${name}`, kind, name, value: normaliseBody(body) };
}

/** Context a nested block is walked in, or null to skip it. */
function nestedContext(prelude: string): Context | null {
  if (prelude === ":root" || prelude.startsWith("@theme")) return "vars";
  if (prelude.startsWith("@layer base")) return null;
  return /^@(layer|media|supports)\b/.test(prelude) ? "top" : null;
}

function blockTokens(block: Block, ctx: Context, out: ParsedToken[]): void {
  const prelude = block.prelude.replace(/\s+/g, " ");
  const keyframes = /^@keyframes ([\w-]+)$/i.exec(prelude);
  if (keyframes) {
    out.push(bodyToken("keyframes", keyframes[1], block.body));
    return;
  }
  if (ctx !== "top") return;
  const rule =
    /^@utility ([\w-]+)$/i.exec(prelude)?.[1] ??
    SINGLE_CLASS.exec(prelude)?.[1];
  if (rule) {
    out.push(bodyToken("rule", rule, block.body));
    return;
  }
  const next = nestedContext(prelude);
  if (next) walk(block.body, next, out);
}

function walk(css: string, ctx: Context, out: ParsedToken[]): void {
  for (const part of split(css)) {
    if (part.type === "block") blockTokens(part, ctx, out);
    else if (ctx === "vars") {
      const token = varToken(part.text);
      if (token) out.push(token);
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
