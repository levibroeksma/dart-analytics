import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";
import { checkoutDarts } from "@modules/game/double-attempt.module";
import {
  FINISHING_ZONES,
  isFinishingDart,
} from "@modules/game/highest-checkout.module";
import type {
  AimCandidate,
  BucketedSession,
  DartFact,
  InferredDart,
  InferredSession,
  InferredVisit,
  StagedVisit,
} from "@modules/types";
import { candidatesFor } from "./x01-aim-candidates.module";
import { isInferredAimHit, resolveAim } from "./x01-aim-resolution.module";

/** Whether any dart of `session` was captured without board coordinates. */
function hasUnlocatedDart(session: BucketedSession): boolean {
  return session.visits.some((visit) =>
    visit.darts.some(
      (dart) => dart.locationX === null || dart.locationY === null,
    ),
  );
}

/** The key of the `FINISH` candidate's aim, when a double or the bull was on; `null` otherwise. */
function finishKeyOf(
  candidates: readonly AimCandidate[],
): InferredDart["finishKey"] {
  const aim = candidates.find((entry) => entry.basis === "FINISH")?.aim;
  return aim === undefined || aim.kind === "WIRE" ? null : aim.key;
}

/** Where a visit stands after a dart: still open, finished, or bust. */
type VisitState = Pick<InferredVisit, "outcome" | "remainingAfter">;

/** The visit's state after `dart`, thrown at `remaining`: finished at 0, bust back to the visit's start, or open at the new remaining. */
function stateAfter(
  visit: StagedVisit,
  remaining: number,
  dart: DartFact,
): VisitState {
  if (isFinishingDart(remaining, dart)) {
    return { outcome: "FINISHED", remainingAfter: 0 };
  }
  const attempt = resolveCheckoutAttempt(
    remaining,
    dart.score,
    FINISHING_ZONES.has(dart.hitZoneKey),
  );
  if (attempt.busted) {
    return { outcome: "BUST", remainingAfter: visit.startingRemaining };
  }
  return { outcome: "OPEN", remainingAfter: attempt.remainingAfter };
}

/** The `index`-th dart of `visit`, thrown at `remaining`, with its candidates resolved against where it landed. */
function inferredDart(
  visit: StagedVisit,
  index: number,
  remaining: number,
  dart: DartFact,
): InferredDart {
  const dartNumber = (index + 1) as 1 | 2 | 3;
  const candidates = candidatesFor({
    remaining,
    dartsLeft: (4 - dartNumber) as 1 | 2 | 3,
    earlierDartsInVisit: visit.darts.slice(0, index),
  });
  const x = dart.locationX!;
  const y = dart.locationY!;
  const resolved = resolveAim(candidates, { x, y });
  return {
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
  };
}

/** Walks `visit` dart by dart until it finishes or busts, inferring each dart's aim on the way. */
function inferredVisit(visit: StagedVisit): InferredVisit {
  const darts: InferredDart[] = [];
  let state: VisitState = {
    outcome: "OPEN",
    remainingAfter: visit.startingRemaining,
  };
  for (const [index, { remaining, dart }] of checkoutDarts(visit).entries()) {
    darts.push(inferredDart(visit, index, remaining, dart));
    state = stateAfter(visit, remaining, dart);
    if (state.outcome !== "OPEN") break;
  }
  return { startingRemaining: visit.startingRemaining, ...state, darts };
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
