/**
 * Read design-side tokens from the Design System artifact's `tokens.json`
 * (format: artifact-type/reference/format.md) as the same `var:` items the
 * CSS parser yields for `global.css`, and tell which code values the format
 * cannot hold.
 * Spec: docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md
 */
import { normaliseCss, type ParsedToken } from "./tokens";

interface JsonToken {
  name: string;
  value: unknown;
}

interface JsonFamily {
  themes?: { id: string }[];
  tokens?: JsonToken[];
}

const ALIAS = /^\{([A-Za-z0-9][A-Za-z0-9_.-]*)\}$/;
const FUNCTIONS = /\b(var|color-mix|calc|url)\(|-gradient\(/i;
const PURE_ALIAS = /^var\(--([A-Za-z0-9][A-Za-z0-9_.-]*)\)$/;
const NAMED_COLOURS = new Set(
  (
    "transparent currentcolor aliceblue antiquewhite aqua aquamarine azure beige bisque black " +
    "blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral " +
    "cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen " +
    "darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon " +
    "darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink " +
    "deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro " +
    "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo " +
    "ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen " +
    "lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen " +
    "magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid " +
    "palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum " +
    "powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown " +
    "seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen " +
    "steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen"
  ).split(" "),
);

function varToken(name: string, raw: string): ParsedToken {
  const alias = ALIAS.exec(raw.trim());
  const value = alias ? `var(--${alias[1]})` : raw;
  return {
    id: `var:--${name}`,
    kind: "var",
    name: `--${name}`,
    value: normaliseCss(value),
  };
}

function firstThemeValue(value: unknown, theme: string | undefined): unknown {
  if (value === null || typeof value !== "object") return value;
  const map = value as Record<string, unknown>;
  return theme !== undefined && theme in map
    ? map[theme]
    : Object.values(map)[0];
}

/**
 * Parse `tokens.json` into `var:` tokens: every `{tokens:[…]}` family by
 * name, theme maps by their first theme, `{alias}` as `var(--alias)`, and
 * `type.families` as `--font-<key>`. Type styles are skipped.
 *
 * @param text - The file's text.
 * @returns Tokens in file order.
 */
export function parseTokensJson(text: string): ParsedToken[] {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`tokens.json: ${(error as Error).message}`);
  }
  const out: ParsedToken[] = [];
  for (const [key, raw] of Object.entries(doc)) {
    if (raw === null || typeof raw !== "object") continue;
    if (key === "type") {
      const families = (raw as { families?: Record<string, unknown> }).families;
      for (const [k, v] of Object.entries(families ?? {})) {
        if (typeof v === "string") out.push(varToken(`font-${k}`, v));
      }
      continue;
    }
    const family = raw as JsonFamily;
    if (!Array.isArray(family.tokens)) continue;
    const theme = family.themes?.[0]?.id;
    for (const token of family.tokens) {
      const value = firstThemeValue(token.value, theme);
      if (typeof token.name === "string" && typeof value === "string") {
        out.push(varToken(token.name, value));
      }
    }
  }
  return out;
}

/**
 * Set token values in `tokens.json`, keeping every other key, entry order and
 * `usage` text. A theme map gets its first theme's value replaced only.
 *
 * @param text - The file's text.
 * @param updates - New values by custom property (`--name`).
 * @returns The file's new text, 2-space JSON, trailing newline as before.
 */
export function writeTokensJson(
  text: string,
  updates: Record<string, string>,
): string {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`tokens.json: ${(error as Error).message}`);
  }
  for (const [prop, raw] of Object.entries(updates)) {
    const name = prop.replace(/^--/, "");
    const alias = PURE_ALIAS.exec(raw.trim());
    const value = alias ? `{${alias[1]}}` : raw;
    if (!setValue(doc, name, value)) {
      throw new Error(`tokens.json: no token ${name}`);
    }
  }
  const out = JSON.stringify(doc, null, 2);
  return text.endsWith("\n") ? `${out}\n` : out;
}

function setValue(
  doc: Record<string, unknown>,
  name: string,
  value: string,
): boolean {
  for (const [key, raw] of Object.entries(doc)) {
    if (raw === null || typeof raw !== "object") continue;
    if (key === "type") {
      const families = (raw as { families?: Record<string, unknown> }).families;
      const fontKey = name.replace(/^font-/, "");
      if (name.startsWith("font-") && families && fontKey in families) {
        families[fontKey] = value;
        return true;
      }
      continue;
    }
    const family = raw as JsonFamily;
    const token = family.tokens?.find((t) => t.name === name);
    if (!token) continue;
    if (token.value !== null && typeof token.value === "object") {
      const map = token.value as Record<string, unknown>;
      const theme = family.themes?.[0]?.id;
      const target =
        theme !== undefined && theme in map ? theme : Object.keys(map)[0];
      map[target] = value;
    } else {
      token.value = value;
    }
    return true;
  }
  return false;
}

/**
 * Whether `tokens.json` can hold a code value: a plain `var(--x)` alias, or a
 * value with no `var()`, `color-mix()`, `calc()`, `url()` or gradient that
 * is not a named colour.
 *
 * @param value - A normalised CSS value.
 * @returns False when the artifact's format would drop the value.
 */
export function representable(value: string): boolean {
  if (PURE_ALIAS.test(value.trim())) return true;
  if (FUNCTIONS.test(value)) return false;
  return !NAMED_COLOURS.has(value.trim().toLowerCase());
}
