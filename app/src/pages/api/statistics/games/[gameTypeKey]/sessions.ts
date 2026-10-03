import { pickQuery, statisticsRoute } from "@server/statistics-route";
import type { GameTypeKey } from "@lib/types";
import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { listGameSessions } from "@services/statistics.service";
import { SessionListQuery } from "@routes/types";

/** The caller's paginated session list for a game page (`00-Overview.md` §6). */
const PICKED_KEYS = [
  "from",
  "to",
  "tz",
  "bucket",
  "status",
  "context",
  "inputMode",
  "limit",
  "cursor",
] as const;

export const GET = statisticsRoute({
  schema: SessionListQuery,
  pick: (url) => pickQuery(url, PICKED_KEYS),
  guard: ({ gameTypeKey }) =>
    isGameTypeKey(gameTypeKey!) ? null : { code: "NOT_FOUND" },
  run: ({ playerId, params }, query) =>
    listGameSessions(playerId, params.gameTypeKey as GameTypeKey, query),
});
