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

function toRanked(row: CatalogTagRow): RankedTag {
  return {
    tag: {
      axis: toAxis(row.axisKey),
      key: row.tagKey,
      name: row.tagName,
      primary: row.isPrimary,
    },
    axisRank: row.axisRank,
  };
}

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

type GameContexts = Map<string, RankedTag[]>;

function collect(rows: CatalogTagRow[]): {
  games: Map<string, GameContexts>;
  exercises: Map<string, RankedTag[]>;
} {
  const games = new Map<string, GameContexts>();
  const exercises = new Map<string, RankedTag[]>();
  for (const row of rows) {
    const entry = toRanked(row);
    if (row.entityKind === "EXERCISE") {
      pushTo(exercises, row.typeKey, entry);
    } else if (row.entityKind === "GAME") {
      const contexts = games.get(row.typeKey) ?? new Map<string, RankedTag[]>();
      pushTo(contexts, row.contextKey, entry);
      games.set(row.typeKey, contexts);
    } else {
      throw new Error(`v_catalog_tags: unknown entity_kind ${row.entityKind}`);
    }
  }
  return { games, exercises };
}

function finishContext(ranked: RankedTag[] | undefined): CatalogTagSet {
  return ranked ? finishSet(ranked) : emptySet();
}

function finishGame(
  contexts: GameContexts,
): CatalogTagsResponse["games"][string] {
  return {
    standalone: finishContext(contexts.get("STANDALONE")),
    routineStep: finishContext(contexts.get("ROUTINE_STEP")),
  };
}

function groupCatalogTags(rows: CatalogTagRow[]): CatalogTagsResponse {
  const { games, exercises } = collect(rows);
  const response: CatalogTagsResponse = { games: {}, exercises: {} };
  for (const [typeKey, contexts] of games) {
    response.games[typeKey] = finishGame(contexts);
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
