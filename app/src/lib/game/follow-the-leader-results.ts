import type {
  FollowTheLeaderResultsSnapshot,
  FollowTheLeaderSeatResult,
} from "@lib/types";
import type {
  FollowTheLeaderSeatState,
  FollowTheLeaderState,
} from "@modules/types";

/** Projects one folded seat to its stored result row. */
export function followTheLeaderSeatResult(
  seat: FollowTheLeaderSeatState,
): FollowTheLeaderSeatResult {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    livesLeft: seat.lives,
    out: seat.out,
  };
}

/** Projects the folded final state to the stored results snapshot; `winningSideKey` is null when no side won. */
export function followTheLeaderResultsSnapshot(
  finalState: FollowTheLeaderState,
): FollowTheLeaderResultsSnapshot {
  return {
    status: "COMPLETE",
    winningSideKey: finalState.winningSideKey,
    outOrder: [...finalState.outOrder],
    seats: finalState.seats.map(followTheLeaderSeatResult),
  };
}
