import { z } from "zod";
import { statisticsRoute } from "@server/statistics-route";
import type { GameTypeKey } from "@lib/types";
import { isGameTypeKey } from "@lib/game/rulesets/capabilities";
import { listGameVariations } from "@services/statistics.service";

/** The owner's 501 variations for the game page's dropdown (`00-Overview.md` §6, D556); takes no query. */
export const GET = statisticsRoute({
  schema: z.object({}).strict(),
  pick: (url) => Object.fromEntries(url.searchParams),
  guard: ({ gameTypeKey }) =>
    isGameTypeKey(gameTypeKey!) ? null : { code: "NOT_FOUND" },
  run: ({ playerId, params }) =>
    listGameVariations(playerId, params.gameTypeKey as GameTypeKey),
});
