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
 * A missing tag source (or a failed tags fetch, `tags === null`) gives a group
 * with no tags.
 *
 * Cards are ordered by their own name and rows within a card by template name,
 * both independently of the order the catalog arrives in. First-seen order
 * would give a card the position of its alphabetically-first template — the
 * Switching card sorting under "C" for its "Chain" row — because the catalog
 * query sorts by template name alone.
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
  for (const group of groups.values()) {
    group.entries.sort((a, b) => a.label.localeCompare(b.label));
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
