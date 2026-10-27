import type { RandomCheckoutConfigData } from "@lib/types";
import { RandomCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type { CheckoutSeat, EngineFacts } from "@modules/types";
import type { CheckoutRules, DartExerciseSpec } from "@modules/interfaces";
import {
  foldCheckoutVisits,
  initialCheckoutSeat,
} from "@modules/game/checkout-kernel.module";
import {
  seededDrawTarget,
  seededPoolDraw,
  unreachableFails,
} from "@modules/game/checkout-policies";
import { NO_INTENT } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { RandomCheckoutState } from "./types";

const MIN_START = 40;
const MAX_START = 170;
const UNFINISHABLE_STARTS: ReadonlySet<number> = new Set([
  159, 162, 163, 165, 166, 168, 169,
]);

/**
 * The scores a three-dart double-out can finish, 40-170 ascending. Frozen
 * for `RANDOM_CHECKOUT_V1`: a stored draw seed must replay to the same scores
 * forever, so a change here is a new ruleset version (D424).
 */
export const RANDOM_CHECKOUT_POOL: readonly number[] = Array.from(
  { length: MAX_START - MIN_START + 1 },
  (_, offset) => MIN_START + offset,
).filter((score) => !UNFINISHABLE_STARTS.has(score));

/**
 * The start score of attempt `attemptIndex` (0-based): a uniform pick from
 * the pool keyed by `(drawSeed, attemptIndex)` alone, never by earlier darts,
 * so undo and replay reproduce it exactly.
 */
export function drawStartScore(
  config: RandomCheckoutConfigData,
  attemptIndex: number,
): number {
  return seededPoolDraw(config.drawSeed, RANDOM_CHECKOUT_POOL, attemptIndex);
}

type RandomCheckoutExt = { lastAttempt: RandomCheckoutState["lastAttempt"] };

/** Notes how the closing attempt ended. */
function noteLastAttempt(
  seat: CheckoutSeat<RandomCheckoutExt>,
  passed: boolean,
): CheckoutSeat<RandomCheckoutExt> {
  return { ...seat, ext: { lastAttempt: passed ? "CHECKOUT" : "FAILED" } };
}

function rules(
  config: RandomCheckoutConfigData,
): CheckoutRules<RandomCheckoutExt> {
  return {
    visitsPerAttempt: 1,
    judge: unreachableFails,
    onAttemptClose: noteLastAttempt,
    nextTarget: seededDrawTarget(config.drawSeed, RANDOM_CHECKOUT_POOL),
  };
}

/**
 * Folds the whole fact log into Random Checkout state through the Checkout
 * kernel — a pure function of `facts`/`config`/`expired`. Attempt *n* is
 * turn *n*, started from `drawStartScore(config, n)`; it closes on a
 * checkout, a bust, an unreachable remainder or its third dart. The run is
 * complete once the timer expired; an attempt open then is never judged.
 */
function fold(
  facts: EngineFacts,
  config: RandomCheckoutConfigData,
  expired: boolean,
): RandomCheckoutState {
  const seat = foldCheckoutVisits(
    facts.turns,
    initialCheckoutSeat(drawStartScore(config, 0), { lastAttempt: null }),
    rules(config),
  );
  return {
    startScore: seat.target,
    remaining: seat.remaining,
    dartsInVisit: seat.dartsInVisit,
    checkouts: seat.checkouts,
    attempts: seat.attempts,
    lastAttempt: seat.ext.lastAttempt,
    dartsThrown: facts.turns.reduce((sum, turn) => sum + turn.darts.length, 0),
    status: expired ? "COMPLETE" : "IN_PROGRESS",
  };
}

const randomCheckoutSpec: DartExerciseSpec<
  RandomCheckoutConfigData,
  RandomCheckoutState
> = {
  exerciseRulesetVersionKey: "RANDOM_CHECKOUT_V1",
  parse: (config) => RandomCheckoutV1Config.parse(config),
  fold,
  intent: () => NO_INTENT,
  isVisitOpen: (_turn, state) => state.dartsInVisit > 0,
};

export const foldRandomCheckoutState = randomCheckoutSpec.fold;

/**
 * Random Checkout: one-visit checkout attempts from a seed-drawn start score,
 * X01 double-out (`docs/game-rules/training/exercises/random-checkout.md`),
 * on the Checkout kernel and the exercise shell. One `TurnFact` is one
 * attempt; free aim. The run ends only through `expireTimer()` (D264).
 */
export class RandomCheckoutEngine extends dartExerciseEngineClass(
  randomCheckoutSpec,
) {}

export const randomCheckoutEngineFactory = registerDartExercise(
  randomCheckoutSpec,
  RandomCheckoutEngine,
).factory;
