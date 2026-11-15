import { MIN_TARGET_SAMPLE } from "@lib/stats/constants";
import { ambiguousDarts } from "./aim-rows";
import { describeDrift } from "./drift-describe";
import { DARTS, basisRows, dartRow } from "./drift-row";
import type { AimRows, DriftCard } from "./types";

/** The aim drift card over summed `aim-drift` rows, pooled over aim and resolution. */
export function driftCard(rows: AimRows): DriftCard {
  const byDart = DARTS.map((dart) => dartRow(rows, dart));
  const [first] = byDart;
  const sentence =
    first.meanDx === null || first.meanDy === null
      ? null
      : describeDrift(first.meanDx, first.meanDy);
  return {
    headline: first.n < MIN_TARGET_SAMPLE ? null : sentence,
    n: first.n,
    byDart,
    byBasis: basisRows(rows),
    ambiguous: ambiguousDarts(rows),
  };
}
