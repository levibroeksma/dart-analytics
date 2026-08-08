import { zoneCentroid } from "./board-geometry.module";
import type { MissMargin, MissMarginInput } from "./types";

/**
 * How far a dart landed from the centre of the zone its ruleset declared, and
 * in which direction. Returns null when there is nothing to measure against —
 * the ruleset declared no intent, the landing point was never seen, or the
 * declared zone has no single centre (bare `SINGLE`, `MISS`). 501 and Score
 * Training declare no intent, so every dart in those games returns null;
 * that is the designed outcome, not a gap.
 *
 * The centroid comes from the shared board-geometry module rather than from
 * SQL, so the client, the Worker and this read path all measure from the same
 * point.
 */
export function missMargin(dart: MissMarginInput): MissMargin | null {
  if (dart.intendedZoneKey === null) return null;
  if (dart.locationX === null || dart.locationY === null) return null;

  const centre = zoneCentroid(dart.intendedTargetNumber, dart.intendedZoneKey);
  if (centre === null) return null;

  const dx = dart.locationX - centre.x;
  const dy = dart.locationY - centre.y;

  return {
    distanceMm: Math.sqrt(dx * dx + dy * dy),
    bearingDegrees: (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360,
  };
}
