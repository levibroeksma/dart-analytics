import { accuracyDisplay } from "@lib/game/play-visit-stats";
import { targetScoringTargetLabel } from "@modules/training/exercises/target-scoring.engine.module";
import { stepMetrics } from "@modules/stats/step-metrics.module";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
  TargetScoringState,
  SwitchingTargetScoringState,
  ScoreThresholdState,
  BullseyeCheckoutState,
  BullUpState,
  CheckoutSequenceState,
  RandomCheckoutState,
  RoutineStatRow,
  RoutineStepSummary,
} from "@modules/types";
import type {
  TuodSeatResult,
  ScoreTrainingSeatResult,
  OneTwentyOneSeatResult,
  AroundTheClockSeatResult,
} from "@lib/types";

const NO_VALUE = "—";

/**
 * Stands in for `facts` on every kind but Switching, whose hit count is the
 * only one `stepMetrics` derives by replaying dart facts rather than
 * reading engine state alone (`stepMetrics`'s `switchingHits`). Every other
 * `summarise*` function takes its engine state only, so it has no real
 * facts to pass and none of its metrics needs them.
 */
const NO_FACTS: EngineFacts = { stages: [], turns: [] };

/**
 * A rate over no darts is not 0% — it is nothing to report, so an
 * untouched exercise reads as a dash rather than a failed one.
 */
function hitRateRow(hits: number, darts: number): RoutineStatRow {
  return {
    label: "Hit rate",
    value: darts === 0 ? NO_VALUE : accuracyDisplay(hits, darts),
  };
}

/**
 * Switching scores a dart only when it lands on the target that dart was
 * thrown at, and every `DartFact` carries both numbers, so the hit count
 * needs neither the config nor the ruleset's scoring table.
 */
