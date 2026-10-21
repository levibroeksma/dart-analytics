import type {
  BoardTarget,
  DartObservation,
  DartZoneKey,
  TrackTarget,
  ZoneTarget,
} from "./types";

export const BULL_TARGET_NUMBER = 25;

const DOUBLES_PATH: readonly BoardTarget[] = [
  ...Array.from({ length: 20 }, (_, i): BoardTarget => ({
    kind: "DOUBLE",
    number: i + 1,
  })),
  { kind: "BULL" },
];

const NUMBERS_PATH: readonly BoardTarget[] = [
  ...Array.from({ length: 20 }, (_, i): BoardTarget => ({
    kind: "NUMBER",
    number: i + 1,
  })),
  { kind: "BULL" },
];

/**
 * Builds a 21-target path from an explicit order array (a permutation of
 * 1..20 and `BULL_TARGET_NUMBER`) — used when a session's `target_order`
 * config differs from the default ascending order (Singles/Doubles
 * Training's High→Low and Random order modes).
 */
function pathFromOrder(
  order: readonly number[],
  kind: "NUMBER" | "DOUBLE",
): readonly BoardTarget[] {
  return order.map((n): BoardTarget =>
    n === BULL_TARGET_NUMBER ? { kind: "BULL" } : { kind, number: n },
  );
}

export function doublesPath(order?: readonly number[]): readonly BoardTarget[] {
  return order ? pathFromOrder(order, "DOUBLE") : DOUBLES_PATH;
}

export function numbersPath(order?: readonly number[]): readonly BoardTarget[] {
  return order ? pathFromOrder(order, "NUMBER") : NUMBERS_PATH;
}

/**
 * Around the Clock V2's order array for `numbersPath`: 1..20 or 20..1,
 * optionally odds before evens in that direction, BULL always last.
 */
export function clockPath(
  direction: "LOW_TO_HIGH" | "HIGH_TO_LOW",
  oddsFirst: boolean,
): readonly number[] {
  const ascending = Array.from({ length: 20 }, (_, i) => i + 1);
  const numbers = direction === "LOW_TO_HIGH" ? ascending : ascending.reverse();
  const ordered = oddsFirst
    ? [
        ...numbers.filter((n) => n % 2 === 1),
        ...numbers.filter((n) => n % 2 === 0),
      ]
    : numbers;
  return [...ordered, BULL_TARGET_NUMBER];
}

export function targetAt<TTarget extends TrackTarget = BoardTarget>(
  path: readonly TTarget[],
  index: number,
): TTarget {
  const target = path[index];
  if (!target) throw new Error(`No target at index ${index}`);
  return target;
}

const RING_PREFIX: Record<"DOUBLE" | "TREBLE", string> = {
  DOUBLE: "D",
  TREBLE: "T",
};

const RING_ZONE: Record<"DOUBLE" | "TREBLE", DartZoneKey> = {
  DOUBLE: "DOUBLE",
  TREBLE: "TREBLE",
};

const ZONE_LABEL: Record<ZoneTarget["kind"], string> = {
  ANY_DOUBLE: "Any double",
  ANY_TREBLE: "Any treble",
};

/** A path target's display label: `BULL`, `D16` for a double, `T20` for a treble, `Any double`/`Any treble` for a zone, the bare number otherwise. */
export function boardTargetLabel(target: TrackTarget): string {
  if (target.kind === "ANY_DOUBLE" || target.kind === "ANY_TREBLE")
    return ZONE_LABEL[target.kind];
  if (target.kind === "BULL") return "BULL";
  if (target.kind === "NUMBER") return String(target.number);
  return `${RING_PREFIX[target.kind]}${target.number}`;
}

export function boardScore(
  targetNumber: number | null,
  zone: DartZoneKey,
): number {
  if (zone === "MISS") return 0;
  if (zone === "OUTER_BULL") return 25;
  if (zone === "INNER_BULL") return 50;
  if (targetNumber === null) return 0;
  if (zone === "DOUBLE") return targetNumber * 2;
  if (zone === "TREBLE") return targetNumber * 3;
  return targetNumber;
}

/**
 * Whether a dart hits `target`: the bullseye for BULL; any ring for a
 * NUMBER; the named ring for DOUBLE/TREBLE; any double or the bullseye for
 * ANY_DOUBLE; any treble for ANY_TREBLE.
 */
export function isHitOn(
  target: TrackTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "ANY_DOUBLE")
    return (
      observation.hitZoneKey === "DOUBLE" ||
      observation.hitZoneKey === "INNER_BULL"
    );
  if (target.kind === "ANY_TREBLE") return observation.hitZoneKey === "TREBLE";
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      observation.hitZoneKey === "INNER_BULL"
    );
  }
  if (observation.hitTargetNumber !== target.number) return false;
  return target.kind === "NUMBER"
    ? observation.hitZoneKey !== "MISS"
    : observation.hitZoneKey === RING_ZONE[target.kind];
}
