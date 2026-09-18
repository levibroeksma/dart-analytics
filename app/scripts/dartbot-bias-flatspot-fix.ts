import { fileURLToPath } from "node:url";
import { LEVEL_SKILL_TABLE } from "../src/modules/dartbot/skill-profile.module";

/** Geometric interpolation between two bracket values across `steps`
 * segments, returning the interior points. Ratio-preserving, matching D-N's
 * log-space method, applied locally to one flat spot at a time. */
export function interiorPoints(
  low: number,
  high: number,
  steps: number,
): number[] {
  const ratio = Math.pow(low / high, 1 / steps);
  const points: number[] = [];
  let value = high;
  for (let i = 0; i < steps - 1; i++) {
    value *= ratio;
    points.push(Number(value.toFixed(2)));
  }
  return points;
}

/** Each flat spot, with the nearest DISTINCT neighbours that bracket it.
 * biasX skips level 6: its measured -5.0 is a sign anomaly, not a curve
 * point, so the 7/8 pair brackets against level 5. biasY uses level 6,
 * whose 3.1 sits correctly on the curve. */
export const SPOTS = [
  { field: "biasXMm", levels: [7, 8], from: 5, to: 9 },
  { field: "biasXMm", levels: [9, 10], from: 8, to: 11 },
  { field: "biasXMm", levels: [12, 13], from: 11, to: 14 },
  { field: "biasYMm", levels: [7, 8], from: 6, to: 9 },
  { field: "biasYMm", levels: [9, 10], from: 8, to: 11 },
  { field: "biasYMm", levels: [12, 13], from: 11, to: 14 },
] as const;

/** Runs every `SPOTS` entry against `LEVEL_SKILL_TABLE`, resolving each flat
 * spot's pair from its bracketing neighbours — falling back to an
 * already-resolved value from an earlier entry when two spots share a
 * neighbour. Returns the per-field, per-level replacement table Task 2
 * pastes into `LEVEL_SKILL_TABLE`. */
export function deriveFlatSpotValues(): Record<string, Record<number, number>> {
  const resolved: Record<string, Record<number, number>> = {
    biasXMm: {},
    biasYMm: {},
  };

  for (const spot of SPOTS) {
    const field = spot.field;
    const high =
      resolved[field][spot.from] ?? LEVEL_SKILL_TABLE[spot.from][field];
    const low = resolved[field][spot.to] ?? LEVEL_SKILL_TABLE[spot.to][field];
    const steps = spot.to - spot.from;
    const points = interiorPoints(low, high, steps);
    const offset = spot.levels[0] - spot.from - 1;
    spot.levels.forEach((level, i) => {
      resolved[field][level] = points[offset + i];
    });
  }

  return resolved;
}

function main(): void {
  const resolved = deriveFlatSpotValues();
  for (const level of [7, 8, 9, 10, 12, 13]) {
    console.log(
      `${level}: biasXMm ${resolved.biasXMm[level]}, biasYMm ${resolved.biasYMm[level]}`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
