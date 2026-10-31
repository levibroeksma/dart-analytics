import type {
  ClosedVisit,
  DartObservation,
  EliminationSeat,
  PrisonerExt,
  PrisonerShared,
  SeatChange,
  VisitOutcome,
} from "./types";

type Outcome = VisitOutcome<PrisonerExt, PrisonerShared>;
type Seat = EliminationSeat<PrisonerExt>;

type DartEffect = {
  lives: number;
  advance: number;
  captured: number;
  imprisoned: number;
  missed: number;
  lodge: { n: number; by: number } | null;
};

const NO_EFFECT: DartEffect = {
  lives: 0,
  advance: 0,
  captured: 0,
  imprisoned: 0,
  missed: 0,
  lodge: null,
};

/** The target a seat reaches on completing 20: it has won. */
export const WON_TARGET = 21;

/** A seat's extras at the start: target 1, the dart budget, every counter 0. */
export function initialPrisonerExt(darts: number): PrisonerExt {
  return {
    target: 1,
    missed: 0,
    sitting: 0,
    budget: darts,
    captured: 0,
    imprisoned: 0,
  };
}

function captureEffect(
  n: number,
  lodged: PrisonerShared["lodged"],
): DartEffect {
  if ((lodged[n] ?? 0) <= 0) return NO_EFFECT;
  return { ...NO_EFFECT, lives: 1, captured: 1, lodge: { n, by: -1 } };
}

function outerSingleEffect(
  n: number,
  target: number,
  lodged: PrisonerShared["lodged"],
): DartEffect {
  return { ...captureEffect(n, lodged), advance: n === target ? 1 : 0 };
}

function innerSingleEffect(n: number, target: number): DartEffect {
  if (n !== target) return NO_EFFECT;
  return { ...NO_EFFECT, lives: -1, imprisoned: 1, lodge: { n, by: 1 } };
}

function dartEffect(
  target: number,
  lodged: PrisonerShared["lodged"],
  dart: DartObservation,
): DartEffect {
  const n = dart.hitTargetNumber;
  switch (dart.hitZoneKey) {
    case "OUTER_SINGLE":
      return n === null ? NO_EFFECT : outerSingleEffect(n, target, lodged);
    case "INNER_SINGLE":
      return n === null ? NO_EFFECT : innerSingleEffect(n, target);
    case "OUTER_BULL":
    case "INNER_BULL":
      return { ...NO_EFFECT, lives: -1, imprisoned: 1 };
    case "MISS":
      return { ...NO_EFFECT, missed: 1 };
    default:
      return NO_EFFECT;
  }
}

function lodgedAfter(
  lodged: PrisonerShared["lodged"],
  lodge: DartEffect["lodge"],
): PrisonerShared["lodged"] {
  if (!lodge) return lodged;
  return { ...lodged, [lodge.n]: (lodged[lodge.n] ?? 0) + lodge.by };
}

function isNoEffect(effect: DartEffect): boolean {
  return (
    effect.lives === 0 &&
    effect.advance === 0 &&
    effect.captured === 0 &&
    effect.imprisoned === 0 &&
    effect.missed === 0 &&
    effect.lodge === null
  );
}

/**
 * What one dart does to its thrower and the lodged prisoners, judged against
 * the thrower's current target. A seat at target 21 has won: its darts change
 * nothing. A valid hit (outer single) captures when its number holds a
 * prisoner and advances when it is the target; an inner single of the target
 * and either bull imprison (a bull lodges nothing); `MISS` counts toward
 * `missed`; every other dart changes nothing.
 */
export function resolveDart(
  thrower: Seat,
  shared: PrisonerShared,
  dart: DartObservation,
): Outcome {
  const unchanged = { changes: [], shared };
  if (thrower.ext.target >= WON_TARGET) return unchanged;
  const effect = dartEffect(thrower.ext.target, shared.lodged, dart);
  if (isNoEffect(effect)) return unchanged;
  const ext: PrisonerExt = {
    ...thrower.ext,
    target: thrower.ext.target + effect.advance,
    captured: thrower.ext.captured + effect.captured,
    imprisoned: thrower.ext.imprisoned + effect.imprisoned,
    missed: thrower.ext.missed + effect.missed,
  };
  return {
    changes: [
      { participantRef: thrower.participantRef, livesDelta: effect.lives, ext },
    ],
    shared: { ...shared, lodged: lodgedAfter(shared.lodged, effect.lodge) },
  };
}

function walkOrder(seats: readonly Seat[], closerRef: string): Seat[] {
  const at = seats.findIndex((seat) => seat.participantRef === closerRef);
  return [...seats.slice(at + 1), ...seats.slice(0, at + 1)].filter(
    (seat) => !seat.out,
  );
}

function closerExt(closer: Seat): PrisonerExt {
  return {
    ...closer.ext,
    sitting: closer.ext.missed,
    budget: closer.lives - closer.ext.missed,
    missed: 0,
  };
}

/**
 * What a closed Prisoner visit does: the closing seat sits its missed darts
 * out (`budget = held - sitting`, `missed = 0`); the walk then passes seats
 * out and skips any seat with budget 0, clearing its `sitting` and returning
 * its darts, until a seat with budget above 0 becomes `shared.next`.
 */
export function resolveVisit(
  visit: ClosedVisit,
  seats: readonly Seat[],
  shared: PrisonerShared,
): Outcome {
  const closer = seats.find(
    (seat) => seat.participantRef === visit.participantRef,
  );
  const exts = new Map<string, PrisonerExt>();
  if (closer && !closer.out) {
    exts.set(closer.participantRef, closerExt(closer));
  }
  const order = walkOrder(seats, visit.participantRef);
  let next: string | null = null;
  for (let pass = 0; pass < 2 && next === null; pass++) {
    for (const seat of order) {
      const ext = exts.get(seat.participantRef) ?? seat.ext;
      if (ext.budget > 0) {
        next = seat.participantRef;
        break;
      }
      exts.set(seat.participantRef, { ...ext, sitting: 0, budget: seat.lives });
    }
  }
  const changes: SeatChange<PrisonerExt>[] = [...exts].map(
    ([participantRef, ext]) => ({ participantRef, ext }),
  );
  return { changes, shared: { ...shared, next } };
}

/** The side key of a seat that has completed 20 (target 21), else null. */
export function prisonerWinner(seats: readonly Seat[]): string | null {
  return seats.find((seat) => seat.ext.target >= WON_TARGET)?.sideKey ?? null;
}
