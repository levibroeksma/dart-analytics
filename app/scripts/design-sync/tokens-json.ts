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
const FUNCTIONS = /\b(var|color-mix|calc)\(/i;
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
 * Whether `tokens.json` can hold a code value: no `var()`, `color-mix()` or
 * `calc()`, and not a named colour.
 *
 * @param value - A normalised CSS value.
 * @returns False when the artifact's format would drop the value.
 */
export function representable(value: string): boolean {
  if (FUNCTIONS.test(value)) return false;
  return !NAMED_COLOURS.has(value.trim().toLowerCase());
}
