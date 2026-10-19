/**
 * Pure parsers for the tag vocabulary (docs/game-rules/TAGS.md) and the
 * `## Tags` section of a rules file. No fs here: the CLI reads the files.
 *
 * Mirrors the shape invariants of scripts/check-game-rules.sh (check_tags) so
 * the bash and TS parsers cannot disagree silently: a breach throws.
 */

export type Rule = "primary" | "one" | "many";
export type ContextKey = "STANDALONE" | "ROUTINE_STEP";

export type Scope = "all" | "game-standalone";
/** Which rules-file shape a block belongs to (bash derives it from the folder). */
export type Kind = "game" | "exercise";

export type Axis = {
  key: string;
  name: string;
  rule: Rule;
  exclusive: string | null;
  scope: Scope;
  values: { key: string; name: string }[];
};
export type TagRef = { axis: string; key: string; primary: boolean };
export type TagBlock = {
  context: ContextKey;
  tags: TagRef[];
  difficultyLabels: { key: string; label: string | null }[];
};

export function axisKeyFromName(name: string): string {
  return name.trim().toUpperCase().replace(/\s+/g, "_");
}

function isSeparator(line: string): boolean {
  return /^\|[\s:-]*-+/.test(line);
}

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** Body rows of the first table in `lines`, header and separator dropped. */
function tableRows(lines: string[]): string[][] {
  const rows: string[][] = [];
  let header = false;
  for (const line of lines) {
    if (!line.startsWith("|") || isSeparator(line)) continue;
    if (!header) {
      header = true;
      continue;
    }
    rows.push(cells(line));
  }
  return rows;
}

/** Split markdown into `## ` sections: heading text -> body lines. */
function sections(md: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let current: string[] | null = null;
  for (const line of md.split(/\r?\n/)) {
    const m = /^## (.*\S)\s*$/.exec(line);
    if (m) {
      current = [];
      out.set(m[1], current);
    } else if (current) {
      current.push(line);
    }
  }
  return out;
}

export function parseVocabulary(md: string): Axis[] {
  const secs = sections(md);
  const axesTable = secs.get("Axes");
  if (!axesTable) throw new Error("TAGS.md: no ## Axes section");
  const axes: Axis[] = [];
  for (const row of tableRows(axesTable)) {
    const [name, rule, exclusive, scope] = row;
    if (scope !== "all" && scope !== "game-standalone") {
      throw new Error(`TAGS.md: axis "${name}" has unknown scope "${scope}"`);
    }
    if (rule !== "primary" && rule !== "one" && rule !== "many") {
      throw new Error(`TAGS.md: axis "${name}" has unknown rule "${rule}"`);
    }
    const body = secs.get(name);
    if (!body) throw new Error(`TAGS.md: no ## ${name} section`);
    const values = tableRows(body).map((r) => ({ key: r[0], name: r[1] }));
    if (values.length === 0) throw new Error(`TAGS.md: ${name} has no values`);
    axes.push({
      key: axisKeyFromName(name),
      name,
      rule,
      exclusive: exclusive && exclusive !== "—" ? exclusive : null,
      scope,
      values,
    });
  }
  if (axes.length === 0) throw new Error("TAGS.md: no axes parsed");
  return axes;
}

function parseTable(
  where: string,
  context: ContextKey,
  lines: string[],
  gameRoutine: boolean,
): TagBlock {
  const tags: TagRef[] = [];
  const difficultyLabels: TagBlock["difficultyLabels"] = [];
  const seenAxes = new Set<string>();
  for (const [axisName, rawValues = ""] of tableRows(lines)) {
    const axis = axisKeyFromName(axisName);
    if (seenAxes.has(axis))
      throw new Error(`${where}: axis "${axisName}" appears twice`);
    seenAxes.add(axis);
    const parts = rawValues.split(",").map((p) => p.trim());
    const labelledDifficulty =
      axis === "DIFFICULTY" && parts.length > 1 && gameRoutine;
    parts.forEach((part, i) => {
      const m = /^(.*?)\s*\(([^)]*)\)$/.exec(part);
      const key = (m ? m[1] : part).trim();
      let label = m ? m[2].trim() : null;
      if (key === "") throw new Error(`${where}: empty value in "${axisName}"`);
      let primary = false;
      if (label === "primary") {
        primary = true;
        label = null;
        if (i !== 0)
          throw new Error(`${where}: the primary ${axisName} must come first`);
      }
      if (axis === "DIFFICULTY") {
        if (labelledDifficulty && label === null) {
          throw new Error(
            `${where}: "${key}" needs a preset label, e.g. "${key} (3 darts)"`,
          );
        }
        if (!labelledDifficulty && label !== null) {
          throw new Error(
            `${where}: unexpected label "(${label})" on "${key}"`,
          );
        }
        difficultyLabels.push({ key, label });
      } else if (label !== null) {
        throw new Error(`${where}: unexpected label "(${label})" on "${key}"`);
      }
      tags.push({ axis, key, primary });
    });
  }
  return { context, tags, difficultyLabels };
}

/**
 * Check a block against the vocabulary: known axes and values, TAGS.md order,
 * one primary Skill, exactly one Difficulty (several labelled values allowed
 * in a ROUTINE_STEP block), exactly one Family in STANDALONE and none in
 * ROUTINE_STEP, exclusive values not combined. Throws on a breach.
 */
