import { fetchGameSection } from "@client/api/statistics";
import { readSection } from "@client/stats-cache/cache";
import { gameScopeKey } from "@modules/stats/routine-scope.module";
import { SECTIONS } from "@lib/stats/section-registry";
import type { GameTypeKey, SectionId } from "@lib/types";
import type { GameSectionRange } from "./types";
import type { CachedSeries } from "@client/types";

/**
 * A synthetic, browser-scoped player identity for the IndexedDB cache's keys.
 * Requests are scoped server-side to `auth.playerId` and the cache is wiped on
 * sign-out, so a constant key is safe (`10-Statistics/00-Overview.md` §7).
 */
export const CACHE_PLAYER_ID = "me";

/** One game section, read through the IndexedDB cache under the all-context VISUAL_BOARD query. */
export function loadGameSection<M>(
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  range: GameSectionRange,
): Promise<CachedSeries<M>> {
  return readSection<M>(
    CACHE_PLAYER_ID,
    { key: gameScopeKey(gameTypeKey), gameTypeKey },
    SECTIONS[sectionId],
    { ...range, context: "all", inputMode: "VISUAL_BOARD" },
    (span) =>
      fetchGameSection(gameTypeKey, sectionId, {
        ...range,
        ...span,
      }) as Promise<CachedSeries<M>>,
  );
}
