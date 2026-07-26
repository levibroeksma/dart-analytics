import { RULESET_CONFIGS } from "./types";
import type { ConfigSnapshotFor, RulesetVersionKey } from "./types";

/**
 * Converts a single snake_case wire key to its camelCase snapshot equivalent.
 */
function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

/**
 * Converts a single camelCase snapshot key to its snake_case wire equivalent.
 */
function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Rebuilds a plain object with every key run through the given mapper.
 */
function mapKeys(
  source: Record<string, unknown>,
  mapKey: (key: string) => string,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [mapKey(key), value]),
  );
}

/**
 * Parses a database-shaped (snake_case) ruleset config against its Zod schema
 * and returns the camelCase snapshot the client works with. Throws when the
 * wire config fails validation for the given ruleset version.
 */
export function toSnapshot<K extends RulesetVersionKey>(
  key: K,
  wire: unknown,
): ConfigSnapshotFor<K> {
  const parsed = RULESET_CONFIGS[key].parse(wire) as Record<string, unknown>;
  return mapKeys(parsed, snakeToCamel) as ConfigSnapshotFor<K>;
}

/**
 * Converts a camelCase client snapshot back into the snake_case shape stored
 * on `configuration_templates.configuration`.
 */
export function toWireConfig<K extends RulesetVersionKey>(
  _key: K,
  snapshot: ConfigSnapshotFor<K>,
): Record<string, unknown> {
  return mapKeys(snapshot as unknown as Record<string, unknown>, camelToSnake);
}
