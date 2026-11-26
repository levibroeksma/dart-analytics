import { foldFivesState } from "@modules/game/fives.engine.module";
import { seatOf } from "@modules/game/seat-rota.module";
import { foldOwnerSessions, ownerIn } from "@modules/stats/replay.module";
import { addMetricCounts, foldedBuckets } from "./series.module";
import type { FivesSnapshot, Seated, SeriesBucket } from "@lib/types";
import type {
  FivesFoldedSession,
  FivesMetrics,
  OwnerSession,
} from "@modules/types";

type FivesSession = OwnerSession<"FIVES">;

/** The games the `fives` section replays. */
export const FIVES_GAMES: readonly "FIVES"[] = ["FIVES"];

/** A Fives metrics value with nothing counted. */
export function emptyFivesMetrics(): FivesMetrics {
  return {
    games: 0,
    finished: 0,
    wins: 0,
    visits: 0,
    scoringVisits: 0,
    voids: 0,
    busts: 0,
    points: 0,
    winVisits: 0,
  };
}

/** Field-wise sum of two Fives metrics. */
export function addFivesMetrics(
  a: FivesMetrics,
  b: FivesMetrics,
): FivesMetrics {
  return addMetricCounts(a, b);
}

/**
 * Replays one Fives session through `foldFivesState` and reads the owner's
 * figures off the folded owner seat.
 * @throws when a turn's participant or the owner holds no seat.
 */
export function fivesSessionMetrics(session: FivesSession): FivesMetrics {
  for (const turn of session.facts.turns) seatOf(turn, session.seats);
  const config = session.config as unknown as Seated<FivesSnapshot>;
  const final = foldFivesState(session.facts, config);
  const owner = ownerIn(final.seats, session.ownerRef);
  const finished = final.status === "COMPLETE";
  const won = finished && final.winningSideKey === owner.sideKey;
  return {
    games: 1,
    finished: finished ? 1 : 0,
    wins: won ? 1 : 0,
    visits: owner.visits,
    scoringVisits: owner.scoringVisits,
    voids: owner.voids,
    busts: owner.busts,
    points: owner.total,
    winVisits: won ? owner.visits : 0,
  };
}

/** Replays every session; one whose replay throws is skipped and counted. */
export function foldFivesSessions(sessions: readonly FivesSession[]): {
  sessions: FivesFoldedSession[];
  skippedSessions: number;
} {
  return foldOwnerSessions(sessions, fivesSessionMetrics);
}

/**
 * Sums replayed sessions into `fives` buckets. `sampleSize` is the number of
 * sessions; a bucket with none is not emitted.
 */
export function fivesBuckets(
  sessions: readonly FivesFoldedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<FivesMetrics>[] {
  return foldedBuckets(sessions, ctx, emptyFivesMetrics, addFivesMetrics);
}
