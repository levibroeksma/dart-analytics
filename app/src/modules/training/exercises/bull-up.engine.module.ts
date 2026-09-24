import type { BullUpConfigData } from "@lib/types";
import { BullUpV1Config } from "@lib/training/exercises/rulesets/types";
import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";
import {
  appendObservedDart,
  cloneTurns,
  doubleTargetIntent,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import type {
  DartExerciseEngine,
  DartExerciseEngineFactory,
} from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { BullUpState, BullUpTier } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "BULL_UP_V1" as const;
const STAGE = exerciseBlockStage();
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

/**
 * Bull Up ("Bull Up Practice"): one dart per throw, always at the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`). One
 * `TurnFact` is one throw of one dart, complete when written. Clockless:
 * completion arrives only through `expireTimer()` (D264).
 */
export class BullUpEngine implements DartExerciseEngine<BullUpState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: BullUpConfigData, prior?: EngineFacts) {
    BullUpV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): BullUpState {
    return foldBullUpState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.complete,
    );
  }

  record(observation: DartObservation): BullUpState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      () => false,
    );
    appendObservedDart(turn, observation, BULL_INTENT);
    turn.completedAt = new Date().toISOString();
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /** The step's countdown elapsed — the clock lives in the controller (D264). */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): BullUpState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const bullUpEngineFactory: DartExerciseEngineFactory<
  BullUpConfigData,
  BullUpState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: BullUpConfigData, prior?: EngineFacts) {
    return new BullUpEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(bullUpEngineFactory);
