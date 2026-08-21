import type { TuodSnapshot, Seated } from "@lib/types";
import { classify } from "@lib/game/board/board-geometry.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { newClientKey } from "./client-key.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  StageFact,
  TuodAttemptInput,
  TuodInput,
  TuodState,
  TurnFact,
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

/**
 * Discriminates `TuodInput` by shape, never by session mode: only
 * `DartObservation` carries `hitZoneKey`, so its presence is a sound type
 * guard no matter which mode the session was created in — mirrors
 * `one-twenty-one.engine.module.ts`'s `isDartObservation`.
 */
function isDartObservation(input: TuodInput): input is DartObservation {
  return "hitZoneKey" in input;
}

/**
 * Whether a visit that has `remainingAfter` points left once its last dart
 * landed in `lastZoneKey` has checked out or busted. Shared by `settleVisit`
 * (which stamps the resolved fact) and `wouldCompleteDart` (which only asks
 * whether it would resolve) so the bust/checkout rule — overshoot, exactly 1
 * left, or reaching 0 without a double — is written once.
 */
function visitOutcome(
  remainingAfter: number,
  lastZoneKey: DartZoneKey,
): { checkedOut: boolean; busted: boolean } {
  const checkedOut = remainingAfter === 0 && lastZoneKey === "DOUBLE";
  const busted =
    remainingAfter < 0 ||
    remainingAfter === 1 ||
    (remainingAfter === 0 && !checkedOut);
  return { checkedOut, busted };
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
 * one, played for a ROUNDS or MINUTES duration. Under RECREATIONAL +
 * QUICK_SCORE the engine owns one turn per attempt, carrying the attempt
 * total with no dart rows; under ANALYTICS + VISUAL_BOARD it owns one dart at
 * a time, building the same one-turn-per-attempt shape dart-by-dart —
 * mirrors `OneTwentyOneEngine`'s dual-shape `record()`, simplified because
 * TUOD has exactly one visit per attempt and one stage for the whole session
 * (no per-round stage bookkeeping). The ladder is derived by folding every
 * CLOSED turn through `applyTuodAttempt`, never accumulated: a successful
 * attempt stores the score it counted and a failed one stores `0`, so a
 * positive total is exactly what marks a success on replay.
 */
export class TuodEngine implements GameEngine<TuodInput, TuodState> {
  readonly rulesetVersionKey = "TUOD_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly stage: StageFact;
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: Seated<TuodSnapshot>,
    prior?: EngineFacts,
  ) {
    const priorStage = prior?.stages[0];
    this.stage = priorStage ? { ...priorStage } : blockStage();
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * Folds every CLOSED turn as the attempt that produced it. Never called
   * with an open turn counted in — `deriveState()` is the only caller and
   * keeps an open board visit out of this fold on purpose, exactly as
   * `OneTwentyOneEngine.deriveClosedState` does.
   */
  private deriveClosedState(turns: readonly TurnFact[]): TuodState {
    let state = initialTuodState(this.config);
    for (const turn of turns) {
      if (turn.completedAt === null) continue;
      state = applyTuodAttempt(this.config, state, turn.totalScore > 0);
    }
    return state;
  }

  /**
   * Replays every CLOSED attempt as the outcome that produced it. A turn's
   * `totalScore` is the counted board score, and a failed attempt stores `0`,
   * so `totalScore > 0` reproduces the ladder exactly — the floor in
   * `applyTuodAttempt` runs on every step of the replay, so a rehydrated
   * session lands on the same target a live one folded to. An open board
   * visit contributes nothing until it resolves.
   */
  private deriveState(): TuodState {
    return {
      ...this.deriveClosedState(this.turns),
      timerExpired: this.timerExpired,
    };
  }

  /** How many attempts have actually resolved — an open board visit does not count yet. */
  private closedTurnCount(): number {
    return this.turns.filter((turn) => turn.completedAt !== null).length;
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

  /** The attempt still being thrown on the board, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /** Appends an empty attempt to the session's one stage and returns it. */
  private openNewVisit(): TurnFact {
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * The target `visit` was thrown at — every turn strictly before `visit` in
   * `this.turns` is always already closed (an engine only ever has one open
   * turn, the last one), so folding them through `deriveClosedState` is safe
   * and exact. Mirrors `OneTwentyOneEngine.remainingBeforeVisit`.
   */
  private targetBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return this.deriveClosedState(this.turns.slice(0, index)).currentTarget;
  }

  /**
   * Classifies one board observation into the target, zone, and score it
   * struck. A miss carries no coordinates, so it resolves to a scoreless hit
   * using the observation's own zone key rather than going through
   * `classify()` — mirrors `one-twenty-one.engine.module.ts`.
   */
  private resolveObservation(observation: DartObservation) {
    return observation.locationX === null || observation.locationY === null
      ? {
          targetNumber: null,
          zoneKey: observation.hitZoneKey,
          score: 0,
        }
      : classify(observation.locationX, observation.locationY);
  }

  /**
   * Why `record()` would refuse this attempt, or null when it would accept it.
   * `wouldComplete()` reads the same answer, which is what keeps the pure
   * predicate and the mutating call in agreement about what is playable. A
   * keypad total is refused while a board visit is open — mirrors
   * `FiveOhOneEngine.recordVisitTotal`'s guard (D198) — so the two input
   * shapes never write across each other.
   */
  private rejectionReason(input: TuodAttemptInput): string | null {
    if (this.isComplete()) {
      return "Cannot record an attempt once the session is complete; undo first to correct it.";
    }
    if (this.openVisit() !== null) {
      return "Finish the open attempt on the board before entering a keypad total.";
    }
    if (!isTuodSuccess(input)) {
      return null;
    }
    return checkoutDartsRejection(
      this.deriveState().currentTarget,
      input.dartsUsed,
      input.dartsAtDouble,
      this.config.maxDartsPerTurn,
    );
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
   * Applies the bust/checkout/out-of-darts rules to an attempt that just took
   * a dart, and stamps `completedAt` when it resolves. A busted attempt and
   * one that simply runs out of darts both store `0` — the ruleset doc's
   * known-limitation fix reads the difference off the darts themselves (an
   * overshoot / remaining-1 / reached-0-without-a-double pattern marks a
   * bust), never off `totalScore`.
   * @returns whether this dart resolved (closed) the attempt.
   */
  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.targetBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const { checkedOut, busted } = visitOutcome(
      remainingAfter,
      lastDart.hitZoneKey,
    );

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }
    if (checkedOut) {
      visit.totalScore = thrown;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    const outOfDarts = visit.darts.length === this.config.maxDartsPerTurn;
    if (outOfDarts) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
    }
    return outOfDarts;
  }

  /**
   * Records one dart, opening a fresh attempt once the last one has resolved.
   * Mirrors `OneTwentyOneEngine.recordDart`; TUOD never opens a second stage,
   * unlike 121's per-round stage push, since the whole session is one
   * `EXERCISE_BLOCK`.
   * @throws when the session is already complete; the fact log is left
   *   untouched.
   */
  private recordDart(observation: DartObservation): TuodState {
    if (this.isComplete()) {
      throw new Error(
        "Cannot record an attempt once the session is complete; undo first to correct it.",
      );
    }

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit();

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    this.settleVisit(visit);
    return this.deriveState();
  }

  /**
   * Appends one whole-visit attempt reported by the keypad. A checkout stores
   * the target it was thrown at as the turn total, since the counted board
   * score of a double-out finish always equals it; any failure — a miss, a
   * checkout that did not finish on a double, or a bust — stores `0`.
   * `completedAt` is stamped here because a keypad attempt is a single visit
   * that resolves the moment it is reported.
   * @throws when the session has already ended, a board visit is open, or the
   *   attempt claims more darts than the ruleset allows; the fact log is left
   *   untouched in any case.
   */
  private recordAttemptTotal(input: TuodAttemptInput): TuodState {
    const before = this.deriveState();
    const reason = this.rejectionReason(input);
    if (reason) {
      throw new Error(reason);
    }

    const succeeded = isTuodSuccess(input);
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      participantRef: this.config.seats[0].participantRef,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: succeeded ? before.currentTarget : 0,
      darts: [],
    });

    return this.deriveState();
  }

  record(input: TuodInput): TuodState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordAttemptTotal(input);
  }

  /**
   * Pops the last recorded dart or attempt, including one replayed from
   * persisted facts. Dispatches on the shape of the last recorded turn — a
   * turn built from a keypad total always has `darts: []`; a turn built from
   * a board dart always holds at least one dart from the moment it exists in
   * the log — mirrors `OneTwentyOneEngine.undo`. No stage is ever popped:
   * TUOD's whole session is one stage.
   * @returns true if a dart or an attempt was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    const last = this.turns.at(-1);
    if (!last) return false;
    return last.darts.length > 0 ? this.undoDart() : this.undoAttemptTotal();
  }

  private undoAttemptTotal(): boolean {
    return this.turns.pop() !== undefined;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();
    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
    return true;
  }

  /**
   * Whether recording `observation` right now would resolve the current (or a
   * fresh) attempt — by checkout, bust, or running out of darts — and that
   * resolution would be the session's last permitted attempt. Mirrors
   * `recordAttemptTotal`'s own `wouldComplete` reading (any resolved attempt
   * can end a duration-bounded session, success or not), computed without
   * mutating the fact log.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    if (this.isComplete()) return false;

    const visit = this.openVisit();
    const priorDarts = visit ? visit.darts : [];
    const target = visit
      ? this.targetBeforeVisit(visit)
      : this.deriveState().currentTarget;

    const resolved = this.resolveObservation(observation);
    const thrown =
      priorDarts.reduce((sum, dart) => sum + dart.score, 0) + resolved.score;
    const remainingAfter = target - thrown;
    const { checkedOut, busted } = visitOutcome(
      remainingAfter,
      resolved.zoneKey,
    );
    const dartCount = priorDarts.length + 1;
    const visitResolves =
      checkedOut || busted || dartCount === this.config.maxDartsPerTurn;

    if (!visitResolves) return false;
    return this.completesAt(this.closedTurnCount() + 1);
  }

  /**
   * Answers the finish-confirm gate without touching the fact log. An input
   * `record()` would reject never completes the session — the caller falls
   * through to `record()` and surfaces its error instead.
   */
  wouldComplete(input: TuodInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }
    if (this.rejectionReason(input) !== null) {
      return false;
    }
    return this.completesAt(this.closedTurnCount() + 1);
  }

  isComplete(): boolean {
    return this.completesAt(this.closedTurnCount());
  }

  state(): TuodState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...this.stage }], turns: cloneTurns(this.turns) };
  }
}

export const tuodEngineFactory: GameEngineFactory<
  Seated<TuodSnapshot>,
  TuodInput,
  TuodState
> = {
  rulesetVersionKey: "TUOD_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<TuodSnapshot>, prior?: EngineFacts) {
    return new TuodEngine(config, prior);
  },
};

registerEngineFactory(tuodEngineFactory);
