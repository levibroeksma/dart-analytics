import type { IntentZoneKey, TargetKey } from "./types";

const NUMBERED_ZONES: readonly IntentZoneKey[] = [
  "DOUBLE",
  "TREBLE",
  "INNER_SINGLE",
  "OUTER_SINGLE",
];
const BULL_ZONES: readonly IntentZoneKey[] = ["INNER_BULL", "OUTER_BULL"];

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
