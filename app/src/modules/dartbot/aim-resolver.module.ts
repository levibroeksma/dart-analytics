import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { BoardPoint } from "@lib/types";
import type { SkillProfile, ThrowIntent } from "./types";

export function resolveAimPoint(
  intent: ThrowIntent,
  profile: SkillProfile,
): BoardPoint {
  const centroid = zoneCentroid(intent.targetNumber, intent.zoneKey);
  if (centroid === null) {
    return { x: 0, y: 0 };
  }
  const radius = Math.hypot(centroid.x, centroid.y);
  if (radius === 0) {
    return centroid;
  }
  const scale = (radius + profile.bedOffsetMm) / radius;
  return { x: centroid.x * scale, y: centroid.y * scale };
}
