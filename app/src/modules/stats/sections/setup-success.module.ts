import {
  addCounts,
  aimCountBuckets,
  aimKey,
  countAimed,
} from "./aim-count.module";
import { isGoodLeave } from "../x01-aim-candidates.module";
import type {
  AimBasis,
  AimCountBuckets,
  AimCountMetrics,
  InferredDart,
  InferredSession,
  InferredVisit,
} from "@modules/types";

const VISITS_KEY = "VISITS";
const SETUP_BASES: readonly AimBasis[] = ["ROUTE", "SETUP", "SPLIT"];

function countOpenVisit(metrics: AimCountMetrics, visit: InferredVisit): void {
  const last = visit.darts[visit.darts.length - 1];
  if (
    visit.outcome !== "OPEN" ||
    last === undefined ||
    last.basis === "LARGE_TARGET"
  ) {
    return;
  }
  addCounts(metrics, VISITS_KEY, {
    visits: 1,
    goodLeaves: isGoodLeave(visit.remainingAfter) ? 1 : 0,
  });
}

function countSetupDart(metrics: AimCountMetrics, dart: InferredDart): number {
  if (!SETUP_BASES.includes(dart.basis)) return 0;
  return countAimed(metrics, dart, (aim) => {
    addCounts(metrics, aimKey(dart.basis, aim.kind, dart.resolution), {
      attempts: 1,
      hits: dart.hit ? 1 : 0,
    });
    return 1;
  });
}

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  let sample = 0;
  for (const visit of session.visits) {
    countOpenVisit(metrics, visit);
    for (const dart of visit.darts) sample += countSetupDart(metrics, dart);
  }
  return sample;
}

/**
 * Folds the 501 darts thrown to set up a finish into `setup-success` buckets:
 * per basis, aim kind and resolution, the attempts and hits, plus one
 * `VISITS` row counting the open visits that did not end on a large target and
 * how many of them left a good leave. Ambiguous darts are counted under
 * `AMBIGUOUS_KEY`; `sampleSize` is the resolved setup darts.
 */
export function setupSuccessBuckets(
  sessions: readonly InferredSession[],
  ctx: { to: string; now: Date },
): AimCountBuckets {
  return aimCountBuckets(sessions, ctx, foldSession);
}
