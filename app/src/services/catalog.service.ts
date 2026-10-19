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

type RankedTag = { tag: CatalogTag; axisRank: number };

const emptySet = (): CatalogTagSet => ({ tags: [], difficultyLevel: null });

function toAxis(key: string): AxisKey {
  const axis = AXIS_KEYS.find((candidate) => candidate === key);
  if (!axis) throw new Error(`v_catalog_tags: unknown axis_key ${key}`);
  return axis;
}

function toDifficultyLevel(axisRank: number): DifficultyLevel {
  if (axisRank === 1 || axisRank === 2 || axisRank === 3 || axisRank === 4) {
    return axisRank;
  }
  throw new Error(
    `v_catalog_tags: DIFFICULTY axis_rank ${axisRank} not in 1-4`,
  );
}

function finishSet(ranked: RankedTag[]): CatalogTagSet {
  const difficulty = ranked.filter(({ tag }) => tag.axis === "DIFFICULTY");
  return {
    tags: ranked.map(({ tag }) => tag),
    difficultyLevel:
      difficulty.length === 1
        ? toDifficultyLevel(difficulty[0]!.axisRank)
        : null,
  };
}

function groupCatalogTags(rows: CatalogTagRow[]): CatalogTagsResponse {
  const games = new Map<string, Record<string, RankedTag[]>>();
  const exercises = new Map<string, RankedTag[]>();
  for (const row of rows) {
    const tag: CatalogTag = {
      axis: toAxis(row.axisKey),
      key: row.tagKey,
      name: row.tagName,
      primary: row.isPrimary,
    };
    const entry: RankedTag = { tag, axisRank: row.axisRank };
    if (row.entityKind === "EXERCISE") {
      exercises.set(row.typeKey, [
        ...(exercises.get(row.typeKey) ?? []),
        entry,
      ]);
    } else if (row.entityKind === "GAME") {
      const contexts = games.get(row.typeKey) ?? {};
      contexts[row.contextKey] = [...(contexts[row.contextKey] ?? []), entry];
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
