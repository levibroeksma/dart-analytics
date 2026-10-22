import {
  BULL_TARGET_NUMBER,
  boardScore,
  isHitOn,
  targetAt,
} from "./board-progression.module";
import type {
  BoardTarget,
  ChainTrackExt,
  DartObservation,
  DartZoneKey,
  JudgedDart,
  LadderTrackExt,
  LockBonus,
  LockTrackExt,
  MoveTable,
  PassTrackExt,
  PointsTable,
  RoundTallyExt,
  SequenceTrackExt,
  TargetTallyExt,
  TrackSeat,
  TrackTarget,
} from "./types";

/** Target policy: the path entry at the seat's `targetIndex`. */
export function pathTarget<TExt, TTarget extends TrackTarget = BoardTarget>(
  path: readonly TTarget[],
): (seat: TrackSeat<TExt>) => TTarget {
  return (seat) => targetAt(path, seat.targetIndex);
}

/** Points policy for rulesets that score nothing per dart. */
export function noPoints(): number {
  return 0;
}

/** Visit policy: open until a dart hits or `darts` darts are thrown. */
export function closeOnHitOrAfter<TExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.hitsThisVisit === 0 && seat.dartsThisVisit < darts;
}

/** Visit-close policy: step to the next target, or finish (`DONE`, index kept) at `lastIndex`. */
export function advanceToEnd<TExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex === lastIndex
      ? { ...seat, status: "DONE" }
      : { ...seat, targetIndex: seat.targetIndex + 1 };
}

/** Visit policy: open until `darts` darts are thrown, hits or not. */
export function closeAfter<TExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.dartsThisVisit < darts;
}

/** Visit-close policy: subtract `penalty(seat)` from the score when the visit hit nothing. */
export function penaltyOnBlank<TExt>(
  penalty: (seat: TrackSeat<TExt>) => number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.hitsThisVisit === 0
      ? { ...seat, score: seat.score - penalty(seat) }
      : seat;
}

/** Visit-close policy: a score at or below zero puts the seat `OUT`. */
export function outAtOrBelowZero<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  return seat.score <= 0 ? { ...seat, status: "OUT" } : seat;
}

const ANY_RING: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "DOUBLE",
  "TREBLE",
]);

const EITHER_BULL: ReadonlySet<DartZoneKey> = new Set([
  "OUTER_BULL",
  "INNER_BULL",
]);

/** The board number a target's darts must land on: its own number, or 25 for BULL. */
export function sectionOf(target: BoardTarget): number {
  return target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number;
}

/** Hit policy: any ring on a NUMBER target's number, either bull on BULL; a zone target defers to `isHitOn`. */
export function anyRingEitherBull(
  target: TrackTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "ANY_DOUBLE" || target.kind === "ANY_TREBLE")
    return isHitOn(target, observation);
  const zones = target.kind === "BULL" ? EITHER_BULL : ANY_RING;
  return (
    observation.hitTargetNumber === sectionOf(target) &&
    zones.has(observation.hitZoneKey)
  );
}

/** Points policy: the target kind's row of `table` for the dart's zone, 0 off the target's section. */
export function pointsTable(
  table: PointsTable,
): (target: BoardTarget, observation: DartObservation) => number {
  return (target, observation) => {
    if (observation.hitTargetNumber !== sectionOf(target)) return 0;
    const row = target.kind === "BULL" ? table.bull : table.number;
    return row[observation.hitZoneKey] ?? 0;
  };
}

/** Visit-close policy: a visit with fewer than `hits` hits puts the seat `OUT`. */
export function outBelowHits<TExt>(
  hits: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.hitsThisVisit < hits ? { ...seat, status: "OUT" } : seat;
}

/** Hit policy: the outer single on a NUMBER target's number, either bull on BULL. */
export function outerSingleOnly(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") return anyRingEitherBull(target, observation);
  return (
    observation.hitTargetNumber === target.number &&
    observation.hitZoneKey === "OUTER_SINGLE"
  );
}

/**
 * Per-dart policy: a hit moves to the next target at once — past the last
 * index at the path's end — and is spent on the target it left, so
 * `hitsThisVisit` reads 0.
 */
export function advanceOnHit<TExt>(
  seat: TrackSeat<TExt>,
  dart: JudgedDart,
): TrackSeat<TExt> {
  return dart.hit
    ? { ...seat, targetIndex: seat.targetIndex + 1, hitsThisVisit: 0 }
    : seat;
}

/** Visit policy: open until `darts` darts are thrown or the seat moves past `lastIndex`. */
export function closeAfterOrPastEnd<TExt>(
  darts: number,
  lastIndex: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.dartsThisVisit < darts && seat.targetIndex <= lastIndex;
}

