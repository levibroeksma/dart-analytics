import { sumLadderTargets } from "./ladder-totals";
import type {
  AceMeasure,
  CheckoutComparison,
  CheckoutInput,
  PeakMeasure,
  Ratio,
} from "@lib/types";

type Counted = {
  finish: Ratio;
  recovery: Ratio;
  bust: Ratio;
  peak: number | null;
  goes: number;
};

function count(input: CheckoutInput): Counted {
  const { totals, maxTarget, afterMiss, recovered } = sumLadderTargets(
    input.ladder,
  );
  let goes = 0;
  let finished = 0;
  for (const t of totals.values()) {
    goes += t.attempts;
    finished += t.successes;
  }
  let visits = 0;
  let busts = 0;
  for (const bucket of input.busts) {
    for (const m of Object.values(bucket.metrics)) {
      visits += m.visits;
      busts += m.busts;
    }
  }
  return {
    finish: { part: finished, whole: goes },
    recovery: { part: recovered, whole: afterMiss },
    bust: { part: busts, whole: visits },
    peak: maxTarget,
    goes,
  };
}

function measure(
  pick: (c: Counted) => Ratio,
  current: Counted,
  previous: Counted | null,
): AceMeasure {
  return {
    current: pick(current),
    previous: previous === null ? null : pick(previous),
  };
}

function peakMeasure(current: Counted, previous: Counted | null): PeakMeasure {
  return {
    current: current.peak,
    previous: previous === null ? null : previous.peak,
    currentGoes: current.goes,
    previousGoes: previous === null ? null : previous.goes,
  };
}

/** The four Checkout comparison measures from the current period's reads and the preceding period's (`null` for All Time): finish rate over goes, the highest target, recovery over goes after a failed go, and bust rate over visits. */
export function checkoutComparison(
  current: CheckoutInput,
  previous: CheckoutInput | null,
): CheckoutComparison {
  const now = count(current);
  const before = previous === null ? null : count(previous);
  return {
    finish: measure((c) => c.finish, now, before),
    peak: peakMeasure(now, before),
    recovery: measure((c) => c.recovery, now, before),
    bust: measure((c) => c.bust, now, before),
  };
}
