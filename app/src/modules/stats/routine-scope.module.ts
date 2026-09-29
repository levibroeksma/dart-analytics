import type { GameTypeKey } from "@lib/types";

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NAME_KEY_SHAPE = /^name-[0-9a-f]{32}$/;
const STEP_KEY_SHAPE = /^([1-9][0-9]*)-([0-9a-f]{32})$/;

/**
 * True for a `routine_key` value as `v_stats_routine_run_facts` /
 * `v_stats_routine_step_facts` derive it (migration `0045` header, identity
 * rule 1): the snapshot's `routineTemplateId` UUID, or the
 * `name-<md5(routineName)>` fallback a snapshot predating that field keys as.
 */
export function isRoutineKey(s: string): boolean {
  return UUID_SHAPE.test(s) || NAME_KEY_SHAPE.test(s);
}

/**
 * Decodes a `step_key` value (`<sequenceNumber>-<md5>`, migration `0045`
 * header identity rule 2) into its parts, or `null` if `s` is not that
 * shape. `sequenceNumber` must be a positive integer with no leading zero,
 * matching the view's own `sequenceNumber` guard.
 */
export function parseStepKey(
  s: string,
): { sequenceNumber: number; fingerprint: string } | null {
  const match = STEP_KEY_SHAPE.exec(s);
  if (!match) {
    return null;
  }
  return { sequenceNumber: Number(match[1]), fingerprint: match[2] };
}

/** The routine-level cache/read scope key for `routineKey` (D372 decision 12). */
export function routineScopeKey(routineKey: string): string {
  return `routine:${routineKey}`;
}

/** The step-level cache/read scope key for `stepKey` within `routineKey` (D372 decision 12). */
export function stepScopeKey(routineKey: string, stepKey: string): string {
  return `routine:${routineKey}:step:${stepKey}`;
}

/** The game-level cache/read scope key for `gameTypeKey` (D372 decision 12). */
export function gameScopeKey(gameTypeKey: GameTypeKey): string {
  return `game:${gameTypeKey}`;
}
