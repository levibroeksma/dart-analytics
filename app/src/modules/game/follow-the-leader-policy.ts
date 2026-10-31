import type {
  BedFact,
  ClosedVisit,
  DartObservation,
  EliminationSeat,
  FollowTheLeaderExt,
  FollowTheLeaderShared,
  SeatChange,
  VisitOutcome,
} from "./types";

type Outcome = VisitOutcome<FollowTheLeaderExt, FollowTheLeaderShared>;

const RING_BY_ZONE: Record<string, BedFact["ring"] | undefined> = {
  SINGLE: "SINGLE",
  INNER_SINGLE: "SINGLE",
  OUTER_SINGLE: "SINGLE",
  DOUBLE: "DOUBLE",
  TREBLE: "TREBLE",
  OUTER_BULL: "OUTER_BULL",
  INNER_BULL: "INNER_BULL",
};

/** The bed a dart landed in, with both single beds as one ring and bulls numberless; null off the board. */
export function bedOf(dart: DartObservation): BedFact | null {
  const ring = RING_BY_ZONE[dart.hitZoneKey];
  if (!ring) return null;
  if (ring === "OUTER_BULL" || ring === "INNER_BULL") {
    return { number: null, ring };
  }
  return dart.hitTargetNumber === null
    ? null
    : { number: dart.hitTargetNumber, ring };
}

/** Whether two beds share number and ring; the two bulls differ. */
export function sameBed(a: BedFact, b: BedFact): boolean {
  return a.number === b.number && a.ring === b.ring;
}

function withFailed(
  failed: readonly string[],
  ref: string,
  failing: boolean,
): string[] {
  const rest = failed.filter((f) => f !== ref);
  return failing ? [...rest, ref] : rest;
}

function loseLife(ref: string): SeatChange<FollowTheLeaderExt>[] {
  return [{ participantRef: ref, livesDelta: -1 }];
}

function resolveSetting(
  visit: ClosedVisit,
  shared: FollowTheLeaderShared,
): Outcome {
  const bed = visit.darts[0] ? bedOf(visit.darts[0]) : null;
  if (!bed) {
    return {
      changes: [],
      shared: { ...shared, retryRef: visit.participantRef },
    };
  }
  return {
    changes: [],
    shared: {
      target: bed,
      leaderRef: visit.participantRef,
      failed: [],
      retryRef: null,
    },
  };
}

function resolveMatch(
  visit: ClosedVisit,
  target: BedFact,
  shared: FollowTheLeaderShared,
): Outcome {
  const ref = visit.participantRef;
  const matchIdx = visit.darts.findIndex((d) => {
    const bed = bedOf(d);
    return bed !== null && sameBed(bed, target);
  });
  const lastBed = bedOf(visit.darts[visit.darts.length - 1]);
  const matched = matchIdx >= 0;
  if (!lastBed || !matched) {
    return {
      changes: loseLife(ref),
      shared: { ...shared, failed: withFailed(shared.failed, ref, !matched) },
    };
  }
  if (matchIdx < visit.darts.length - 1) {
    return {
      changes: [],
      shared: { ...shared, target: lastBed, leaderRef: ref, failed: [] },
    };
  }
  return {
    changes: [],
    shared: { ...shared, failed: withFailed(shared.failed, ref, false) },
  };
}

/**
 * What one closed Follow the Leader visit does (`follow-the-leader.md`): a
 * keep clears the failed set; an opening or leader turn sets the target from
 * its one dart or asks a re-throw off the board; a matcher fails, matches,
 * or matches and sets with the darts left. Fails resolve on the visit, not
 * per dart.
 */
export function resolveVisit(
  visit: ClosedVisit,
  _seats: readonly EliminationSeat<FollowTheLeaderExt>[],
  shared: FollowTheLeaderShared,
): Outcome {
  if (visit.kept) return { changes: [], shared: { ...shared, failed: [] } };
  if (shared.target === null || visit.participantRef === shared.leaderRef) {
    return resolveSetting(visit, shared);
  }
  return resolveMatch(visit, shared.target, shared);
}

/** Whether the leader may keep: it is active, a target stands, and every other seat still in failed since. */
export function keepAllowed(
  seats: readonly EliminationSeat<FollowTheLeaderExt>[],
  shared: FollowTheLeaderShared,
  activeRef: string,
): boolean {
  return (
    shared.target !== null &&
    shared.leaderRef === activeRef &&
    seats.every(
      (seat) =>
        seat.out ||
        seat.participantRef === activeRef ||
        shared.failed.includes(seat.participantRef),
    )
  );
}