export function summariseSwitching(
  state: SwitchingState,
  facts: EngineFacts,
): RoutineStepSummary {
  const { points, darts, hits } = stepMetrics("SWITCHING", state, facts);
  return {
    stepKey: "SWITCHING",
    label: "Switching",
    rows: [
      { label: "Points", value: String(points) },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}

/**
 * Double Pattern awards exactly one point per double hit, so the engine's
 * `totalPoints` is the hit count and the rate needs no fact replay.
 */
export function summariseDoublePattern(
  state: DoublePatternState,
): RoutineStepSummary {
  const { hits, darts } = stepMetrics("DOUBLE_PATTERN", state, NO_FACTS);
  return {
    stepKey: "DOUBLE_PATTERN",
    label: "Doubles",
    rows: [
      { label: "Doubles hit", value: String(hits) },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}

/**
 * Target Scoring's result is its best chain — overall, then per target in
 * list order. The engine already folds a chain still live at expiry into
 * both, and counts its own hits, so no fact replay is needed.
 */
export function summariseTargetScoring(
  state: TargetScoringState,
): RoutineStepSummary {
  const { bestChain, darts, hits } = stepMetrics(
    "TARGET_SCORING",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "TARGET_SCORING",
    label: "Target Scoring",
    rows: [
      { label: "Best chain", value: String(bestChain) },
      ...state.bestChainByTarget.map(({ targetNumber, bestChain }) => ({
        label: `Best on ${targetScoringTargetLabel(targetNumber)}`,
        value: String(bestChain),
      })),
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}

/**
 * Switching Target Scoring's result is its best chain, then how many full
 * passes through the sequence the run made. The engine folds a chain still
 * live at expiry into `bestChain`, so no fact replay is needed.
 */
export function summariseSwitchingTargetScoring(
  state: SwitchingTargetScoringState,
): RoutineStepSummary {
  const { bestChain, sequences, darts, hits } = stepMetrics(
    "SWITCHING_TARGET_SCORING",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "SWITCHING_TARGET_SCORING",
    label: "Switching Target Scoring",
    rows: [
      { label: "Best chain", value: String(bestChain) },
      { label: "Sequences", value: String(sequences) },
      { label: "Darts", value: String(darts) },
      hitRateRow(hits, darts),
    ],
  };
}

/**
 * 65 or More's result is how many visits beat the threshold, out of how
 * many were judged. An unfinished visit at expiry is not judged, so its
 * darts count toward Darts but not Visits.
 */
export function summariseScoreThreshold(
  state: ScoreThresholdState,
): RoutineStepSummary {
  const { beats, visits, darts } = stepMetrics(
    "SCORE_THRESHOLD",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "SCORE_THRESHOLD",
    label: "65 or More",
    rows: [
      { label: "Beats", value: String(beats) },
      { label: "Visits", value: String(visits) },
      {
        label: "Beat rate",
        value: visits === 0 ? NO_VALUE : accuracyDisplay(beats, visits),
      },
      { label: "Darts", value: String(darts) },
    ],
  };
}

/**
 * Bullseye Checkouts' result is how many visits checked out 81 on the bull,
 * out of how many were judged. An unfinished visit at expiry is not judged,
 * so its darts count toward Darts but not Visits.
 */
export function summariseBullseyeCheckout(
  state: BullseyeCheckoutState,
): RoutineStepSummary {
  const { checkouts, visits, darts } = stepMetrics(
    "BULLSEYE_CHECKOUT",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "BULLSEYE_CHECKOUT",
    label: "Bullseye Checkouts",
    rows: [
      { label: "Checkouts", value: String(checkouts) },
      { label: "Visits", value: String(visits) },
      {
        label: "Checkout rate",
        value: visits === 0 ? NO_VALUE : accuracyDisplay(checkouts, visits),
      },
      { label: "Darts", value: String(darts) },
    ],
  };
}

/**
 * Bull Up Practice's result is how often a single cold dart found the bull,
 * split by ring. Every throw is judged on landing; none is left open.
 */
export function summariseBullUp(state: BullUpState): RoutineStepSummary {
  const { throws, bullseyes, bulls } = stepMetrics("BULL_UP", state, NO_FACTS);
  const rate = (hits: number) =>
    throws === 0 ? NO_VALUE : accuracyDisplay(hits, throws);
  return {
    stepKey: "BULL_UP",
    label: "Bull Up Practice",
    rows: [
      { label: "Throws", value: String(throws) },
      { label: "Bullseyes", value: String(bullseyes) },
      { label: "Bulls", value: String(bulls) },
      { label: "Bullseye rate", value: rate(bullseyes) },
      { label: "Bull rate", value: rate(bulls) },
    ],
  };
}

/**
 * Catch 40's result is its points total, with how many outshots checked out
 * of how many were attempted. An attempt open at expiry is not counted, so
 * its darts count toward Darts but not Attempts.
 */
export function summariseCheckoutSequence(
  state: CheckoutSequenceState,
): RoutineStepSummary {
  const { points, checkouts, attempts, darts } = stepMetrics(
    "CHECKOUT_SEQUENCE",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "CHECKOUT_SEQUENCE",
    label: "Catch 40",
    rows: [
      { label: "Points", value: String(points) },
      { label: "Checkouts", value: String(checkouts) },
      { label: "Attempts", value: String(attempts) },
      {
        label: "Checkout rate",
        value: attempts === 0 ? NO_VALUE : accuracyDisplay(checkouts, attempts),
      },
      { label: "Darts", value: String(darts) },
    ],
  };
}

/**
 * Random Checkout's result is its checkout count, with the rate over judged
 * attempts. An attempt open at expiry is not counted, so its darts count
 * toward Darts but not Attempts.
 */
export function summariseRandomCheckout(
  state: RandomCheckoutState,
): RoutineStepSummary {
  const { checkouts, attempts, darts } = stepMetrics(
    "RANDOM_CHECKOUT",
    state,
    NO_FACTS,
  );
  return {
    stepKey: "RANDOM_CHECKOUT",
    label: "Random Checkout",
    rows: [
      { label: "Checkouts", value: String(checkouts) },
      { label: "Attempts", value: String(attempts) },
      {
        label: "Checkout rate",
        value: attempts === 0 ? NO_VALUE : accuracyDisplay(checkouts, attempts),
      },
      { label: "Darts", value: String(darts) },
    ],
  };
}

/**
 * Reuses TUOD's own results snapshot rather than recomputing it;
 * `checkoutPercentage` is null whenever the session was not played on the
 * visual board.
 */
export function summariseTuod(seat: TuodSeatResult): RoutineStepSummary {
  return {
    stepKey: "GAME:TUOD_V1",
    label: "Finishing",
    rows: [
      { label: "Target reached", value: String(seat.target) },
      { label: "Checkout %", value: seat.checkoutPercentage ?? NO_VALUE },
    ],
  };
}

/**
 * Reuses Score Training's own results snapshot. `ScoreTrainingSeatResult`
 * carries no per-visit dart count (only `total`/`threeDartAverage`/etc.), so
 * — unlike Switching/Double Pattern — this summary has no "Darts" row.
 */
export function summariseScoreTraining(
  seat: ScoreTrainingSeatResult,
): RoutineStepSummary {
  return {
    stepKey: "GAME:SCORE_TRAINING_V1",
    label: "Scoring",
    rows: [
      { label: "Points", value: String(seat.total) },
      { label: "Average", value: seat.threeDartAverage },
    ],
  };
}

/**
 * Reuses 121's own results snapshot rather than recomputing it;
 * `checkoutPercentage` is null whenever the session was not played on the
 * visual board.
 */
export function summariseOneTwentyOne(
  seat: OneTwentyOneSeatResult,
): RoutineStepSummary {
  return {
    stepKey: "GAME:121_V2",
    label: "121",
    rows: [
      { label: "Target reached", value: String(seat.target) },
      { label: "Checkout %", value: seat.checkoutPercentage ?? NO_VALUE },
    ],
  };
}

/**
 * Reuses Around the Clock's own results snapshot. A routine step is always
 * timed, so laps and the target reached are the result; an untimed seat
 * reads as a dash.
 */
export function summariseAroundTheClock(
  seat: AroundTheClockSeatResult,
): RoutineStepSummary {
  return {
    stepKey: "GAME:AROUND_THE_CLOCK_V2",
    label: "Around the Clock",
    rows: [
      {
        label: "Laps",
        value: seat.laps === null ? NO_VALUE : String(seat.laps),
      },
      { label: "Reached", value: seat.targetAtEnd ?? NO_VALUE },
      { label: "Accuracy", value: seat.accuracy },
    ],
  };
}
