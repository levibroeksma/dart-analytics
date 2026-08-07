/**
 * Mints a transient correlation token for a stage or turn inside one batch.
 *
 * This is deliberately **not** an entity id and deliberately **not** UUIDv7.
 * A `clientKey` exists only to let a batch payload point its turns at their
 * stage before either has been persisted; `session.service.ts` maps each one to
 * a real UUIDv7 from `@lib/id`'s `generateId()` at write time, and the
 * `clientKey` itself never reaches a database column.
 *
 * The Hard Invariant "UUIDv7 for domain entities" therefore does not apply
 * here — it governs `generateId()`, which mints every persisted id. Reaching
 * for `generateId()` here would imply this value is an entity id and invite a
 * future reader to persist it.
 */
export function newClientKey(): string {
  return crypto.randomUUID();
}
