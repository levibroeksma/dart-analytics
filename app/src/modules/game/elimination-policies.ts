import type {
  DartObservation,
  EliminationSeat,
  KillerExt,
  SeatChange,
} from "./types";

/** The seat a double on 1–20 belongs to, or null for any other dart. */
function doubleOwner(
  seats: readonly EliminationSeat<KillerExt>[],
  dart: DartObservation,
): EliminationSeat<KillerExt> | null {
  const n = dart.hitTargetNumber;
  if (dart.hitZoneKey !== "DOUBLE" || n === null || n < 1 || n > 20) {
    return null;
  }
  return seats.find((seat) => seat.ext.number === n) ?? null;
}

/**
 * Killer V1 (`killer.md`): every dart counts toward the thrower's
 * `dartsThrown`. A double on the thrower's own number toggles Killer status,
 * the first time on setting `dartsToKiller`. A Killer's double on another
 * seat's number takes one of its lives. Nothing else does anything.
 */
export function killerHit(
  thrower: EliminationSeat<KillerExt>,
  seats: readonly EliminationSeat<KillerExt>[],
  dart: DartObservation,
): SeatChange<KillerExt>[] {
  const ext = { ...thrower.ext, dartsThrown: thrower.ext.dartsThrown + 1 };
  const owner = doubleOwner(seats, dart);
  if (owner?.participantRef === thrower.participantRef) {
    const killer = !ext.killer;
    const dartsToKiller =
      ext.dartsToKiller ?? (killer ? ext.dartsThrown : null);
    return [
      {
        participantRef: thrower.participantRef,
        ext: { ...ext, killer, dartsToKiller },
      },
    ];
  }
  if (owner && !owner.out && ext.killer) {
    return [
      { participantRef: owner.participantRef, livesDelta: -1 },
      {
        participantRef: thrower.participantRef,
        ext: { ...ext, livesTaken: ext.livesTaken + 1 },
      },
    ];
  }
  return [{ participantRef: thrower.participantRef, ext }];
}
