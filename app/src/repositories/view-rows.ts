/**
 * One row of a `v_*` select as Drizzle types it: every column nullable.
 * Postgres reports no `NOT NULL` on a view column, so `drizzle-kit
 * introspect` has nothing to generate a non-null type from and marks all of
 * them optional. A column the interface already types `unknown` (jsonb) is
 * left alone — widening `unknown` says nothing.
 */
type ViewShape<T> = {
  [K in keyof T]: unknown extends T[K] ? unknown : T[K] | null;
};

/**
 * Narrows a view select to its row interface, asserting only the one thing
 * the database cannot state — that these columns are never NULL for the rows
 * the view's own predicates return.
 *
 * Every other claim stays checked. A column Drizzle types differently from
 * the interface (a `numeric` that arrives as a string, a timestamp that
 * arrives as a `Date`, a column dropped from the select) fails to compile at
 * the call site, which the blanket `as <Name>Row[]` it replaces made
 * impossible.
 *
 * It does not check what SQL cannot express: a jsonb's object shape, or a
 * text column the interface restricts to a key union. Those stay per-column
 * assertions at the call site, where the narrowing is visible and named,
 * rather than being folded into one assertion over the whole array.
 */
export function viewRows<T>(rows: ViewShape<T>[]): T[] {
  return rows as T[];
}

/**
 * `viewRows` for a select narrowed to a single row — the `.limit(1)` reads
 * whose interface describes one row rather than a list.
 */
export function viewRow<T>(row: ViewShape<T>): T {
  return row as T;
}
