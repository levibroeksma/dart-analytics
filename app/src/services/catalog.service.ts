import { getDb } from "@db/client";
import { AXIS_KEYS } from "@lib/catalog/tags";
import { findCatalogTagRows } from "@repositories/catalog.repository";
import type { CatalogTagRow } from "@repositories/interfaces";
import type {
  AxisKey,
  CatalogTag,
  CatalogTagSet,
  CatalogTagsResponse,
  DifficultyLevel,
} from "@lib/types";
import type { ServiceResult } from "./types";

/**
 * Rank of each DIFFICULTY tag, matching the `difficulty_level` the template
 * view derives from `sort_order`. A set holds only its own tags, so its rank
 * cannot be read from position; the keys are the seeded DIFFICULTY axis.
 */
const DIFFICULTY_LEVEL: Record<string, DifficultyLevel> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

const emptySet = (): CatalogTagSet => ({ tags: [], difficultyLevel: null });

function toAxis(key: string): AxisKey {
  const axis = AXIS_KEYS.find((candidate) => candidate === key);
  if (!axis) throw new Error(`v_catalog_tags: unknown axis_key ${key}`);
  return axis;
}

function finishSet(tags: CatalogTag[]): CatalogTagSet {
  const difficulty = tags.filter((tag) => tag.axis === "DIFFICULTY");
  const level =
    difficulty.length === 1 ? DIFFICULTY_LEVEL[difficulty[0]!.key] : undefined;
  return { tags, difficultyLevel: level ?? null };
}

function groupCatalogTags(rows: CatalogTagRow[]): CatalogTagsResponse {
  const games = new Map<string, Record<string, CatalogTag[]>>();
  const exercises = new Map<string, CatalogTag[]>();
  for (const row of rows) {
    const tag: CatalogTag = {
      axis: toAxis(row.axisKey),
      key: row.tagKey,
      name: row.tagName,
      primary: row.isPrimary,
    };
    if (row.entityKind === "EXERCISE") {
      exercises.set(row.typeKey, [...(exercises.get(row.typeKey) ?? []), tag]);
    } else if (row.entityKind === "GAME") {
      const contexts = games.get(row.typeKey) ?? {};
      contexts[row.contextKey] = [...(contexts[row.contextKey] ?? []), tag];
      games.set(row.typeKey, contexts);
    } else {
      throw new Error(`v_catalog_tags: unknown entity_kind ${row.entityKind}`);
    }
  }
  const response: CatalogTagsResponse = { games: {}, exercises: {} };
  for (const [typeKey, contexts] of games) {
    response.games[typeKey] = {
      standalone: contexts.STANDALONE
        ? finishSet(contexts.STANDALONE)
        : emptySet(),
      routineStep: contexts.ROUTINE_STEP
        ? finishSet(contexts.ROUTINE_STEP)
        : emptySet(),
    };
  }
  for (const [typeKey, tags] of exercises) {
    response.exercises[typeKey] = finishSet(tags);
  }
  return response;
}

export async function getCatalogTags(): Promise<
  ServiceResult<CatalogTagsResponse>
> {
  const rows = await findCatalogTagRows(getDb());
  return { ok: true, data: groupCatalogTags(rows) };
}
