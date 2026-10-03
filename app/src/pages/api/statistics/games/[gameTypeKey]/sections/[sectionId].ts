import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { isSectionId } from "@lib/stats/section-registry";
import { getGameSection } from "@services/statistics.service";
import { pickQuery, statisticsRoute } from "@server/statistics-route";
import type { GameTypeKey, SectionId } from "@lib/types";
import { StatisticsRangeQuery } from "@routes/types";

/**
 * One section result for a game page, dispatched through the registry
 * (`00-Overview.md` §2, §6). One route serves every section; adding an
 * insight never adds a route.
 */
const PICKED_KEYS = [
  "from",
  "to",
  "tz",
  "bucket",
  "status",
  "context",
  "inputMode",
  "target",
] as const;

export const GET = statisticsRoute({
  schema: StatisticsRangeQuery,
  pick: (url) => pickQuery(url, PICKED_KEYS),
  guard: ({ gameTypeKey, sectionId }) =>
    isGameTypeKey(gameTypeKey!) && isSectionId(sectionId!)
      ? null
      : { code: "NOT_FOUND" },
  run: ({ playerId, params }, query) =>
    getGameSection(
      playerId,
      params.gameTypeKey as GameTypeKey,
      params.sectionId as SectionId,
      query,
    ),
});
