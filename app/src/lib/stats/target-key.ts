import type { DartZoneKey } from "@modules/types";
import {
  areBoardNeighbours,
  SECTOR_ORDER,
} from "@lib/game/board/board-geometry.module";
import type { IntentZoneKey, TargetKey, WireKey } from "./types";

const BOARD_NUMBERS: ReadonlySet<number> = new Set(SECTOR_ORDER);
const BULL_NUMBERS: ReadonlySet<number> = new Set([25]);

/** The numbers each target zone accepts: 1-20 on the numbered rings, only 25 on the bulls. */
const ZONE_NUMBERS: ReadonlyMap<string, ReadonlySet<number>> = new Map([
  ["DOUBLE", BOARD_NUMBERS],
  ["TREBLE", BOARD_NUMBERS],
  ["INNER_SINGLE", BOARD_NUMBERS],
  ["OUTER_SINGLE", BOARD_NUMBERS],
  ["SINGLE", BOARD_NUMBERS],
  ["NUMBER", BOARD_NUMBERS],
  ["INNER_BULL", BULL_NUMBERS],
  ["OUTER_BULL", BULL_NUMBERS],
  ["BULL", BULL_NUMBERS],
]);

/** The rings that count as a hit on `BULL:25`: either bull. */
const BULL_HIT_ZONES: ReadonlySet<DartZoneKey> = new Set([
  "OUTER_BULL",
  "INNER_BULL",
]);

/** The aim zones a picker target covers when they differ from its own: `NUMBER:n` also covers ATC V2's `OUTER_SINGLE:n` aim. */
const TARGET_AIM_ZONES: Partial<
  Record<IntentZoneKey, readonly IntentZoneKey[]>
> = {
  NUMBER: ["NUMBER", "OUTER_SINGLE"],
};

/** Display template per zone; `{n}` stands for the target number. */
const LABEL_TEMPLATES: Record<IntentZoneKey, string> = {
  DOUBLE: "D{n}",
  TREBLE: "T{n}",
  INNER_SINGLE: "{n} inner",
  OUTER_SINGLE: "{n} outer",
  SINGLE: "S{n}",
  NUMBER: "{n}",
  INNER_BULL: "BULL",
  OUTER_BULL: "{n}",
  BULL: "Bull",
};

/** Builds the `ZONE:n` key for `number` on `zone`. */
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
  const [zone = "", numberPart] = value.split(":");
  const number = Number(numberPart);
  return ZONE_NUMBERS.get(zone)?.has(number)
    ? { number, zone: zone as IntentZoneKey }
    : null;
}

/** Builds the `WIRE:a-b` key for two board-adjacent numbers, ordered with the smaller first; throws when they are not neighbours. */
export function formatWireKey(a: number, b: number): WireKey {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  if (!areBoardNeighbours(low, high)) {
    throw new RangeError(
      `WIRE needs board-adjacent numbers, got ${a} and ${b}`,
    );
  }
  return `WIRE:${low}-${high}`;
}

/** Parses a `WireKey` into its two numbers, smaller first; `null` unless both are board-adjacent and written `a < b`. */
export function parseWireKey(value: string): readonly [number, number] | null {
  const match = /^WIRE:(\d+)-(\d+)$/.exec(value);
  if (match === null) return null;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (low >= high || !areBoardNeighbours(low, high)) return null;
  return [low, high];
}

/** Display label for a `TargetKey` (`DOUBLE:16` -> `D16`) or `WireKey` (`WIRE:6-10` -> `6/10`); an unparsable key comes back unchanged. */
export function targetLabel(value: string): string {
  const wire = parseWireKey(value);
  if (wire !== null) return `${wire[0]}/${wire[1]}`;
  const parsed = parseTargetKey(value);
  if (parsed === null) return value;
  return LABEL_TEMPLATES[parsed.zone].replace("{n}", String(parsed.number));
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
  if (aim.zone === "BULL") return BULL_HIT_ZONES.has(hit.zone);
  const zoneMatches =
    aim.zone === "NUMBER" ? hit.zone !== "MISS" : hit.zone === aim.zone;
  return hit.number === aim.number && zoneMatches;
}

/**
 * Whether a derived aim key belongs to a picker `target` (`NUMBER:n` or
 * `BULL:25`): `NUMBER:n` also covers ATC V2's `OUTER_SINGLE:n` aim, since the
 * picker's key space ignores the ring; any other target is an exact key match.
 */
export function aimMatchesTarget(
  aimKey: string,
  target: { number: number; zone: IntentZoneKey },
): boolean {
  const aim = parseTargetKey(aimKey);
  if (aim === null || aim.number !== target.number) return false;
  return (TARGET_AIM_ZONES[target.zone] ?? [target.zone]).includes(aim.zone);
}
