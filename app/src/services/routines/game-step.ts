import { tuodDurationBounds } from "@lib/game/tuod-duration";
import { scoreTrainingDurationBounds } from "@lib/game/score-training-duration";
import { oneTwentyOneDurationBounds } from "@lib/game/one-twenty-one-duration";
import type { RoutineGameStepHook } from "./types";

/** The capture pair every routine step records under (01-Routines.md §13). */
export const ROUTINE_CAPTURE_MODE_KEY = "ANALYTICS";
export const ROUTINE_INPUT_MODE_KEY = "VISUAL_BOARD";

function minutesInto(config: Record<string, unknown>, minutes: number): void {
  config.duration_type = "MINUTES";
  config.duration_value = minutes;
}

/**
 * Games a routine may run as a step: those with a native timed mode, so the
 * step timer is the game's own duration and expiry ends the game the way its
 * standalone timer would (spec §5.2). A game absent here is not eligible,
 * whatever its capabilities say.
 */
export const ROUTINE_GAME_STEPS: Record<string, RoutineGameStepHook> = {
  TUOD_V1: {
    rulesetVersionKey: "TUOD_V1",
    applyStepDuration: minutesInto,
    minuteBounds: tuodDurationBounds("MINUTES"),
  },
  SCORE_TRAINING_V1: {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    applyStepDuration: minutesInto,
    minuteBounds: scoreTrainingDurationBounds("MINUTES"),
  },
  "121_V2": {
    rulesetVersionKey: "121_V2",
    applyStepDuration: minutesInto,
    minuteBounds: oneTwentyOneDurationBounds("MINUTES"),
  },
};

export function routineGameStepHook(
  rulesetVersionKey: string | null,
): RoutineGameStepHook | undefined {
  return rulesetVersionKey ? ROUTINE_GAME_STEPS[rulesetVersionKey] : undefined;
}
