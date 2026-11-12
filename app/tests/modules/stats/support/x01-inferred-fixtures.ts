import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type {
  BucketedSession,
  DartFact,
  DartZoneKey,
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
