import { accuracyDisplay } from "@lib/game/play-visit-stats";
import { targetScoringTargetLabel } from "@modules/training/exercises/target-scoring.engine.module";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
  TargetScoringState,
  RoutineStatRow,
  RoutineStepSummary,
} from "@modules/types";
import type {
  TuodSeatResult,
  ScoreTrainingSeatResult,
  OneTwentyOneSeatResult,
} from "@lib/types";

const NO_VALUE = "—";

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
  const hits = facts.turns
    .flatMap((turn) => turn.darts)
    .filter(
      (dart) =>
        dart.intendedTargetNumber !== null &&
        dart.hitTargetNumber === dart.intendedTargetNumber,
    ).length;
  return {
    stepKey: "SWITCHING",
    label: "Switching",
    rows: [
      { label: "Points", value: String(state.totalPoints) },
      { label: "Darts", value: String(state.dartsThrown) },
      hitRateRow(hits, state.dartsThrown),
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
  return {
    stepKey: "DOUBLE_PATTERN",
    label: "Doubles",
    rows: [
      { label: "Doubles hit", value: String(state.totalPoints) },
      { label: "Darts", value: String(state.dartsThrown) },
      hitRateRow(state.totalPoints, state.dartsThrown),
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
  return {
    stepKey: "TARGET_SCORING",
    label: "Target Scoring",
    rows: [
      { label: "Best chain", value: String(state.bestChain) },
      ...state.bestChainByTarget.map(({ targetNumber, bestChain }) => ({
        label: `Best on ${targetScoringTargetLabel(targetNumber)}`,
        value: String(bestChain),
      })),
      { label: "Darts", value: String(state.dartsThrown) },
      hitRateRow(state.hits, state.dartsThrown),
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