export function validateBlock(
  block: TagBlock,
  axes: Axis[],
  where: string,
  kind: Kind = "game",
): void {
  const byKey = new Map(axes.map((a) => [a.key, a]));
  // Same rule as check-game-rules.sh `wants`: game-standalone axes only in a
  // game's standalone (or flat) table. Several values on a `one` axis only in
  // a game's `### Routine step` block, never in an exercise's flat table.
  const gameRoutine = kind === "game" && block.context === "ROUTINE_STEP";
  const inScope = (a: Axis) =>
    a.scope === "all" ||
    (a.scope === "game-standalone" &&
      kind === "game" &&
      block.context === "STANDALONE");
  const wanted = axes.filter(inScope);
  const grouped = new Map<string, TagRef[]>();
  for (const t of block.tags) {
    const axis = byKey.get(t.axis);
    if (!axis) throw new Error(`${where}: unknown axis "${t.axis}"`);
    if (!inScope(axis)) {
      throw new Error(`${where}: axis "${axis.name}" is not allowed here`);
    }
    if (!axis.values.some((v) => v.key === t.key)) {
      throw new Error(
        `${where}: "${t.key}" is not a ${axis.name} value in TAGS.md`,
      );
    }
    const list = grouped.get(t.axis) ?? [];
    if (list.some((x) => x.key === t.key)) {
      throw new Error(`${where}: "${t.key}" listed twice in "${axis.name}"`);
    }
    list.push(t);
    grouped.set(t.axis, list);
  }
  const present = [...new Set(block.tags.map((t) => t.axis))];
  const expected = wanted.map((a) => a.key).filter((k) => grouped.has(k));
  if (present.join() !== expected.join()) {
    throw new Error(`${where}: axes are out of order (TAGS.md order)`);
  }
  for (const axis of wanted) {
    const list = grouped.get(axis.key);
    if (!list) throw new Error(`${where}: missing axis "${axis.name}"`);
    const primaries = list.filter((t) => t.primary);
    if (axis.rule === "primary") {
      if (primaries.length !== 1) {
        throw new Error(
          `${where}: ${axis.name} needs exactly one (primary) value, found ${primaries.length}`,
        );
      }
      if (!list[0].primary)
        throw new Error(`${where}: the primary ${axis.name} must come first`);
    } else if (primaries.length > 0) {
      throw new Error(`${where}: unexpected primary on ${axis.name}`);
    }
    if (axis.rule === "one" && list.length > 1) {
      if (!gameRoutine) {
        throw new Error(`${where}: ${axis.name} takes exactly one value`);
      }
    }
    if (
      axis.exclusive &&
      list.length > 1 &&
      list.some((t) => t.key === axis.exclusive)
    ) {
      throw new Error(
        `${where}: ${axis.exclusive} cannot be combined with another ${axis.name} value`,
      );
    }
  }
}

/**
 * Parse a rules file. Pass `axes` to also validate each block against the
 * vocabulary (the CLI always does).
 */
export function parseRulesFile(
  md: string,
  axes?: Axis[],
): {
  gameTypeKey: string | null;
  exerciseTypeKey: string | null;
  blocks: TagBlock[];
} {
  const gameTypeKey = /^Game type: `([A-Z0-9_]+)`\s*$/m.exec(md)?.[1] ?? null;
  const exerciseTypeKey =
    /^- Type constant: `([A-Z0-9_]+)`/m.exec(md)?.[1] ?? null;
  const lines = sections(md).get("Tags");
  const blocks: TagBlock[] = [];
  const kind: Kind = exerciseTypeKey && !gameTypeKey ? "exercise" : "game";
  if (lines) {
    // An exercise's one flat table is its routine-step context; a flat game table is standalone.
    const flatContext: ContextKey =
      exerciseTypeKey && !gameTypeKey ? "ROUTINE_STEP" : "STANDALONE";
    const groups: { name: string | null; lines: string[] }[] = [
      { name: null, lines: [] },
    ];
    for (const line of lines) {
      const m = /^### (.*\S)\s*$/.exec(line);
      if (m) groups.push({ name: m[1], lines: [] });
      else groups[groups.length - 1].lines.push(line);
    }
    const seen = new Set<string>();
    if (groups.length > 1 && groups[0].lines.some((l) => l.startsWith("|"))) {
      throw new Error(
        "Tags: a table sits outside the ### Standalone / ### Routine step subsections",
      );
    }
    for (const g of groups) {
      if (g.name === null && !g.lines.some((l) => l.startsWith("|"))) continue;
      let context: ContextKey = flatContext;
      if (g.name !== null) {
        if (kind === "exercise") {
          throw new Error(
            "Tags: an exercise has one flat table, no subsections",
          );
        }
        if (g.name === "Standalone") context = "STANDALONE";
        else if (g.name === "Routine step") context = "ROUTINE_STEP";
        else throw new Error(`Tags: unknown subsection "### ${g.name}"`);
        if (seen.has(g.name))
          throw new Error(`Tags: duplicate subsection "### ${g.name}"`);
        seen.add(g.name);
      }
      const where = g.name ? `Tags (${g.name})` : "Tags";
      const block = parseTable(
        where,
        context,
        g.lines,
        kind === "game" && g.name === "Routine step",
      );
      if (axes) validateBlock(block, axes, where, kind);
      blocks.push(block);
    }
    if (kind === "game" && blocks.length > 0) {
      const routine = /^Entry points:.*routine step/m.test(md);
      if (routine && !(seen.has("Standalone") && seen.has("Routine step"))) {
        throw new Error(
          "Tags: Entry points include routine step, so Tags needs ### Standalone and ### Routine step",
        );
      }
      if (!routine && seen.size > 0) {
        throw new Error(
          "Tags: subsections are only for a game whose Entry points include routine step",
        );
      }
    }
  }
  return { gameTypeKey, exerciseTypeKey, blocks };
}
