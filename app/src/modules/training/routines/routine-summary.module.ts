import { accuracyDisplay } from "@lib/game/play-visit-stats";
import type {
  EngineFacts,
  SwitchingState,
  DoublePatternState,
  RoutineStatRow,
  RoutineStepSummary,
} from "@modules/types";
import type { TuodSeatResult } from "@lib/types";

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
 * Reuses TUOD's own results snapshot rather than recomputing it;
 * `checkoutPercentage` is null whenever the session was not played on the
 * visual board.
 */
export function summariseFinishing(seat: TuodSeatResult): RoutineStepSummary {
  return {
    stepKey: "GAME",
    label: "Finishing",
    rows: [
      { label: "Target reached", value: String(seat.target) },
      { label: "Checkout %", value: seat.checkoutPercentage ?? NO_VALUE },
    ],
  };
}
