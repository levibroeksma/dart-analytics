import type { AimRows } from "./types";

/**
 * Groups `|`-keyed rows into one accumulator per id. `idOf` maps a row's key
 * parts to its group id, or `null` to skip the row; `add` folds a row's
 * fields into its group. Groups keep first-seen order.
 */
export function tallyRows<T>(
  rows: AimRows,
  idOf: (parts: string[]) => string | null,
  blank: (id: string) => T,
  add: (group: T, parts: string[], fields: Record<string, number>) => void,
): T[] {
  const groups = new Map<string, T>();
  for (const [key, fields] of Object.entries(rows)) {
    const parts = key.split("|");
    const id = idOf(parts);
    if (id === null) continue;
    const group = groups.get(id) ?? blank(id);
    groups.set(id, group);
    add(group, parts, fields);
  }
  return [...groups.values()];
}

/** Sum of `pick` over `items`. */
export function sumBy<T>(
  items: readonly T[],
  pick: (item: T) => number,
): number {
  return items.reduce((total, item) => total + pick(item), 0);
}
