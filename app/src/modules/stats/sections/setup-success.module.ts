import {
  addCounts,
  AMBIGUOUS_KEY,
  aimCountBuckets,
  aimKey,
} from "./aim-count.module";
import { isGoodLeave } from "../x01-aim-candidates.module";
import type {
  AimBasis,
  AimCountMetrics,
  InferredSession,
} from "@modules/types";
import type { SeriesBucket } from "@lib/types";

const VISITS_KEY = "VISITS";
const SETUP_BASES: readonly AimBasis[] = ["ROUTE", "SETUP", "SPLIT"];

function foldSession(
  metrics: AimCountMetrics,
  session: InferredSession,
): number {
  let sample = 0;
  for (const visit of session.visits) {
    const last = visit.darts[visit.darts.length - 1];
    if (
      visit.outcome === "OPEN" &&
      last !== undefined &&
      last.basis !== "LARGE_TARGET"
    ) {
      addCounts(metrics, VISITS_KEY, {
        visits: 1,
        goodLeaves: isGoodLeave(visit.remainingAfter) ? 1 : 0,
      });
    }
    for (const dart of visit.darts) {
      if (!SETUP_BASES.includes(dart.basis)) continue;
      if (dart.aim === null) {
        addCounts(metrics, AMBIGUOUS_KEY, { darts: 1 });
        continue;
      }
      addCounts(metrics, aimKey(dart.basis, dart.aim.kind, dart.resolution), {
        attempts: 1,
        hits: dart.hit ? 1 : 0,
      });
      sample += 1;
    }
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
): SeriesBucket<AimCountMetrics>[] {
  return aimCountBuckets(sessions, ctx, foldSession);
}
