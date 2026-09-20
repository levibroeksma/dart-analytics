const MAX_CAUSE_DEPTH = 8;

/**
 * Walks a thrown error's `cause` chain looking for a specific Postgres
 * SQLSTATE and constraint/trigger name, however many wrapper layers drizzle
 * or the transaction machinery add. The name is also matched inside
 * `message`, since a deferred trigger's violation surfaces there rather than
 * on `.constraint`. Terminates on a self-referencing cause rather than
 * looping forever.
 */
export function matchesConstraintError(
  error: unknown,
  match: { code: string; constraint: string },
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH && current; depth++) {
    const e = current as {
      code?: string;
      constraint?: string;
      message?: string;
      cause?: unknown;
    };
    if (
      e.code === match.code &&
      (e.constraint === match.constraint ||
        (e.message?.includes(match.constraint) ?? false))
    ) {
      return true;
    }
    if (e.cause === current) return false;
    current = e.cause;
  }
  return false;
}
