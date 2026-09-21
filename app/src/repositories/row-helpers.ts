/**
 * Narrows one `<view>.<column>` select result from Drizzle's introspected
 * `T | null` to `T`. `drizzle-kit introspect` types every view column
 * nullable regardless of the underlying constraint (Postgres reports no
 * `NOT NULL` on a view), so a column a repository's row interface declares
 * non-null still needs narrowing to satisfy the compiler — this makes that
 * narrowing a checked, per-column runtime assertion instead of a blanket
 * `as <Interface>Row[]` cast over the whole select, which silences every
 * column at once, real type mismatches included (issue #539).
 */
export function nonNull<T>(value: T | null, column: string): T {
  if (value === null) {
    throw new Error(`expected view column "${column}" to be non-null`);
  }
  return value;
}
