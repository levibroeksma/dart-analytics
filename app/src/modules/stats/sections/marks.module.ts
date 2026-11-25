import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";
import {
  CRICKET_OBJECTIVES,
  CRICKET_RULES,
} from "@modules/game/cricket.engine.module";
import { foldMarks } from "@modules/game/marks-kernel.module";
import { effectiveMarks } from "@modules/game/marks-close.module";
import { seatOf } from "@modules/game/seat-rota.module";
import {
  MICKEY_MOUSE_OBJECTIVES,
  MICKEY_MOUSE_RULES,
} from "@modules/game/mickey-mouse.engine.module";
import {
  TACTICS_OBJECTIVES,
  TACTICS_RULES,
} from "@modules/game/tactics.engine.module";
import { closeBuckets } from "./series.module";
import type { SeriesBucket } from "@lib/types";
import type {
  DartZoneKey,
  EngineFacts,
  MarksDuelSeat,
  MarksFoldedSession,
  MarksGameKey,
  MarksGameState,
  MarksMetrics,
  MarksRules,
  MarksSession,
} from "@modules/types";

type AnyMarksRules = MarksRules<MarksDuelSeat>;
type Ring = keyof MarksMetrics["rings"];

/** Each marks game's own engine rules: the section never re-derives a mark. */
export const RULES_BY_GAME: Record<MarksGameKey, AnyMarksRules> = {
  CRICKET: CRICKET_RULES as unknown as AnyMarksRules,
  TACTICS: TACTICS_RULES as unknown as AnyMarksRules,
  MICKEY_MOUSE: MICKEY_MOUSE_RULES as unknown as AnyMarksRules,
};

const OBJECTIVES_BY_GAME: Record<MarksGameKey, readonly (number | string)[]> = {
  CRICKET: CRICKET_OBJECTIVES,
  TACTICS: TACTICS_OBJECTIVES,
  MICKEY_MOUSE: MICKEY_MOUSE_OBJECTIVES,
};

const RING_OF: Partial<Record<DartZoneKey, Ring>> = {
  SINGLE: "single",
  INNER_SINGLE: "single",
  OUTER_SINGLE: "single",
  OUTER_BULL: "single",
  DOUBLE: "double",
  INNER_BULL: "double",
  TREBLE: "treble",
};

/** The games the `marks` section replays. */
export const MARKS_GAMES: readonly MarksGameKey[] = [
  "CRICKET",
  "TACTICS",
  "MICKEY_MOUSE",
];

/** An objective's metrics key: the bull as `"BULL"`, a number as its digits, a category by name. */
function objectiveKey(objective: number | string): string {
  return objective === BULL_TARGET_NUMBER ? "BULL" : String(objective);
}

/** A marks metrics value with nothing counted, keyed by `game`'s objectives when given. */
export function emptyMarksMetrics(game?: MarksGameKey): MarksMetrics {
  return {
    darts: 0,
    marks: 0,
    wasted: 0,
    rings: { single: 0, double: 0, treble: 0 },
    objectives: (game ? OBJECTIVES_BY_GAME[game] : []).map((objective) => ({
      key: objectiveKey(objective),
      marks: 0,
      darts: 0,
    })),
    closeOuts: { games: 0, darts: 0 },
    duel: { games: 0, wins: 0, darts: 0, points: 0 },
  };
}

/** `facts` cut after dart `dartCount` of turn `turnIndex`, every stage kept. */
function prefixFacts(
  facts: EngineFacts,
  turnIndex: number,
  dartCount: number,
): EngineFacts {
  const turn = facts.turns[turnIndex]!;
  return {
    stages: facts.stages,
    turns: [
      ...facts.turns.slice(0, turnIndex),
      { ...turn, darts: turn.darts.slice(0, dartCount) },
    ],
  };
}

/**
 * The owner's seat in `state`.
 * @throws when the owner holds no seat.
 */
function ownerSeat(
  state: MarksGameState<MarksDuelSeat>,
  ownerRef: string,
): MarksDuelSeat {
  const seat = state.seats.find((s) => s.participantRef === ownerRef);
  if (!seat) throw new Error(`Owner ${ownerRef} holds no seat.`);
  return seat;
}

/**
 * Replays one marks session through its game's `foldMarks` once per dart,
 * reading each owner dart's effect off the owner seat before and after it:
 * a dart that adds no effective mark and no points is wasted, and the
 * effective marks a dart adds count toward its ring.
 * @throws when a turn's participant or the owner holds no seat, or the
 *   engine refuses a dart.
 */
