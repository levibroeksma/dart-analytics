import type { TuodSnapshot, Seated, SeatFact } from "@lib/types";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import { registerEngineFactory } from "./engine.registry";
import {
  appendCompletedTurn,
  appendResolvedDart,
  cloneTurns,
  isDartObservationInput,
  openOrCreateTurn,
  openVisit,
  resolveObservation,
  sumDartScores,
  turnsBeforeVisit,
  undoLastUnit,
} from "./turn-log.module";
import { activeSeat } from "./seat-rota.module";
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  StageFact,
  TuodAttemptInput,
  TuodInput,
  TuodSeatState,
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
 * The ladder ceiling: the highest three-dart double-out total that exists
 * on a standard board (T20 T20 D25). A success climbs the ladder by
 * `finishBonus` with no cap of its own; clamping here keeps it from
 * walking onto a target no double can ever finish. Duplicated from
 * `tuod.validator.ts`'s own `MAX_THREE_DART_CHECKOUT` rather than shared
 * across the services/engine layer boundary — same value, same reasoning,
 * independently arrived at there already.
 */
const MAX_FINISHABLE_TARGET = 170;

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

/** The highest number a single dart can double out on (D20 = 40). */
const MAX_SINGLE_DART_DOUBLE = 40;

/** The inner bull, scored as a double (worth 50, not on the D1-D20 ladder). */
const BULL_FINISH = 50;

/**
 * Whether `remainder` can still be finished by exactly one dart landing on a
 * double: the D1-D20 ladder (an even number from 2 to 40) or the bull (50).
 * Every odd remainder fails this, since no double scores odd; so does every
 * even remainder above 40 other than 50, since no double scores above 40 and
 * the bull is the sole exception.
 */
function finishableWithOneDart(remainder: number): boolean {
  return (
    (remainder % 2 === 0 && remainder <= MAX_SINGLE_DART_DOUBLE) ||
    remainder === BULL_FINISH
  );
}

/**
 * Whether a visit that scored `scored` off `remainingBefore`, with its last
 * dart landing in `lastZoneKey` and `dartsRemaining` darts still to throw,
 * has checked out or busted. Shared by `settleVisit` (which stamps the
 * resolved fact) and `wouldCompleteDart` (which only asks whether it would
 * resolve) so the bust/checkout rule — overshoot, exactly 1 left, reaching 0
 * without a double, or a last dart's remainder that no double can ever finish
 * (odd, since every double scores even; or even but above 40 and not the
 * bull, since no double scores that high) — is written once. The inner bull
 * is the double for its own remainder (50) exactly as `BULL_FINISH` and
 * `finishableWithOneDart` treat it, so `INNER_BULL` counts alongside
 * `DOUBLE` as the last dart landing on a double.
 */
function visitOutcome(
  remainingBefore: number,
  scored: number,
  lastZoneKey: DartZoneKey,
  dartsRemaining: number,
): { remainingAfter: number; checkedOut: boolean; busted: boolean } {
  const outcome = resolveCheckoutAttempt(
    remainingBefore,
    scored,
    lastZoneKey === "DOUBLE" || lastZoneKey === "INNER_BULL",
  );
  const busted =
    outcome.busted ||
    (dartsRemaining === 1 &&
      outcome.remainingAfter > 1 &&
      !finishableWithOneDart(outcome.remainingAfter));
  return { ...outcome, busted };
}

function initialSeatState(config: TuodSnapshot, seat: SeatFact): TuodSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    currentTarget: config.startingTarget,
    attempts: 0,
    successes: 0,
    failures: 0,
  };
}

/** The ladder as it stands before any attempt: every seat on the configured start target. */
export function initialTuodState(config: Seated<TuodSnapshot>): TuodState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map((seat) => initialSeatState(config, seat)),
  };
}

/**
 * Pure reducer: folds one resolved attempt onto one seat's `TuodSeatState`. A
 * success moves the next target up by `finishBonus`; a failure moves it down
 * by `missPenalty`, floored at the double-out minimum.
 */
