import { readFileSync, writeFileSync } from "node:fs";

const DECLARATION = /^export const (\w+) = /;

/**
 * Orders drizzle-kit introspect output by name.
 *
 * drizzle-kit emits tables, views and import specifiers in the order Postgres
 * returns them from the catalogs, which is physical row order: the same
 * database yields a different file after `VACUUM FULL` (#404). Sorting makes
 * the committed file a pure function of the schema, so a regeneration only
 * differs from it when the schema does.
 */
export function normalizeSchema(source: string): string {
  const lines = source.split("\n");
  const first = lines.findIndex((line) => DECLARATION.test(line));
  if (first === -1) throw new Error("no `export const` declaration found");

  const header = sortImportSpecifiers(lines.slice(0, first).join("\n"));
  const blocks = new Map<string, string[]>();
  let name = "";
  for (const line of lines.slice(first)) {
    const match = DECLARATION.exec(line);
    if (match) {
      name = match[1];
      if (blocks.has(name)) throw new Error(`duplicate declaration: ${name}`);
      blocks.set(name, []);
    }
    blocks.get(name)?.push(line);
  }

  const body = [...blocks.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, block]) => block.join("\n").trimEnd())
    .join("\n\n");
  return `${header.trimEnd()}\n\n${body}\n`;
}

function sortImportSpecifiers(header: string): string {
  return header.replace(
    /import \{([^}]*)\} from/g,
    (_, specifiers: string) =>
      `import { ${specifiers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .sort()
        .join(", ")} } from`,
  );
}

if (!process.env.VITEST) {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx scripts/normalize-schema.ts <file>");
  writeFileSync(file, normalizeSchema(readFileSync(file, "utf8")));
}
