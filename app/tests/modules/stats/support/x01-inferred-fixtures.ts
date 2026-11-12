import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { inferredSessions } from "@modules/stats/x01-inferred-darts.module";
import type {
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