export function applyTuodAttempt(
  config: TuodSnapshot,
  state: TuodSeatState,
  succeeded: boolean,
): TuodSeatState {
  return {
    ...state,
    currentTarget: succeeded
      ? Math.min(
          MAX_FINISHABLE_TARGET,
          state.currentTarget + config.finishBonus,
        )
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
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to, mirroring `foldAroundTheClockState`.
 * Score-compare, highest target wins: both seats always play out their own
 * full ROUNDS budget (1v1 offers ROUNDS only — see `tuod-setup.data.ts`).
 * `activeSeat` IS passed a real completion predicate here (the 4-argument
 * form), reading each seat's own `durationSeatComplete`; it is structurally a
 * no-op, because every seat's budget is the same fixed count and lockstep
 * alternation already lands each seat on its own last round together. It is
 * passed anyway so the fold stays correct if that budget ever stops being
 * uniform — unlike Around the Clock's, whose predicate does real work today.
 * A solo (1-seat) session's own `status`
 * always reads `IN_PROGRESS` here — solo completion is read off
 * `TuodEngine.isComplete()` instead, never off this field.
 */
export function foldTuodState(
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  timerExpired: boolean,
): TuodState {
  const seats = config.seats.map((seat) => {
    let state = initialSeatState(config, seat);
    const seatTurns = facts.turns.filter(
      (turn) =>
        turn.participantRef === seat.participantRef &&
        turn.completedAt !== null,
    );
    for (const turn of seatTurns) {
      state = applyTuodAttempt(config, state, turn.totalScore > 0);
    }
    return state;
  });

  const completedSeats = seats.map((seat) =>
    durationSeatComplete(config, seat.attempts, timerExpired),
  );
  const outcome = scoreCompareOutcome(
    seats.map((seat, index) => ({
      sideKey: seat.sideKey,
      completed: completedSeats[index],
      metric: seat.currentTarget,
    })),
    "HIGHEST",
    "IN_PROGRESS",
  );

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      completedByIndex(seats, completedSeats),
    ).participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    timerExpired,
    seats,
  };
}

