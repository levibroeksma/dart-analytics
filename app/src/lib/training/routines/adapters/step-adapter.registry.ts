import { tuodPlay } from "@lib/game/tuod-play.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { warmUpAdapter } from "./warm-up.adapter";
import { switchingAdapter } from "./switching.adapter";
import { doublePatternAdapter } from "./double-pattern.adapter";
import { targetScoringAdapter } from "./target-scoring.adapter";
import {
  gameAdapter,
  summariseTuodStep,
  summariseScoreTrainingStep,
  summariseOneTwentyOneStep,
} from "./game.adapter";
import type { StepAdapter } from "./interfaces";
import type { StepAdapterKey } from "./types";

/**
 * One adapter per non-game step kind, plus one per server-eligible game
 * ruleset (`services/routines/game-step.ts`'s `ROUTINE_GAME_STEPS`). This
 * table is hand-mirrored against that server table rather than importing it
 * — client code never imports `services/**` — and
 * `step-adapter.registry.test.ts` is what keeps the two in sync.
 */
export const STEP_ADAPTERS: Record<StepAdapterKey, StepAdapter> = {
  WARM_UP: warmUpAdapter,
  SWITCHING: switchingAdapter,
  DOUBLE_PATTERN: doublePatternAdapter,
  TARGET_SCORING: targetScoringAdapter,
  "GAME:TUOD_V1": gameAdapter({
    rulesetVersionKey: "TUOD_V1",
    headerLabel: "finishing",
    panel: "tuod",
    playFactory: tuodPlay,
    summarise: summariseTuodStep,
  }),
  "GAME:SCORE_TRAINING_V1": gameAdapter({
    rulesetVersionKey: "SCORE_TRAINING_V1",
    headerLabel: "scoring",
    panel: "score-training",
    playFactory: scoreTrainingPlay,
    summarise: summariseScoreTrainingStep,
  }),
  "GAME:121_V2": gameAdapter({
    rulesetVersionKey: "121_V2",
    headerLabel: "121",
    panel: "one-twenty-one",
    playFactory: oneTwentyOnePlay,
    summarise: summariseOneTwentyOneStep,
  }),
};

/** Derives a resolved step's adapter key from its exercise/game ruleset. */
export function stepAdapterKey(step: {
  exerciseTypeKey: string;
  gameRulesetVersionKey: string | null;
}): StepAdapterKey {
  if (step.exerciseTypeKey === "GAME") {
    return `GAME:${step.gameRulesetVersionKey ?? ""}`;
  }
  return step.exerciseTypeKey as StepAdapterKey;
}

export function resolveStepAdapter(
  key: StepAdapterKey,
): StepAdapter | undefined {
  return STEP_ADAPTERS[key];
}