/** Visit-close policy: at least `hits` hits move to the next target, fewer step back one, never below the first. */
export function stepBackBelowHits<TExt>(
  hits: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) => ({
    ...seat,
    targetIndex:
      seat.hitsThisVisit >= hits
        ? seat.targetIndex + 1
        : Math.max(0, seat.targetIndex - 1),
  });
}

function wrapToStart<TExt>(
  lastIndex: number,
  bump: (ext: TExt) => TExt,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex > lastIndex
      ? { ...seat, targetIndex: 0, ext: bump(seat.ext) }
      : seat;
}

/** Visit-close policy: past `lastIndex`, restart at the first target and count a lap. */
export function lapOnWrap<TExt extends { laps: number }>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return wrapToStart<TExt>(lastIndex, (ext) => ({
    ...ext,
    laps: ext.laps + 1,
  }));
}

/** Visit-close policy: past `lastIndex`, restart at the first target and count a pass. */
export function passOnWrap<TExt extends PassTrackExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return wrapToStart<TExt>(lastIndex, (ext) => ({
    ...ext,
    passes: ext.passes + 1,
  }));
}

/** Per-dart policy: count the dart against the current target in `ext.dartsOnTarget`, and a hit in `ext.hitsPerTarget[targetIndex]`. */
export function tallyOnTarget<TExt extends TargetTallyExt>(
  seat: TrackSeat<TExt>,
  dart: JudgedDart<TrackTarget>,
): TrackSeat<TExt> {
  const hitsPerTarget = [...seat.ext.hitsPerTarget];
  hitsPerTarget[seat.targetIndex] =
    (hitsPerTarget[seat.targetIndex] ?? 0) + (dart.hit ? 1 : 0);
  return {
    ...seat,
    ext: {
      ...seat.ext,
      dartsOnTarget: seat.ext.dartsOnTarget + 1,
      hitsPerTarget,
    },
  };
}

/** Visit-close policy: once `darts` darts were thrown at the target, step to the next and zero the count. */
export function advanceAfterDarts<TExt extends TargetTallyExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.ext.dartsOnTarget < darts
      ? seat
      : {
          ...seat,
          targetIndex: seat.targetIndex + 1,
          ext: { ...seat.ext, dartsOnTarget: 0 },
        };
}

/** Visit-close policy: past `lastIndex`, finish (`DONE`) on the last target. */
export function doneOnWrap<TExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex > lastIndex
      ? { ...seat, targetIndex: lastIndex, status: "DONE" }
      : seat;
}

const SINGLE_ZONE_KEYS: ReadonlySet<DartZoneKey> = new Set([
  "SINGLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
]);

/** The single/double/treble bucket of a number ring; null for bull and miss. */
export function zoneBucketOf(
  zone: DartZoneKey,
): "SINGLE" | "DOUBLE" | "TREBLE" | null {
  if (SINGLE_ZONE_KEYS.has(zone)) return "SINGLE";
  if (zone === "DOUBLE") return "DOUBLE";
  if (zone === "TREBLE") return "TREBLE";
  return null;
}

/** Points policy: a hit scores its board value, a miss nothing. */
export function boardScorePoints(
  _target: TrackTarget,
  observation: DartObservation,
  hit: boolean,
): number {
  return hit
    ? boardScore(observation.hitTargetNumber, observation.hitZoneKey)
    : 0;
}

/** Per-dart policy: log the dart's zone in `ext.zones` on a hit, `null` on a miss. */
export function recordVisitZone<TExt extends { zones: (DartZoneKey | null)[] }>(
  seat: TrackSeat<TExt>,
  dart: JudgedDart,
): TrackSeat<TExt> {
  return {
    ...seat,
    ext: {
      ...seat.ext,
      zones: [...seat.ext.zones, dart.hit ? dart.observation.hitZoneKey : null],
    },
  };
}

/** Visit-close policy: a visit with no hit halves the score, rounding half up. */
export function halveOnBlank<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  return seat.hitsThisVisit === 0
    ? { ...seat, score: Math.round(seat.score / 2) }
    : seat;
}

/** Visit-close policy: hits holding a single, a double and a treble finish the seat (`DONE`) and set `ext.shanghai`. */
export function shanghaiWin<
  TExt extends { zones: (DartZoneKey | null)[]; shanghai: boolean },
>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  const buckets = new Set(
    seat.ext.zones
      .filter((zone): zone is DartZoneKey => zone !== null)
      .map(zoneBucketOf),
  );
  return buckets.has("SINGLE") && buckets.has("DOUBLE") && buckets.has("TREBLE")
    ? { ...seat, status: "DONE", ext: { ...seat.ext, shanghai: true } }
    : seat;
}