/**
 * Ten Up One Down: a checkout ladder per seat, starting at `startingTarget`,
 * climbing `finishBonus` on a checked-out attempt and falling `missPenalty`
 * on a failed one, played for a ROUNDS duration in 1v1 (MINUTES stays solo
 * -only — a single wall-clock timer running through two seats' alternating
 * turns is a separate, deferred capture problem). Score-compare: both seats
 * always play their own full round budget, then whichever reached the higher
 * target wins.
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

  private deriveState(): TuodState {
    return foldTuodState(
      { stages: [this.stage], turns: this.turns },
      this.config,
      this.timerExpired,
    );
  }

  /** Appends an empty attempt for `activeParticipantRef` and returns it. */
  private openNewVisit(activeParticipantRef: string): TurnFact {
    return openOrCreateTurn(
      this.turns,
      this.stage.clientKey,
      activeParticipantRef,
      () => false,
    );
  }

  /**
   * The target `visit` was thrown at — every turn strictly before `visit` in
   * `this.turns` is always already closed (an engine only ever has one open
   * turn, the last one), so folding them through `foldTuodState` is safe and
   * exact. Mirrors `OneTwentyOneEngine.remainingBeforeVisit`.
   */
  private targetBeforeVisit(visit: TurnFact): number {
    return foldTuodState(
      { stages: [this.stage], turns: turnsBeforeVisit(this.turns, visit) },
      this.config,
      this.timerExpired,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!
      .currentTarget;
  }

  /**
   * Whether the WHOLE (2-seat) session's score-compare outcome is already
   * settled. Deliberately narrower than `isComplete()`, mirroring
   * `ScoreTrainingEngine.isMatchDecided()` (D229): a solo session is exempt
   * here because MINUTES completion there is driven by `timerExpired`, an
   * external signal `expireTimer()` can set mid-attempt — `isComplete()` can
   * already read true before the one finishing attempt still needs to be
   * recorded, so a solo session's own boundary is that attempt-count-based
   * `isComplete()` reading, left to `tuod-play.data.ts` to consult directly,
   * never enforced here. A 1v1 match carries no such risk: it is
   * ROUNDS-only, so `status` only turns terminal as the direct result of
   * the very record call that reaches the last seat's budget.
   */
  private isMatchDecided(): boolean {
    const state = this.deriveState();
    return state.seats.length > 1 && state.status !== "IN_PROGRESS";
  }

  /**
   * Why `record()` would refuse this attempt, or null when it would accept it.
   * `wouldComplete()` reads the same answer, which is what keeps the pure
   * predicate and the mutating call in agreement about what is playable. A
   * keypad total is refused while a board visit is open — mirrors
   * `FiveOhOneEngine.recordVisitTotal`'s guard (D198) — so the two input
   * shapes never write across each other.
   */
  private rejectionReason(
    activeSeatState: TuodSeatState,
    input: TuodAttemptInput,
  ): string | null {
    if (this.isMatchDecided()) {
      return "Cannot record an attempt once the session is complete; undo first to correct it.";
    }
    if (openVisit(this.turns) !== null) {
      return "Finish the open attempt on the board before entering a keypad total.";
    }
    if (!isTuodSuccess(input)) {
      return null;
    }
    return checkoutDartsRejection(
      activeSeatState.currentTarget,
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
    const thrown = sumDartScores(visit.darts);
    const lastDart = visit.darts.at(-1)!;
    const { checkedOut, busted } = visitOutcome(
      this.targetBeforeVisit(visit),
      thrown,
      lastDart.hitZoneKey,
      this.config.maxDartsPerTurn - visit.darts.length,
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
   * `EXERCISE_BLOCK`. `openVisit()` reuses the trailing turn only while it is
   * still open — a visit only ever closes via `settleVisit`'s own
   * `completedAt` stamp, so a reused open turn is always the same seat's own
   * still-running attempt, never a stale, already-resolved one belonging to
   * whoever threw last.
   * @throws when the session is already complete; the fact log is left
   *   untouched.
   */
  private recordDart(observation: DartObservation): TuodState {
    if (this.isMatchDecided()) {
      throw new Error(
        "Cannot record an attempt once the session is complete; undo first to correct it.",
      );
    }
    const activeParticipantRef = this.deriveState().activeParticipantRef;

    const resolved = resolveObservation(observation);
    const visit =
      openVisit(this.turns) ?? this.openNewVisit(activeParticipantRef);

    appendResolvedDart(visit, observation, resolved);

    this.settleVisit(visit);
    return this.deriveState();
  }

  /**
   * Appends one whole-visit attempt reported by the keypad, for the currently
   * active seat. A checkout stores the target it was thrown at as the turn
   * total, since the counted board score of a double-out finish always
   * equals it; any failure — a miss, a checkout that did not finish on a
   * double, or a bust — stores `0`. `completedAt` is stamped here because a
   * keypad attempt is a single visit that resolves the moment it is reported.
   * @throws when the session has already ended, a board visit is open, or the
   *   attempt claims more darts than the ruleset allows; the fact log is left
   *   untouched in any case.
   */
  private recordAttemptTotal(input: TuodAttemptInput): TuodState {
    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const reason = this.rejectionReason(activeSeatState, input);
    if (reason) {
      throw new Error(reason);
    }

    const succeeded = isTuodSuccess(input);
    appendCompletedTurn(
      this.turns,
      this.stage.clientKey,
      before.activeParticipantRef,
      succeeded ? activeSeatState.currentTarget : 0,
    );

    return this.deriveState();
  }

  record(input: TuodInput): TuodState {
    if (isDartObservationInput(input)) {
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
    return undoLastUnit(this.turns);
  }

  /**
   * Whether recording `observation` right now would resolve the current (or a
   * fresh) attempt — by checkout, bust, or running out of darts — and that
   * resolution would be the WHOLE session's last permitted attempt: the
   * active seat reaching its own duration budget AND every other seat
   * already at theirs. Mirrors `recordAttemptTotal`'s own `wouldComplete`
   * reading (any resolved attempt can end a duration-bounded seat's own
   * budget, success or not), computed without mutating the fact log.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    if (this.isMatchDecided()) return false;

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const visit = openVisit(this.turns);
    const priorDarts = visit ? visit.darts : [];
    const target = visit
      ? this.targetBeforeVisit(visit)
      : activeSeatState.currentTarget;

    const resolved = resolveObservation(observation);
    const thrown =
      priorDarts.reduce((sum, dart) => sum + dart.score, 0) + resolved.score;
    const dartCount = priorDarts.length + 1;
    const { checkedOut, busted } = visitOutcome(
      target,
      thrown,
      resolved.zoneKey,
      this.config.maxDartsPerTurn - dartCount,
    );
    const visitResolves =
      checkedOut || busted || dartCount === this.config.maxDartsPerTurn;

    if (!visitResolves) return false;

    const allOtherSeatsComplete = otherSeatsComplete(
      before.seats,
      activeSeatState.participantRef,
      (seat) =>
        durationSeatComplete(this.config, seat.attempts, this.timerExpired),
    );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && allOtherSeatsComplete
    );
  }

  /**
   * Answers the finish-confirm gate without touching the fact log. An input
   * `record()` would reject never completes the session — the caller falls
   * through to `record()` and surfaces its error instead. For 1v1, the whole
   * session only completes once every OTHER seat has already finished its
   * own budget too, exactly as `AroundTheClockEngine.wouldComplete` reads it.
   */
  wouldComplete(input: TuodInput): boolean {
    if (isDartObservationInput(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (this.rejectionReason(activeSeatState, input) !== null) {
      return false;
    }

    const allOtherSeatsComplete = otherSeatsComplete(
      before.seats,
      activeSeatState.participantRef,
      (seat) =>
        durationSeatComplete(this.config, seat.attempts, this.timerExpired),
    );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && allOtherSeatsComplete
    );
  }

  /**
   * `foldTuodState`'s own `status` field reads `"IN_PROGRESS"` for a solo
   * (1-seat) session even once that seat is done — score-compare's status
   * only resolves once every OTHER seat is also complete, and a solo session
   * has no other seat to wait on. Solo completion is instead read directly
   * off that one seat's own attempt count against its own round budget —
   * exactly the pre-1v1 `completesAt(closedTurnCount())` reading, so a solo
   * session ends exactly when it always did.
   */
  isComplete(): boolean {
    const state = this.deriveState();
    if (state.seats.length === 1) {
      return durationSeatComplete(
        this.config,
        state.seats[0].attempts,
        this.timerExpired,
      );
    }
    return state.status !== "IN_PROGRESS";
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
