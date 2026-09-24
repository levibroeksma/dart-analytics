import type { BullseyeCheckoutConfigData } from "@lib/types";
import { BullseyeCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
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
import type { BullseyeCheckoutState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "BULLSEYE_CHECKOUT_V1" as const;
const STAGE = exerciseBlockStage();
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

/**
 * Bullseye Checkout ("Bullseye Checkouts"): every visit starts at 81, darts
 * 1–2 set up freely, dart 3 is thrown at the bull
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`). One
 * `TurnFact` is one three-dart visit; only dart 3 carries an intent.
 * Clockless: completion arrives only through `expireTimer()` (D264).
 */
export class BullseyeCheckoutEngine implements DartExerciseEngine<BullseyeCheckoutState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: BullseyeCheckoutConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: BullseyeCheckoutConfigData, prior?: EngineFacts) {
    this.config = BullseyeCheckoutV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): BullseyeCheckoutState {
    return foldBullseyeCheckoutState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): BullseyeCheckoutState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < DARTS_PER_VISIT,
    );
    if (turn.darts.length === DARTS_PER_VISIT - 1) {
      appendObservedDart(turn, observation, FINISHING_DART_INTENT);
      turn.completedAt = new Date().toISOString();
    } else {
      appendObservedDart(turn, observation);
    }
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

  state(): BullseyeCheckoutState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const bullseyeCheckoutEngineFactory: DartExerciseEngineFactory<
  BullseyeCheckoutConfigData,
  BullseyeCheckoutState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: BullseyeCheckoutConfigData, prior?: EngineFacts) {
    return new BullseyeCheckoutEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(bullseyeCheckoutEngineFactory);
