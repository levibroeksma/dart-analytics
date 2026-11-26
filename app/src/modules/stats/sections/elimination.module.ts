import { foldKillerState } from "@modules/game/killer.engine.module";
import { foldFollowTheLeaderState } from "@modules/game/follow-the-leader.engine.module";
import { bedOf, sameBed } from "@modules/game/follow-the-leader-policy";
import {
  foldPrisonerState,
  prisonerDartResults,
} from "@modules/game/prisoner.engine.module";
import { WON_TARGET } from "@modules/game/prisoner-policy";
import { seatOf } from "@modules/game/seat-rota.module";
import { foldOwnerSessions, ownerIn } from "@modules/stats/replay.module";
import { addMetricCounts, foldedBuckets } from "./series.module";
import type {
  FollowTheLeaderSnapshot,
  KillerSnapshot,
  PrisonerSnapshot,
  Seated,
  SeriesBucket,
} from "@lib/types";
import type {
  BedFact,
  BedKey,
  EliminationFoldedSession,
  EliminationGameKey,
  EliminationMetrics,
  EngineFacts,
  OwnerSession,
  TurnFact,
} from "@modules/types";

type EliminationSession = OwnerSession<EliminationGameKey>;

/** The games the `elimination` section replays. */
export const ELIMINATION_GAMES: readonly EliminationGameKey[] = [
  "KILLER",
  "FOLLOW_THE_LEADER",
  "PRISONER",
];

const BED_OF_RING: Record<BedFact["ring"], BedKey> = {
  SINGLE: "SINGLE",
  DOUBLE: "DOUBLE",
  TREBLE: "TREBLE",
  OUTER_BULL: "BULL",
  INNER_BULL: "BULL",
};

const RESULT_FIELD: Record<string, keyof EliminationMetrics["prisoner"]> = {
  Advance: "advance",
  "Advance and capture": "advanceAndCapture",
  Capture: "capture",
  Prison: "prison",
  Miss: "miss",
};

/**
 * The Prisoner metrics field a `prisonerDartResults` result counts toward.
 * @throws on a result it does not know.
 */
export function prisonerResultField(
  result: string,
): keyof EliminationMetrics["prisoner"] {
  const field = RESULT_FIELD[result];
  if (!field) throw new Error(`Unknown Prisoner dart result ${result}.`);
  return field;
}

/** An elimination metrics value with nothing counted. */
export function emptyEliminationMetrics(): EliminationMetrics {
  const bed = () => ({ visits: 0, matched: 0 });
  return {
    games: 0,
    finished: 0,
    wins: 0,
    darts: 0,
    livesLost: 0,
    killer: { killerGames: 0, dartsToKiller: 0, livesTaken: 0 },
    followTheLeader: {
      matchVisits: 0,
      matched: 0,
      matchDarts: 0,
      byBed: { SINGLE: bed(), DOUBLE: bed(), TREBLE: bed(), BULL: bed() },
    },
    prisoner: {
      advance: 0,
      advanceAndCapture: 0,
      capture: 0,
      prison: 0,
      miss: 0,
      reached: 0,
    },
  };
}

/** Field-wise sum of two elimination metrics. */
export function addEliminationMetrics(
  a: EliminationMetrics,
  b: EliminationMetrics,
): EliminationMetrics {
  return addMetricCounts(a, b);
}

/** The folded state shared by the three games: outcome and seats. */
type FoldedOutcome = {
  status: "IN_PROGRESS" | "COMPLETE";
  winningSideKey: string | null;
  seats: readonly { participantRef: string; sideKey: string }[];
};

/** `facts` with only its first `count` turns. */
function before(facts: EngineFacts, count: number): EngineFacts {
  return { stages: facts.stages, turns: facts.turns.slice(0, count) };
}

/** The owner's turns with their index in the log. */
function ownerTurns(
  session: EliminationSession,
): { turn: TurnFact; index: number }[] {
  return session.facts.turns
    .map((turn, index) => ({ turn, index }))
    .filter(({ turn }) => turn.participantRef === session.ownerRef);
}

/** The result, darts and session counts every game shares. */
function common(
  session: EliminationSession,
  final: FoldedOutcome,
): EliminationMetrics {
  const metrics = emptyEliminationMetrics();
  const owner = ownerIn(final.seats, session.ownerRef);
  const finished = final.status === "COMPLETE";
  metrics.games = 1;
  metrics.finished = finished ? 1 : 0;
  metrics.wins = finished && final.winningSideKey === owner.sideKey ? 1 : 0;
  metrics.darts = ownerTurns(session).reduce(
    (sum, { turn }) => sum + turn.darts.length,
    0,
  );
  return metrics;
}

