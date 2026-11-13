import {
  addCounts,
  aimCountBuckets,
  aimKey,
  countAimed,
} from "./aim-count.module";
import { isGoodLeave } from "../x01-leave-rank.module";
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

/** Whether `visit` stayed open after a last dart thrown at something other than a large target. */
function isOpenSetupVisit(visit: InferredVisit): boolean {
  const last = visit.darts.at(-1);
  return (
    visit.outcome === "OPEN" &&
    last !== undefined &&
    last.basis !== "LARGE_TARGET"
  );
}

/** Counts `visit` on the `VISITS` row, and whether it left a good leave, when it is an open setup visit. */
function countOpenVisit(metrics: AimCountMetrics, visit: InferredVisit): void {
  if (!isOpenSetupVisit(visit)) return;
  addCounts(metrics, VISITS_KEY, {
    visits: 1,
    goodLeaves: Number(isGoodLeave(visit.remainingAfter)),
  });
}

/** Counts a resolved setup dart (route, setup or split) as an attempt, and whether it hit. */
function countSetupDart(metrics: AimCountMetrics, dart: InferredDart): number {
  if (!SETUP_BASES.includes(dart.basis)) return 0;
  return countAimed(metrics, dart, (aim) => {
    addCounts(metrics, aimKey(dart.basis, aim.kind, dart.resolution), {
      attempts: 1,
      hits: Number(dart.hit),
    });
    return 1;
  });
}

/** Counts each open setup visit of `session` and each of its setup darts. */
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
