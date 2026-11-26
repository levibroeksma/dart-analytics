import { compareMeasures } from "@lib/stats/sections/comparison-tile";
import {
  addEliminationMetrics,
  emptyEliminationMetrics,
} from "@modules/stats/sections/elimination.module";
import type { EliminationComparison, Ratio, SeriesBucket } from "@lib/types";
import type { EliminationMetrics } from "@modules/types";

/** Every bucket's metrics summed into one. */
export function sumElimination(
  buckets: readonly SeriesBucket<EliminationMetrics>[],
): EliminationMetrics {
  return buckets.reduce(
    (sum, bucket) => addEliminationMetrics(sum, bucket.metrics),
    emptyEliminationMetrics(),
  );
}

const MEASURES: Record<
  keyof EliminationComparison,
  (m: EliminationMetrics) => Ratio
> = {
  wins: (m) => ({ part: m.wins, whole: m.finished }),
  dartsToKiller: (m) => ({
    part: m.killer.dartsToKiller,
    whole: m.killer.killerGames,
  }),
  dartsPerLife: (m) => ({ part: m.darts, whole: m.killer.livesTaken }),
  livesLost: (m) => ({ part: m.livesLost, whole: m.finished }),
  matchRate: (m) => ({
    part: m.followTheLeader.matched,
    whole: m.followTheLeader.matchVisits,
  }),
  matchDarts: (m) => ({
    part: m.followTheLeader.matchDarts,
    whole: m.followTheLeader.matched,
  }),
  advance: (m) => ({
    part: m.prisoner.advance + m.prisoner.advanceAndCapture,
    whole: m.darts,
  }),
  prison: (m) => ({ part: m.prisoner.prison, whole: m.darts }),
  reached: (m) => ({ part: m.prisoner.reached, whole: m.finished }),
};

/** Every Elimination measure of `current` against `previous`; every `previous` is `null` with no preceding period. */
export function eliminationComparison(
  current: EliminationMetrics,
  previous: EliminationMetrics | null,
): EliminationComparison {
  return compareMeasures(MEASURES, current, previous);
}