function killerMetrics(session: EliminationSession): EliminationMetrics {
  const config = session.config as unknown as Seated<KillerSnapshot>;
  const final = foldKillerState(session.facts, config);
  const metrics = common(session, final);
  const owner = ownerIn(final.seats, session.ownerRef);
  metrics.livesLost = config.lives - owner.lives;
  metrics.killer = {
    killerGames: owner.dartsToKiller === null ? 0 : 1,
    dartsToKiller: owner.dartsToKiller ?? 0,
    livesTaken: owner.livesTaken,
  };
  return metrics;
}

/**
 * Follow the Leader: an owner turn, not a keep, that starts with a standing
 * target the owner did not set is a match visit; it is matched when any dart
 * lands in the target's bed, and its darts to the match run to the first one.
 */
function followTheLeaderMetrics(
  session: EliminationSession,
): EliminationMetrics {
  const config = session.config as unknown as Seated<FollowTheLeaderSnapshot>;
  const final = foldFollowTheLeaderState(session.facts, config);
  const metrics = common(session, final);
  metrics.livesLost =
    config.lives - ownerIn(final.seats, session.ownerRef).lives;
  const ftl = metrics.followTheLeader;
  for (const { turn, index } of ownerTurns(session)) {
    if (turn.kept) continue;
    const state = foldFollowTheLeaderState(
      before(session.facts, index),
      config,
    );
    const target = state.target;
    if (target === null || state.leaderRef === session.ownerRef) continue;
    const bed = ftl.byBed[BED_OF_RING[target.ring]];
    const matchAt = turn.darts.findIndex((dart) => {
      const hit = bedOf(dart);
      return hit !== null && sameBed(hit, target);
    });
    ftl.matchVisits += 1;
    bed.visits += 1;
    if (matchAt < 0) continue;
    ftl.matched += 1;
    ftl.matchDarts += matchAt + 1;
    bed.matched += 1;
  }
  return metrics;
}

/** Prisoner: each owner dart by `prisonerDartResults`, and the number reached. */
function prisonerMetrics(session: EliminationSession): EliminationMetrics {
  const config = session.config as unknown as Seated<PrisonerSnapshot>;
  const final = foldPrisonerState(session.facts, config);
  const metrics = common(session, final);
  for (const { turn, index } of ownerTurns(session)) {
    const state = foldPrisonerState(before(session.facts, index), config);
    for (const result of prisonerDartResults(
      state,
      session.ownerRef,
      turn.darts,
    )) {
      metrics.prisoner[prisonerResultField(result)] += 1;
    }
  }
  metrics.prisoner.reached =
    Math.min(ownerIn(final.seats, session.ownerRef).target, WON_TARGET) - 1;
  return metrics;
}

const METRICS_BY_GAME: Record<
  EliminationGameKey,
  (session: EliminationSession) => EliminationMetrics
> = {
  KILLER: killerMetrics,
  FOLLOW_THE_LEADER: followTheLeaderMetrics,
  PRISONER: prisonerMetrics,
};

/**
 * Replays one elimination session through its game's own fold and reads the
 * owner's figures off the folded seats.
 * @throws when a turn's participant or the owner holds no seat, or the
 *   engine's fold throws.
 */
export function eliminationSessionMetrics(
  session: EliminationSession,
): EliminationMetrics {
  for (const turn of session.facts.turns) seatOf(turn, session.seats);
  return METRICS_BY_GAME[session.gameTypeKey](session);
}

/** Replays every session; one whose replay throws is skipped and counted. */
export function foldEliminationSessions(
  sessions: readonly EliminationSession[],
): { sessions: EliminationFoldedSession[]; skippedSessions: number } {
  return foldOwnerSessions(sessions, eliminationSessionMetrics);
}

/**
 * Sums replayed sessions into `elimination` buckets. `sampleSize` is the
 * number of sessions; a bucket with none is not emitted.
 */
export function eliminationBuckets(
  sessions: readonly EliminationFoldedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<EliminationMetrics>[] {
  return foldedBuckets(
    sessions,
    ctx,
    emptyEliminationMetrics,
    addEliminationMetrics,
  );
}
