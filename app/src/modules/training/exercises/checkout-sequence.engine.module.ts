import type { CheckoutSequenceConfigData } from "@lib/types";
import { CheckoutSequenceV1Config } from "@lib/training/exercises/rulesets/types";
import type { CheckoutSeat, EngineFacts, VisitVerdict } from "@modules/types";
import type { CheckoutRules, DartExerciseSpec } from "@modules/interfaces";
import {
  foldCheckoutVisits,
  initialCheckoutSeat,
} from "@modules/game/checkout-kernel.module";
import {
  consecutiveTargets,
  dartWalkJudge,
} from "@modules/game/checkout-policies";
import { NO_INTENT } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { CheckoutSequenceState } from "./types";

const DARTS_PER_VISIT = 3;
/** Outshots no two darts can finish, so three darts earn the top score. */
const THREE_DART_MINIMUM_OUTSHOTS: ReadonlySet<number> = new Set([99]);

type CheckoutSequenceExt = { points: number; lastAttemptPoints: number | null };

/** Points one checked-out attempt earns by darts used. */
function attemptPoints(outshot: number, dartsUsed: number): number {
  if (dartsUsed <= 2) return 3;
  if (dartsUsed === 3) return THREE_DART_MINIMUM_OUTSHOTS.has(outshot) ? 3 : 2;
  return 1;
}

/** Books an attempt's points: by darts used on a checkout, 0 on a fail. */
function bookPoints(
  seat: CheckoutSeat<CheckoutSequenceExt>,
  passed: boolean,
  verdict: VisitVerdict,
): CheckoutSeat<CheckoutSequenceExt> {
  const earned =
    passed && verdict.kind === "CHECKOUT"
      ? attemptPoints(
          seat.target,
          DARTS_PER_VISIT * seat.visitIndex + verdict.darts,
        )
      : 0;
  return {
    ...seat,
    ext: { points: seat.ext.points + earned, lastAttemptPoints: earned },
  };
}

function rules(
  config: CheckoutSequenceConfigData,
): CheckoutRules<CheckoutSequenceExt> {
  return {
    visitsPerAttempt: config.dartLimit / DARTS_PER_VISIT,
    judge: dartWalkJudge,
    onAttemptClose: bookPoints,
    nextTarget: consecutiveTargets(config.lastOutshot),
  };
}

/**
 * Folds the whole fact log into Checkout Sequence state through the
 * Checkout kernel — a pure function of `facts`/`config`/`expired`. A visit
 * closes on a checkout, a bust or its third dart. Complete once the timer
 * expired or the last outshot has been attempted.
 */
function fold(
  facts: EngineFacts,
  config: CheckoutSequenceConfigData,
  expired: boolean,
): CheckoutSequenceState {
  const seat = foldCheckoutVisits(
    facts.turns,
    initialCheckoutSeat(config.firstOutshot, {
      points: 0,
      lastAttemptPoints: null,
    }),
    rules(config),
  );
  const done = seat.status === "DONE";
  return {
    currentOutshot: done ? null : seat.target,
    remaining: done ? 0 : seat.remaining,
    attemptDart: DARTS_PER_VISIT * seat.visitIndex + seat.dartsInVisit,
    points: seat.ext.points,
    checkouts: seat.checkouts,
    attempts: seat.attempts,
    lastAttemptPoints: seat.ext.lastAttemptPoints,
    dartsInVisit: seat.dartsInVisit,
    dartsThrown: facts.turns.reduce((sum, turn) => sum + turn.darts.length, 0),
    status: expired || done ? "COMPLETE" : "IN_PROGRESS",
  };
}

const checkoutSequenceSpec: DartExerciseSpec<
  CheckoutSequenceConfigData,
  CheckoutSequenceState
> = {
  exerciseRulesetVersionKey: "CHECKOUT_SEQUENCE_V1",
  parse: (config) => CheckoutSequenceV1Config.parse(config),
  fold,
  intent: () => NO_INTENT,
  isVisitOpen: (_turn, state) => state.dartsInVisit > 0,
  ends: (state) => state.status === "COMPLETE",
};

export const foldCheckoutSequenceState = checkoutSequenceSpec.fold;

/**
 * Checkout Sequence ("Catch 40"): check out 61, then 62, … up to 100, each
 * within six darts, X01 double-out
 * (`docs/game-rules/training/exercises/catch-40.md`), on the Checkout
 * kernel and the exercise shell. One `TurnFact` is one visit; free aim.
 */
export class CheckoutSequenceEngine extends dartExerciseEngineClass(
  checkoutSequenceSpec,
) {}

export const checkoutSequenceEngineFactory = registerDartExercise(
  checkoutSequenceSpec,
  CheckoutSequenceEngine,
).factory;
