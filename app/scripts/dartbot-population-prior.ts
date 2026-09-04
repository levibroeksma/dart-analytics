import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { foldPopulationPrior } from "../src/modules/dartbot/population-prior.module";
import type { MissMarginInput } from "../src/lib/types";

type ExtractRow = {
  intended_target_number: number | null;
  intended_zone_key: string | null;
  location_x: number | string | null;
  location_y: number | string | null;
};

/**
 * Reads the last fenced ```json block in a Markdown extract file. An earlier
 * block carrying the raw numeric `intended_zone_id` instead of
 * `intended_zone_key` is not usable by `foldPopulationPrior()` and is
 * skipped (D-E, `08-DartBot.md`).
 */
export function extractRowsFromMarkdown(markdown: string): ExtractRow[] {
  const blocks = [...markdown.matchAll(/```json\n([\s\S]*?)```/g)];
  const last = blocks.at(-1);
  if (!last) {
    throw new Error("No ```json block found in the extract file");
  }
  return JSON.parse(last[1]) as ExtractRow[];
}

export function toMissMarginInputs(
  rows: readonly ExtractRow[],
): MissMarginInput[] {
  return rows.map((row) => ({
    intendedTargetNumber: row.intended_target_number,
    intendedZoneKey:
      row.intended_zone_key as MissMarginInput["intendedZoneKey"],
    locationX: row.location_x === null ? null : Number(row.location_x),
    locationY: row.location_y === null ? null : Number(row.location_y),
  }));
}

function main(): void {
  const path =
    process.argv[2] ??
    fileURLToPath(new URL("../../D-E-extract.md", import.meta.url));
  const markdown = readFileSync(path, "utf8");
  const rows = toMissMarginInputs(extractRowsFromMarkdown(markdown));
  const prior = foldPopulationPrior(rows);
  console.log(JSON.stringify(prior, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
