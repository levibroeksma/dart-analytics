import type { BullUpConfigData } from "@lib/types";
import { BullUpV1Config } from "@lib/training/exercises/rulesets/types";
import type { EngineFacts, TurnFact } from "@modules/types";
import type { DartExerciseSpec } from "@modules/interfaces";
import { doubleTargetIntent } from "@modules/game/turn-log.module";
import {
  dartExerciseEngineClass,
  registerDartExercise,
} from "./dart-exercise-shell.module";
import type { BullUpState, BullUpTier } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "BULL_UP_V1" as const;
/** Every throw is aimed at the bullseye. */
const BULL_INTENT = doubleTargetIntent({ kind: "BULL" });

function tierOf(turn: TurnFact): BullUpTier {
  const zone = turn.darts[0]?.hitZoneKey;
  if (zone === "INNER_BULL") return "BULLSEYE";
  if (zone === "OUTER_BULL") return "OUTER_BULL";
  return "MISS";
}

/**
 * Folds the fact log into Bull Up state — a pure function of
 * `facts`/`complete`, mirroring `foldBullseyeCheckoutState`. One turn is one
 * throw, judged when written.
 */
export function foldBullUpState(
  facts: EngineFacts,
  complete: boolean,
): BullUpState {
  const initial: BullUpState = {
    throws: 0,
    bullseyes: 0,
    bulls: 0,
    lastTier: null,
    dartsThrown: 0,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
  return facts.turns.reduce((state, turn) => {
    const tier = tierOf(turn);
    return {
      ...state,
      throws: state.throws + 1,
      bullseyes: state.bullseyes + (tier === "BULLSEYE" ? 1 : 0),
      bulls: state.bulls + (tier === "MISS" ? 0 : 1),
      lastTier: tier,
      dartsThrown: state.dartsThrown + turn.darts.length,
    };
  }, initial);
}

const bullUpSpec: DartExerciseSpec<BullUpConfigData, BullUpState> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  parse: (config) => BullUpV1Config.parse(config),
  fold: (facts, _config, expired) => foldBullUpState(facts, expired),
  intent: () => BULL_INTENT,
  isVisitOpen: () => false,
};

/**
 * Bull Up ("Bull Up Practice"): one dart per throw, always at the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`), on the
 * exercise shell. One `TurnFact` is one throw of one dart, complete when
 * written. Clockless: completion arrives only through `expireTimer()` (D264).
 */
export class BullUpEngine extends dartExerciseEngineClass(bullUpSpec) {}

export const bullUpEngineFactory = registerDartExercise(
  bullUpSpec,
  BullUpEngine,
).factory;
