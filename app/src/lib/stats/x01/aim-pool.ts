import type { AimRows } from "./types";

/** Adds `fields` into `target`, field by field. */
export function addFields(
  target: Record<string, number>,
  fields: Record<string, number>,
): void {
  for (const [field, value] of Object.entries(fields))
    target[field] = (target[field] ?? 0) + value;
}

/** Rows whose key passes `matches`, summed field-wise into one row. */
export function poolRows(
  rows: AimRows,
  matches: (key: string) => boolean,
): Record<string, number> {
  const pooled: Record<string, number> = {};
  for (const [key, fields] of Object.entries(rows))
    if (matches(key)) addFields(pooled, fields);
  return pooled;
}
