import { tuodPlay } from "@lib/game/tuod-play.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { aroundTheClockPlay } from "@lib/game/around-the-clock-play.data";
import { warmUpAdapter } from "./warm-up.adapter";
import { switchingAdapter } from "./switching.adapter";
import { switchingChainAdapter } from "./switching-chain.adapter";
import { doublePatternAdapter } from "./double-pattern.adapter";
import { targetScoringAdapter } from "./target-scoring.adapter";
import { scoreThresholdAdapter } from "./score-threshold.adapter";
import { bullseyeCheckoutAdapter } from "./bullseye-checkout.adapter";
import { bullUpAdapter } from "./bull-up.adapter";
import { checkoutSequenceAdapter } from "./checkout-sequence.adapter";
import { randomCheckoutAdapter } from "./random-checkout.adapter";
import { hitCountAdapter } from "./hit-count.adapter";
import { switchbladeAdapter } from "./switchblade.adapter";
import { doublesLockAdapter } from "./doubles-lock.adapter";
import { halveItAdapter } from "./halve-it.adapter";
import { snakesLaddersAdapter } from "./snakes-ladders.adapter";
import {
  gameAdapter,
  summariseTuodStep,
  summariseScoreTrainingStep,
  summariseOneTwentyOneStep,
  summariseAroundTheClockStep,
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
  SWITCHING_CHAIN: switchingChainAdapter,
  DOUBLE_PATTERN: doublePatternAdapter,
  TARGET_SCORING: targetScoringAdapter,
  SCORE_THRESHOLD: scoreThresholdAdapter,
  BULLSEYE_CHECKOUT: bullseyeCheckoutAdapter,
  BULL_UP: bullUpAdapter,
  CHECKOUT_SEQUENCE: checkoutSequenceAdapter,
  RANDOM_CHECKOUT: randomCheckoutAdapter,
  HIT_COUNT: hitCountAdapter,
  SWITCHBLADE: switchbladeAdapter,
  DOUBLES_LOCK: doublesLockAdapter,
  HALVE_IT: halveItAdapter,
  DOUBLES_SNAKES_LADDERS: snakesLaddersAdapter,
  "GAME:TUOD_V1": gameAdapter({
    rulesetVersionKey: "TUOD_V1",
    headerLabel: "finishing",
    title: "Ten Up One Down",
    panel: "tuod",
    playFactory: tuodPlay,
    summarise: summariseTuodStep,
  }),
  "GAME:SCORE_TRAINING_V1": gameAdapter({
    rulesetVersionKey: "SCORE_TRAINING_V1",
    headerLabel: "scoring",
    title: "Score Training",
    panel: "score-training",
    playFactory: scoreTrainingPlay,
    summarise: summariseScoreTrainingStep,
  }),
  "GAME:121_V2": gameAdapter({
    rulesetVersionKey: "121_V2",
    headerLabel: "121",
    title: "121",
    panel: "one-twenty-one",
    playFactory: oneTwentyOnePlay,
    summarise: summariseOneTwentyOneStep,
  }),
  "GAME:AROUND_THE_CLOCK_V2": gameAdapter({
    rulesetVersionKey: "AROUND_THE_CLOCK_V2",
    headerLabel: "around the clock",
    title: "Around the Clock",
    panel: "around-the-clock",
    playFactory: aroundTheClockPlay,
    summarise: summariseAroundTheClockStep,
  }),
};

/**
 * The adapter key each exercise ruleset version pins outright, for the
 * exercise types that ship more than one ruleset and drive a different
 * panel per ruleset. Everything absent here keys on its exercise type.
 */
const ADAPTER_KEY_BY_EXERCISE_RULESET: Readonly<
  Record<string, StepAdapterKey>
> = {
  SWITCHING_CHAIN_V1: "SWITCHING_CHAIN",
};

/**
 * Derives a resolved step's adapter key from its exercise/game ruleset. A
 * GAME step keys on its pinned game ruleset; every other step keys on its
 * exercise type, except where its exercise ruleset version names an adapter
 * of its own (`ADAPTER_KEY_BY_EXERCISE_RULESET`) because its type ships
 * several playable configs.
 */
export function stepAdapterKey(step: {
  exerciseTypeKey: string;
  exerciseRulesetVersionKey: string | null;
  gameRulesetVersionKey: string | null;
}): StepAdapterKey {
  if (step.exerciseTypeKey === "GAME") {
    return `GAME:${step.gameRulesetVersionKey ?? ""}`;
  }
  const byRuleset =
    step.exerciseRulesetVersionKey === null
      ? undefined
      : ADAPTER_KEY_BY_EXERCISE_RULESET[step.exerciseRulesetVersionKey];
  return byRuleset ?? (step.exerciseTypeKey as StepAdapterKey);
}

export function resolveStepAdapter(
  key: StepAdapterKey,
): StepAdapter | undefined {
  return STEP_ADAPTERS[key];
}
