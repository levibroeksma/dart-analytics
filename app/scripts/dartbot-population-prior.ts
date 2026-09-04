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
    fileURLToPath(new URL("../../D-E-extract.json", import.meta.url));
  const extractRows = JSON.parse(readFileSync(path, "utf8")) as ExtractRow[];
  const prior = foldPopulationPrior(toMissMarginInputs(extractRows));
  console.log(JSON.stringify(prior, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
