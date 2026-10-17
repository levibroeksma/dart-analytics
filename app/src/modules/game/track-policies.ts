import {
  BULL_TARGET_NUMBER,
  boardScore,
  targetAt,
} from "./board-progression.module";
import type {
  BoardTarget,
  DartObservation,
  DartZoneKey,
  JudgedDart,
  PointsTable,
  TrackSeat,
} from "./types";

/** Target policy: the path entry at the seat's `targetIndex`. */
export function pathTarget<TExt>(
  path: readonly BoardTarget[],
): (seat: TrackSeat<TExt>) => BoardTarget {
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
function sectionOf(target: BoardTarget): number {
  return target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number;
}

/** Hit policy: any ring on a NUMBER target's number, either bull on BULL. */
export function anyRingEitherBull(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
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

/** Visit-close policy: past `lastIndex`, restart at the first target and count a lap. */
export function lapOnWrap<TExt extends { laps: number }>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex > lastIndex
      ? {
          ...seat,
          targetIndex: 0,
          ext: { ...seat.ext, laps: seat.ext.laps + 1 },
        }
      : seat;
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
  _target: BoardTarget,
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
