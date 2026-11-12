import { classify, zoneCentroid } from "@lib/game/board/board-geometry.module";
import { candidatesFor } from "@modules/stats/x01-aim-candidates.module";
import { resolveAim } from "@modules/stats/x01-aim-resolution.module";
import { inferredSessions } from "@modules/stats/x01-inferred-darts.module";
import type {
  AimBasis,
  BucketedSession,
  DartFact,
  DartZoneKey,
  InferredSession,
  StagedVisit,
} from "@modules/types";

export function dart(zone: DartZoneKey, n: number, score: number): DartFact {
  const point = zoneCentroid(n, zone)!;
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: n,
    hitZoneKey: zone,
    score,
    locationX: point.x,
    locationY: point.y,
  };
}

export function at(
  x: number,
  y: number,
  zone: DartZoneKey,
  n: number | null,
  score: number,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: n,
    hitZoneKey: zone,
    score,
    locationX: x,
    locationY: y,
  };
}

export function visit(
  startingRemaining: number,
  darts: DartFact[],
  stageId = "leg-1",
): StagedVisit {
  return {
    startingRemaining,
    countedTotal: darts.reduce((sum, d) => sum + d.score, 0),
    darts,
    stageId,
    stageTypeKey: "LEG",
  };
}

export function session(
  visits: StagedVisit[],
  sessionId = "session-1",
): BucketedSession {
  return {
    sessionId,
    gameTypeKey: "501",
    rulesetVersionKey: "501_V1",
    undecodable: false,
    bucketStart: "2026-01-01T00:00:00.000Z",
    bucketEnd: "2026-02-01T00:00:00.000Z",
    visits,
  };
}

export const CTX = {
  to: "2026-02-01T00:00:00.000Z",
  now: new Date("2026-03-01T00:00:00.000Z"),
};

export function inferred(visits: StagedVisit[]): InferredSession[] {
  return inferredSessions([session(visits)]).sessions;
}

export function scale(
  point: { x: number; y: number },
  k: number,
): { x: number; y: number } {
  return { x: point.x * k, y: point.y * k };
}

/**
 * A first dart at `remaining` landing between `from` and `to` where the two
 * candidates are near-equidistant, just on the side whose basis is `nearer`:
 * bisects the segment for the point where the nearest candidate's basis flips,
 * then steps a hair towards `nearer`. Callers assert the resolution is
 * `AMBIGUOUS` before relying on it.
 */
export function ambiguousDart(
  remaining: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  nearer: AimBasis,
): DartFact {
  const candidates = candidatesFor({
    remaining,
    dartsLeft: 3,
    earlierDartsInVisit: [],
  });
  const pointAt = (t: number) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  });
  const basisAt = (t: number) => resolveAim(candidates, pointAt(t)).basis;
  const fromBasis = basisAt(0);
  let low = 0;
  let high = 1;
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2;
    if (basisAt(mid) === fromBasis) low = mid;
    else high = mid;
  }
  const point = pointAt(nearer === fromBasis ? low - 0.001 : high + 0.001);
  const landed = classify(point.x, point.y);
  return at(
    point.x,
    point.y,
    landed.zoneKey,
    landed.targetNumber,
    landed.score,
  );
}
