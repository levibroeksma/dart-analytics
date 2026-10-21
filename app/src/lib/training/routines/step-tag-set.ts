import type { CatalogTagSet, CatalogTagsResponse } from "@lib/types";

const GAME_TYPE_KEY = "GAME";

/**
 * Looks up the tag set for a routine step: a game step reads its game type's
 * `routineStep` set, any other step reads its exercise type's set. Returns
 * `undefined` when tags failed to load or the key has no entry.
 */
export function stepTagSet(
  tags: CatalogTagsResponse | null,
  exerciseTypeKey: string,
  gameTypeKey: string | null,
): CatalogTagSet | undefined {
  if (!tags) return undefined;
  return exerciseTypeKey === GAME_TYPE_KEY
    ? tags.games[gameTypeKey ?? exerciseTypeKey]?.routineStep
    : tags.exercises[exerciseTypeKey];
}
