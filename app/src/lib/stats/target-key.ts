import type { DartZoneKey } from "@modules/types";
import type { IntentZoneKey, TargetKey } from "./types";

const NUMBERED_ZONES: readonly IntentZoneKey[] = [
  "DOUBLE",
  "TREBLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
  "NUMBER",
];
const BULL_ZONES: readonly IntentZoneKey[] = [
  "INNER_BULL",
  "OUTER_BULL",
  "BULL",
];

export function formatTargetKey(
  number: number,
  zone: IntentZoneKey,
): TargetKey {
  return `${zone}:${number}`;
}

/** Parses a `TargetKey`: 1-20 on the numbered rings, only 25 on the bulls; anything else is `null`. */
export function parseTargetKey(
  value: string,
): { number: number; zone: IntentZoneKey } | null {
  const [zone, numberPart] = value.split(":");
  if (numberPart === undefined || numberPart === "") return null;
  const number = Number(numberPart);
  if (!Number.isInteger(number)) return null;

  if ((NUMBERED_ZONES as readonly string[]).includes(zone ?? "")) {
    if (number < 1 || number > 20) return null;
    return { number, zone: zone as IntentZoneKey };
  }
  if ((BULL_ZONES as readonly string[]).includes(zone ?? "")) {
    if (number !== 25) return null;
    return { number, zone: zone as IntentZoneKey };
  }
  return null;
}

/** Display label for a `TargetKey` (`DOUBLE:16` -> `D16`); an unparsable key comes back unchanged. */
export function targetLabel(value: string): string {
  const parsed = parseTargetKey(value);
  if (parsed === null) return value;
  const { number, zone } = parsed;
  switch (zone) {
    case "DOUBLE":
      return `D${number}`;
    case "TREBLE":
      return `T${number}`;
    case "INNER_SINGLE":
      return `${number} inner`;
    case "OUTER_SINGLE":
      return `${number} outer`;
    case "NUMBER":
      return String(number);
    case "INNER_BULL":
      return "BULL";
    case "OUTER_BULL":
      return "25";
    default:
      return "Bull";
  }
}

/**
 * Whether an observed dart counts as a hit on `aim` (phase-4 decision 2).
 * `NUMBER:n` is hit by any ring of `n` except a `MISS`; `BULL:25` is hit by
 * either bull ring; every other (stored) zone keeps phase-2's exact-pair
 * rule.
 */
export function isAimHit(
  aim: { number: number; zone: IntentZoneKey },
  hit: { number: number | null; zone: DartZoneKey },
): boolean {
  if (aim.zone === "NUMBER") {
    return hit.number === aim.number && hit.zone !== "MISS";
  }
  if (aim.zone === "BULL") {
    return hit.zone === "OUTER_BULL" || hit.zone === "INNER_BULL";
  }
  return hit.number === aim.number && hit.zone === aim.zone;
}
