import type { BullseyeCheckoutConfigData } from "@lib/types";
import { BullseyeCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type { EngineFacts, TurnFact } from "@modules/types";
import type { DartExerciseSpec } from "@modules/interfaces";
import { doubleTargetIntent, NO_INTENT } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { BullseyeCheckoutState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "BULLSEYE_CHECKOUT_V1" as const;
const DARTS_PER_VISIT = 3;
const BULLSEYE_SCORE = 50;
/** Dart 3 is always thrown at the bull, whatever darts 1–2 did. */
const FINISHING_DART_INTENT = doubleTargetIntent({ kind: "BULL" });

type Progress = {
  checkouts: number;
  visits: number;
  lastVisitCheckout: boolean | null;
  currentVisitTotal: number;
  dartsInVisit: number;
  dartsThrown: number;
};

const INITIAL_PROGRESS: Progress = {
  checkouts: 0,
  visits: 0,
  lastVisitCheckout: null,
  currentVisitTotal: 0,
  dartsInVisit: 0,
  dartsThrown: 0,
};

/** A judged visit checks out when the setup leaves 50 and dart 3 is the bullseye. */
function isCheckout(startScore: number, turn: TurnFact): boolean {
  const [first, second, finishing] = turn.darts;
  return (
    first.score + second.score === startScore - BULLSEYE_SCORE &&
    finishing.hitZoneKey === "INNER_BULL"
  );
}

/**
 * Folds one visit onto the running progress. A visit of three darts is
 * judged; a shorter one is the visit still open — at timer expiry it stays
 * unjudged.
 */
function applyVisit(
  startScore: number,
  progress: Progress,
  turn: TurnFact,
): Progress {
  const dartsThrown = progress.dartsThrown + turn.darts.length;
  if (turn.darts.length < DARTS_PER_VISIT) {
    return {
      ...progress,
      currentVisitTotal: turn.darts.reduce((sum, d) => sum + d.score, 0),
      dartsInVisit: turn.darts.length,
      dartsThrown,
    };
  }
  const checkout = isCheckout(startScore, turn);
  return {
    checkouts: progress.checkouts + (checkout ? 1 : 0),
    visits: progress.visits + 1,
    lastVisitCheckout: checkout,
    currentVisitTotal: 0,
    dartsInVisit: 0,
    dartsThrown,
  };
}

/**
 * Folds the whole fact log into Bullseye Checkout state — a pure function
 * of `facts`/`config`/`complete`, mirroring `foldScoreThresholdState`.
 */
export function foldBullseyeCheckoutState(
  facts: EngineFacts,
  config: BullseyeCheckoutConfigData,
  complete: boolean,
): BullseyeCheckoutState {
  const { currentVisitTotal, ...progress } = facts.turns.reduce(
    (acc, turn) => applyVisit(config.startScore, acc, turn),
    INITIAL_PROGRESS,
  );

  return {
    startScore: config.startScore,
    ...progress,
    currentLeft: config.startScore - currentVisitTotal,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

const bullseyeCheckoutSpec: DartExerciseSpec<
  BullseyeCheckoutConfigData,
  BullseyeCheckoutState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => BullseyeCheckoutV1Config.parse(config),
  fold: foldBullseyeCheckoutState,
  intent: (state) =>
    state.dartsInVisit === DARTS_PER_VISIT - 1
      ? FINISHING_DART_INTENT
      : NO_INTENT,
  isVisitOpen: (turn) => turn.darts.length < DARTS_PER_VISIT,
};

/**
 * Bullseye Checkout ("Bullseye Checkouts"): every visit starts at 81, darts
 * 1–2 set up freely, dart 3 is thrown at the bull
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`), on the
 * exercise shell. One `TurnFact` is one three-dart visit; only dart 3
 * carries an intent. Clockless: completion arrives only through
 * `expireTimer()` (D264).
 */
export class BullseyeCheckoutEngine extends dartExerciseEngineClass(
  bullseyeCheckoutSpec,
) {}

export const bullseyeCheckoutEngineFactory = registerDartExercise(
  bullseyeCheckoutSpec,
  BullseyeCheckoutEngine,
).factory;
