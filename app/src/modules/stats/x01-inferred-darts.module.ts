import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import { checkoutDarts } from "@modules/game/double-attempt.module";
import {
  FINISHING_ZONES,
  isFinishingDart,
} from "@modules/game/highest-checkout.module";
import type { BucketedSession, StagedVisit } from "@modules/types";
import { candidatesFor } from "./x01-aim-candidates.module";
import { isInferredAimHit, resolveAim } from "./x01-aim-resolution.module";
import type { TargetKey } from "@lib/types";
import type {
  AimCandidate,
  InferredDart,
  InferredSession,
  InferredVisit,
} from "./types";

function hasUnlocatedDart(session: BucketedSession): boolean {
  return session.visits.some((visit) =>
    visit.darts.some(
      (dart) => dart.locationX === null || dart.locationY === null,
    ),
  );
}

function finishKeyOf(candidates: readonly AimCandidate[]): TargetKey | null {
  const aim = candidates.find((entry) => entry.basis === "FINISH")?.aim;
  return aim === undefined || aim.kind === "WIRE" ? null : aim.key;
}

function inferredVisit(visit: StagedVisit): InferredVisit {
  const darts: InferredDart[] = [];
  let outcome: InferredVisit["outcome"] = "OPEN";
  let remainingAfter = visit.startingRemaining;

  for (const [index, { remaining, dart }] of checkoutDarts(visit).entries()) {
    const dartNumber = (index + 1) as 1 | 2 | 3;
    const candidates = candidatesFor({
      remaining,
      dartsLeft: (4 - dartNumber) as 1 | 2 | 3,
      earlierDartsInVisit: visit.darts.slice(0, index),
    });
    const x = dart.locationX!;
    const y = dart.locationY!;
    const resolved = resolveAim(candidates, { x, y });
    darts.push({
      remaining,
      dartNumber,
      basis: resolved.basis,
      resolution: resolved.resolution,
      aim: resolved.aim,
      hit:
        resolved.aim !== null &&
        isInferredAimHit(resolved.aim, dart.hitTargetNumber, dart.hitZoneKey),
      hitNumber: dart.hitTargetNumber,
      hitZone: dart.hitZoneKey,
      x,
      y,
      score: dart.score,
      candidateKeys: candidates.map((entry) => entry.aim.key),
      finishKey: finishKeyOf(candidates),
    });

    if (isFinishingDart(remaining, dart)) {
      outcome = "FINISHED";
      remainingAfter = 0;
      break;
    }
    const attempt = resolveCheckoutAttempt(
      remaining,
      dart.score,
      FINISHING_ZONES.has(dart.hitZoneKey),
    );
    if (attempt.busted) {
      outcome = "BUST";
      remainingAfter = visit.startingRemaining;
      break;
    }
    remainingAfter = attempt.remainingAfter;
  }

  return {
    startingRemaining: visit.startingRemaining,
    outcome,
    remainingAfter,
    darts,
  };
}

/**
 * Walks each 501 session dart by dart, resolving every dart's inferred aim
 * from its remaining score and darts left. A session that failed to decode,
 * or holds a dart without coordinates, is counted in `skippedSessions` and
 * left out (x01 inferred-aim design §7).
 */
export function inferredSessions(sessions: readonly BucketedSession[]): {
  sessions: InferredSession[];
  skippedSessions: number;
} {
  const walked: InferredSession[] = [];
  let skippedSessions = 0;
  for (const session of sessions) {
    if (session.undecodable || hasUnlocatedDart(session)) {
      skippedSessions += 1;
      continue;
    }
    walked.push({
      sessionId: session.sessionId,
      bucketStart: session.bucketStart,
      bucketEnd: session.bucketEnd,
      visits: session.visits.map(inferredVisit),
    });
  }
  return { sessions: walked, skippedSessions };
}