export function marksSessionMetrics(session: MarksSession): MarksMetrics {
  const rules = RULES_BY_GAME[session.gameTypeKey];
  const fold = (facts: EngineFacts) => foldMarks(facts, session.seats, rules);
  const metrics = emptyMarksMetrics(session.gameTypeKey);
  for (const turn of session.facts.turns) seatOf(turn, session.seats);
  let final = fold({ stages: session.facts.stages, turns: [] });
  ownerSeat(final, session.ownerRef);

  session.facts.turns.forEach((turn, turnIndex) => {
    turn.darts.forEach((dart, dartIndex) => {
      const before = ownerSeat(final, session.ownerRef);
      final = fold(prefixFacts(session.facts, turnIndex, dartIndex + 1));
      if (turn.participantRef !== session.ownerRef) return;
      const after = ownerSeat(final, session.ownerRef);
      const added = effectiveMarks(after) - effectiveMarks(before);
      const marked = added > 0;
      const ring = RING_OF[dart.hitZoneKey];
      if (marked && ring) metrics.rings[ring] += added;
      if (!marked && after.points === before.points) metrics.wasted += 1;
    });
  });

  const owner = ownerSeat(final, session.ownerRef);
  metrics.darts = owner.dartsThrown;
  metrics.marks = effectiveMarks(owner);
  metrics.objectives = OBJECTIVES_BY_GAME[session.gameTypeKey].map(
    (objective, index) => ({
      key: objectiveKey(objective),
      marks: owner.marks[index]!,
      darts: owner.objectiveHits[index]!,
    }),
  );
  if (owner.marks.every((count) => count === 3)) {
    metrics.closeOuts = {
      games: 1,
      darts: Math.max(...owner.closedAtDart.map((dart) => dart ?? 0)),
    };
  }
  if (session.seats.length === 2) {
    metrics.duel = {
      games: final.status === "COMPLETE" ? 1 : 0,
      wins: final.winnerParticipantRef === session.ownerRef ? 1 : 0,
      darts: owner.dartsThrown,
      points: owner.points,
    };
  }
  return metrics;
}

/**
 * Replays every session; one whose fold throws is skipped and counted,
 * never guessed.
 */
export function foldMarksSessions(sessions: readonly MarksSession[]): {
  sessions: MarksFoldedSession[];
  skippedSessions: number;
} {
  const folded: MarksFoldedSession[] = [];
  let skippedSessions = 0;
  for (const session of sessions) {
    try {
      folded.push({
        sessionId: session.sessionId,
        bucketStart: session.bucketStart,
        bucketEnd: session.bucketEnd,
        metrics: marksSessionMetrics(session),
      });
    } catch {
      skippedSessions += 1;
    }
  }
  return { sessions: folded, skippedSessions };
}

/** Field-wise sum of two marks metrics; objectives keep `a`'s order, then `b`'s new keys. */
export function addMarksMetrics(
  a: MarksMetrics,
  b: MarksMetrics,
): MarksMetrics {
  const objectives = a.objectives.map((objective) => ({ ...objective }));
  for (const added of b.objectives) {
    const prior = objectives.find((objective) => objective.key === added.key);
    if (prior) {
      prior.marks += added.marks;
      prior.darts += added.darts;
    } else {
      objectives.push({ ...added });
    }
  }
  return {
    darts: a.darts + b.darts,
    marks: a.marks + b.marks,
    wasted: a.wasted + b.wasted,
    rings: {
      single: a.rings.single + b.rings.single,
      double: a.rings.double + b.rings.double,
      treble: a.rings.treble + b.rings.treble,
    },
    objectives,
    closeOuts: {
      games: a.closeOuts.games + b.closeOuts.games,
      darts: a.closeOuts.darts + b.closeOuts.darts,
    },
    duel: {
      games: a.duel.games + b.duel.games,
      wins: a.duel.wins + b.duel.wins,
      darts: a.duel.darts + b.duel.darts,
      points: a.duel.points + b.duel.points,
    },
  };
}

/**
 * Sums replayed sessions into `marks` buckets. `sampleSize` is the number of
 * sessions; a bucket with none is not emitted.
 */
export function marksBuckets(
  sessions: readonly MarksFoldedSession[],
  ctx: { to: string; now: Date },
): SeriesBucket<MarksMetrics>[] {
  const buckets = new Map<
    string,
    { end: string; sampleSize: number; metrics: MarksMetrics }
  >();
  for (const session of sessions) {
    const bucket = buckets.get(session.bucketStart) ?? {
      end: session.bucketEnd,
      sampleSize: 0,
      metrics: emptyMarksMetrics(),
    };
    bucket.sampleSize += 1;
    bucket.metrics = addMarksMetrics(bucket.metrics, session.metrics);
    buckets.set(session.bucketStart, bucket);
  }
  return closeBuckets(buckets, ctx, { dropEmpty: true });
}
