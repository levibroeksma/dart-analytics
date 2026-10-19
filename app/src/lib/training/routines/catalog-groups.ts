import { cardTags } from "@lib/catalog/tags";
import type { ExerciseTemplateCatalogEntryData } from "@client/api/types";
import type {
  CatalogGroup,
  CatalogTagSet,
  CatalogTagsResponse,
  DifficultyLevel,
} from "@lib/types";

const GAME_TYPE_KEY = "GAME";

function groupKey(entry: ExerciseTemplateCatalogEntryData): string {
  return entry.exerciseTypeKey === GAME_TYPE_KEY && entry.gameTypeKey
    ? entry.gameTypeKey
    : entry.exerciseTypeKey;
}

function tagSet(
  entry: ExerciseTemplateCatalogEntryData,
  tags: CatalogTagsResponse | null,
  key: string,
): CatalogTagSet | undefined {
  if (!tags) return undefined;
  return entry.exerciseTypeKey === GAME_TYPE_KEY
    ? tags.games[key]?.routineStep
    : tags.exercises[key];
}

/**
 * Groups the flat template catalog into one picker card per exercise type, or
 * per game type for routine-step games. Group names come from the view's name
 * columns and row labels are the template names as-is. The blurb is the game
 * type's description, else the exercise type's, else the first template's.
 * Order is first-seen, which is the catalog's own name sort. A missing tag
 * source (or a failed tags fetch, `tags === null`) gives a group with no tags.
 */
export function groupCatalog(
  entries: ExerciseTemplateCatalogEntryData[],
  tags: CatalogTagsResponse | null,
): CatalogGroup[] {
  const groups = new Map<string, CatalogGroup>();
  for (const entry of entries) {
    const key = groupKey(entry);
    let group = groups.get(key);
    if (!group) {
      const set = tagSet(entry, tags, key);
      group = {
        key,
        name: entry.gameTypeName ?? entry.exerciseTypeName,
        blurb:
          entry.gameTypeDescription ??
          entry.exerciseTypeDescription ??
          entry.description,
        tags: set ? cardTags(set, "exercise") : [],
        entries: [],
      };
      groups.set(key, group);
    }
    group.entries.push({
      ...entry,
      level: entry.difficultyLevel as DifficultyLevel | null,
      label: entry.name,
    });
  }
  return [...groups.values()];
}
