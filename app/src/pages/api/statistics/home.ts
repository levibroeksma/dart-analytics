import { statisticsRoute } from "@server/statistics-route";
import { getHomeStats } from "@services/statistics.service";
import { StatisticsHomeQuery } from "@routes/types";

/** The caller's Home stat blocks: first-9 trend, daily averages, landing cells. */
export const GET = statisticsRoute({
  schema: StatisticsHomeQuery,
  run: ({ playerId }, query) =>
    getHomeStats(playerId, { tz: query.tz, now: new Date() }),
});
