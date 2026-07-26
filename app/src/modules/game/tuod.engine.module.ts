import type { TuodSnapshot } from "@lib/types";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  EngineFacts,
  StageFact,
  TurnFact,
  TuodAttemptInput,
  TuodState,
} from "./types";

/**
 * The ladder floor: the lowest target a double-out attempt can ever finish
 * from (D1 = 2). A failed attempt that would drop the target below this
 * clamps here instead, so the ladder never strands a session on a target no
 * double can finish.
 */
const MIN_FINISHABLE_TARGET = 2;

/**
 * The single stage a TUOD session is played under. Attempts are turns inside
 * it, not stages of their own — the ruleset has no per-attempt stage concept.
 */
function blockStage(): StageFact {
  return {
    clientKey: "block-1",
    stageTypeKey: "EXERCISE_BLOCK",
    parentClientKey: null,
    sequence: 1,
  };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Whether one reported attempt checked out. Success needs both a checkout and
 * a double as the finishing dart — the number of darts thrown at a double is
 * never consulted, because a visit can throw at several doubles and still miss
 * every one of them. An attempt that reached zero off a single or the bull's
 * outer ring is a failed attempt, exactly as it is in 501.
 */
function isTuodSuccess(input: TuodAttemptInput): boolean {
  return input.checkedOut && input.finishedOnDouble === true;
}

/** The ladder as it stands before any attempt: on the configured start target. */
export function initialTuodState(config: TuodSnapshot): TuodState {
  return {
    currentTarget: config.startingTarget,
    attempts: 0,
    successes: 0,
    failures: 0,
    timerExpired: false,
  };
}

/**
 * Pure reducer: folds one resolved attempt onto a `TuodState`. A success moves
 * the next target up by `finishBonus`; a failure — a plain miss and a bust
 * alike, since a bust voids the one visit the attempt gets — moves it down by
 * `missPenalty`, floored at the double-out minimum so the ladder never falls
 * onto a target no double can finish. `timerExpired` is carried through
 * untouched: it is not a fold over attempts.
 */
export function applyTuodAttempt(
  config: TuodSnapshot,
  state: TuodState,
  succeeded: boolean,
): TuodState {
  return {
    ...state,
    currentTarget: succeeded
      ? state.currentTarget + config.finishBonus
      : Math.max(
          MIN_FINISHABLE_TARGET,
          state.currentTarget - config.missPenalty,
        ),
    attempts: state.attempts + 1,
    successes: succeeded ? state.successes + 1 : state.successes,
    failures: succeeded ? state.failures : state.failures + 1,
  };
}

/**
 * Ten Up One Down: a checkout ladder starting at `startingTarget`, climbing
 * `finishBonus` on a checked-out attempt and falling `missPenalty` on a failed
 * one, played for a ROUNDS or MINUTES duration. The engine owns the fact log —
 * one `EXERCISE_BLOCK` stage and one turn per attempt, carrying the attempt
 * total with no dart rows because TUOD is a quick-score game. The ladder is
 * derived by folding those turns through `applyTuodAttempt`, never
 * accumulated: a successful attempt stores the target it was thrown at and a
 * failed one stores `0`, so a positive total is exactly what marks a success
 * on replay.
 */
export class TuodEngine implements GameEngine<TuodAttemptInput, TuodState> {
  readonly rulesetVersionKey = "TUOD_V1";
  private readonly stage: StageFact;
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: TuodSnapshot,
    prior?: EngineFacts,
  ) {
    const priorStage = prior?.stages[0];
    this.stage = priorStage ? { ...priorStage } : blockStage();
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * Replays every recorded attempt as the outcome that produced it. A turn's
   * `totalScore` is the target a checkout scored, and a failed attempt stores
   * `0`, so `totalScore > 0` reproduces the ladder exactly — the floor in
   * `applyTuodAttempt` runs on every step of the replay, so a rehydrated
   * session lands on the same target a live one folded to.
   */
  private deriveState(): TuodState {
    let state = initialTuodState(this.config);
    for (const turn of this.turns) {
      state = applyTuodAttempt(this.config, state, turn.totalScore > 0);
    }
    return { ...state, timerExpired: this.timerExpired };
  }

  /**
   * The single completion rule, evaluated against an arbitrary attempt count so
   * both `isComplete()` (the count now) and `wouldComplete()` (the count one
   * attempt ahead) read it rather than restating it.
   */
  private completesAt(attemptCount: number): boolean {
    if (this.config.durationType === "ROUNDS") {
      return attemptCount >= this.config.durationValue;
    }
    return this.timerExpired && attemptCount >= 1;
  }

  /**
   * Why `record()` would refuse this attempt, or null when it would accept it.
   * `wouldComplete()` reads the same answer, which is what keeps the pure
   * predicate and the mutating call in agreement about what is playable. The
   * ladder floor keeps `currentTarget` at or above the double-out minimum on
   * every fold, so there is no below-minimum-checkout case left to reject
   * here.
   */
  private rejectionReason(input: TuodAttemptInput): string | null {
    if (this.isComplete()) {
      return "Cannot record an attempt once the session is complete; undo first to correct it.";
    }
    if (
      input.dartsUsed !== undefined &&
      input.dartsUsed > this.config.maxDartsPerTurn
    ) {
      return `An attempt is at most ${this.config.maxDartsPerTurn} darts.`;
    }
    return null;
  }

  /**
   * Records that the MINUTES countdown has elapsed. The countdown itself lives
   * in `game.store.ts`, not the engine, so expiry arrives as an explicit call
   * rather than as a write through the object `state()` returned — that object
   * is a derived copy, and writing to it changes nothing.
   */
  expireTimer(): void {
    this.timerExpired = true;
  }

  /**
   * Appends one attempt to the exercise block. A checkout stores the target it
   * was thrown at as the turn total, since the player scored exactly that; any
   * failure — a miss, a checkout that did not finish on a double, or a bust —
   * stores `0`. `completedAt` is stamped here because an attempt is a single
   * visit that resolves the moment it is reported.
   * @throws when the session has already ended, or the attempt claims more
   *   darts than the ruleset allows; the fact log is left untouched in either
   *   case.
   */
  record(input: TuodAttemptInput): TuodState {
    const before = this.deriveState();
    const reason = this.rejectionReason(input);
    if (reason) {
      throw new Error(reason);
    }

    const succeeded = isTuodSuccess(input);
    this.turns.push({
      clientKey: crypto.randomUUID(),
      stageClientKey: this.stage.clientKey,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: succeeded ? before.currentTarget : 0,
      darts: [],
    });

    return this.deriveState();
  }

  /**
   * Pops the last recorded attempt, including one replayed from persisted
   * facts. `record()` never opens a stage — a TUOD session has exactly one, for
   * its whole length — so removing the turn is the whole inverse, and the
   * ladder position follows because it is folded from what remains.
   * @returns true if an attempt was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    if (this.turns.length === 0) return false;
    this.turns.pop();
    return true;
  }

  /**
   * Answers the finish-confirm gate without touching the fact log. An attempt
   * `record()` would reject never completes the session — the caller falls
   * through to `record()` and surfaces its error instead.
   */
  wouldComplete(input: TuodAttemptInput): boolean {
    if (this.rejectionReason(input) !== null) {
      return false;
    }
    return this.completesAt(this.turns.length + 1);
  }

  isComplete(): boolean {
    return this.completesAt(this.turns.length);
  }

  state(): TuodState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...this.stage }], turns: cloneTurns(this.turns) };
  }
}

export const tuodEngineFactory: GameEngineFactory<
  TuodSnapshot,
  TuodAttemptInput,
  TuodState
> = {
  rulesetVersionKey: "TUOD_V1",
  create(config: TuodSnapshot, prior?: EngineFacts) {
    return new TuodEngine(config, prior);
  },
};

registerEngineFactory(tuodEngineFactory);