/**
 * Per-dart policy (Target Scoring): a hit adds its points to the chain; a
 * miss that ends a live chain keeps the target's best finished chain and
 * moves to the next of `length` targets, wrapping after the last. A miss on
 * an empty chain changes nothing.
 */
export function chainOnTarget<TExt extends ChainTrackExt>(
  length: number,
): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt> {
  return (seat, dart) => {
    const { chain, finishedBest, hits } = seat.ext;
    if (dart.hit)
      return {
        ...seat,
        ext: { ...seat.ext, chain: chain + dart.points, hits: hits + 1 },
      };
    if (chain === 0) return seat;
    const best = [...finishedBest];
    best[seat.targetIndex] = Math.max(best[seat.targetIndex] ?? 0, chain);
    return {
      ...seat,
      targetIndex: (seat.targetIndex + 1) % length,
      ext: { ...seat.ext, chain: 0, finishedBest: best },
    };
  };
}

/**
 * Per-dart policy for a sequence-walking Track exercise: a hit adds its
 * points to the chain and moves to the next of `length` targets, counting a
 * sequence when it wraps to the first; a miss restarts at the first target
 * and ends the chain, keeping the best chain a miss has ended.
 */
export function resetOnMiss<TExt extends SequenceTrackExt>(
  length: number,
): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt> {
  return (seat, dart) => {
    const { chain, finishedBest, hits, sequences } = seat.ext;
    if (dart.hit) {
      const targetIndex = (seat.targetIndex + 1) % length;
      return {
        ...seat,
        targetIndex,
        ext: {
          ...seat.ext,
          chain: chain + dart.points,
          hits: hits + 1,
          sequences: sequences + (targetIndex === 0 ? 1 : 0),
        },
      };
    }
    return {
      ...seat,
      targetIndex: 0,
      ext: {
        ...seat.ext,
        chain: 0,
        finishedBest:
          chain > 0 ? Math.max(finishedBest ?? 0, chain) : finishedBest,
      },
    };
  };
}

/** Per-dart policy: step to the next target after every dart, hit or miss. */
export function advanceEveryDart<TExt>(seat: TrackSeat<TExt>): TrackSeat<TExt> {
  return { ...seat, targetIndex: seat.targetIndex + 1 };
}

/** Per-dart policy: add the dart's points to `ext.roundTotals` at the current target's round, `dartsPerRound` targets to a round. */
export function tallyRoundPoints<TExt extends RoundTallyExt>(
  dartsPerRound: number,
): (seat: TrackSeat<TExt>, dart: JudgedDart) => TrackSeat<TExt> {
  return (seat, dart) => {
    const round = Math.floor(seat.targetIndex / dartsPerRound);
    const roundTotals = [...seat.ext.roundTotals];
    roundTotals[round] = (roundTotals[round] ?? 0) + dart.points;
    return { ...seat, ext: { ...seat.ext, roundTotals } };
  };
}

/**
 * Visit-close policy: a hit count `bonus` names locks the target — its
 * bonus to the score, the index kept as `ext.lastLock` — and advances; any
 * other hit advances; a blank visit retreats to the last lock, or the first
 * target before one.
 */
export function lockCheckpoint<TExt extends LockTrackExt>(
  bonus: LockBonus,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) => {
    const award = bonus[seat.hitsThisVisit];
    if (award !== undefined)
      return {
        ...seat,
        score: seat.score + award,
        targetIndex: seat.targetIndex + 1,
        ext: {
          ...seat.ext,
          lastLock: seat.targetIndex,
          locks: seat.ext.locks + 1,
        },
      };
    if (seat.hitsThisVisit > 0)
      return { ...seat, targetIndex: seat.targetIndex + 1 };
    return { ...seat, targetIndex: seat.ext.lastLock ?? 0 };
  };
}

/**
 * Visit-close policy: move by the hit count's row of `table`, clamped to
 * the path, and keep the highest index reached in `ext.highestIndex`.
 * A seat no longer in progress does not move.
 */
export function moveTable<TExt extends LadderTrackExt>(
  table: MoveTable,
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) => {
    if (seat.status !== "IN_PROGRESS") return seat;
    const targetIndex = Math.min(
      lastIndex,
      Math.max(0, seat.targetIndex + (table[seat.hitsThisVisit] ?? 0)),
    );
    return {
      ...seat,
      targetIndex,
      ext: {
        ...seat.ext,
        highestIndex: Math.max(seat.ext.highestIndex, targetIndex),
      },
    };
  };
}

/** Visit-close policy: at `index`, `hits` hits in the visit finish (`DONE`) the seat. */
export function finishOnHits<TExt>(
  hits: number,
  index: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex === index && seat.hitsThisVisit >= hits
      ? { ...seat, status: "DONE" }
      : seat;
}
