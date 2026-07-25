import type { BoardTarget, DartObservation, DartZoneKey } from "./types";

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

export function doublesPath(): readonly BoardTarget[] {
  return DOUBLES_PATH;
}

export function numbersPath(): readonly BoardTarget[] {
  return NUMBERS_PATH;
}

export function targetAt(
  path: readonly BoardTarget[],
  index: number,
): BoardTarget {
  const target = path[index];
  if (!target) throw new Error(`No target at index ${index}`);
  return target;
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

export function isHitOn(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      observation.hitZoneKey === "INNER_BULL"
    );
  }
  if (observation.hitTargetNumber !== target.number) return false;
  return target.kind === "DOUBLE"
    ? observation.hitZoneKey === "DOUBLE"
    : observation.hitZoneKey !== "MISS";
}
