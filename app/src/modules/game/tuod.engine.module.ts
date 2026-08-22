import type { TuodSnapshot, Seated, SeatFact } from "@lib/types";
import { classify } from "@lib/game/board/board-geometry.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { newClientKey } from "./client-key.module";
import { registerEngineFactory } from "./engine.registry";
import { activeSeat } from "./seat-rota.module";
import { scoreCompareWinner } from "./match-outcome.module";
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

function seatCompletesAt(
  config: TuodSnapshot,
  attemptCount: number,
  timerExpired: boolean,
): boolean {
  if (config.durationType === "ROUNDS") {
    return attemptCount >= config.durationValue;
  }
  return timerExpired && attemptCount >= 1;
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to, mirroring `foldAroundTheClockState`.
 * Score-compare, highest target wins: both seats always play out their own
 * full ROUNDS budget (1v1 offers ROUNDS only — see `tuod-setup.data.ts`);
 * `activeSeat` never needs a completion predicate here because every seat's
 * budget is the same fixed count, so lockstep alternation already lands each
 * seat on its own last round together. A solo (1-seat) session's own `status`
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
    seatCompletesAt(config, seat.attempts, timerExpired),
  );
  const allComplete = completedSeats.every(Boolean);

  const winningSideKey =
    seats.length === 1
      ? null
      : scoreCompareWinner(
          seats.map((seat, index) => ({
            sideKey: seat.sideKey,
            completed: completedSeats[index],
            metric: seat.currentTarget,
          })),
          "HIGHEST",
        );

  const status: TuodState["status"] =
    seats.length === 1
      ? "IN_PROGRESS"
      : !allComplete
        ? "IN_PROGRESS"
        : winningSideKey !== null
          ? "COMPLETE"
          : "TIE";

  return {
    activeParticipantRef: activeSeat(
      facts,
      config.seats,
      "PER_SEAT",
      (candidate) => {
        const index = seats.findIndex(
          (seat) => seat.participantRef === candidate.participantRef,
        );
        return index === -1 ? false : completedSeats[index];
      },
    ).participantRef,
    status,
    winningSideKey,
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

  /** The attempt still being thrown on the board, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /** Appends an empty attempt for `activeParticipantRef` and returns it. */
  private openNewVisit(activeParticipantRef: string): TurnFact {
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      participantRef: activeParticipantRef,
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
   * turn, the last one), so folding them through `foldTuodState` is safe and
   * exact. Mirrors `OneTwentyOneEngine.remainingBeforeVisit`.
   */
  private targetBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return foldTuodState(
      { stages: [this.stage], turns: this.turns.slice(0, index) },
      this.config,
      this.timerExpired,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!
      .currentTarget;
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
  private rejectionReason(
    activeSeatState: TuodSeatState,
    input: TuodAttemptInput,
  ): string | null {
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
   * `EXERCISE_BLOCK`. `openVisit()` reuses the trailing turn only while it is
   * still open — a visit only ever closes via `settleVisit`'s own
   * `completedAt` stamp, so a reused open turn is always the same seat's own
   * still-running attempt, never a stale, already-resolved one belonging to
   * whoever threw last.
   * @throws when the session is already complete; the fact log is left
   *   untouched.
   */
  private recordDart(observation: DartObservation): TuodState {
    if (this.isComplete()) {
      throw new Error(
        "Cannot record an attempt once the session is complete; undo first to correct it.",
      );
    }
    const activeParticipantRef = this.deriveState().activeParticipantRef;

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit(activeParticipantRef);

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
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: this.stage.clientKey,
      participantRef: before.activeParticipantRef,
      sequence: this.turns.length + 1,
      completedAt: new Date().toISOString(),
      totalScore: succeeded ? activeSeatState.currentTarget : 0,
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
   * resolution would be the WHOLE session's last permitted attempt: the
   * active seat reaching its own duration budget AND every other seat
   * already at theirs. Mirrors `recordAttemptTotal`'s own `wouldComplete`
   * reading (any resolved attempt can end a duration-bounded seat's own
   * budget, success or not), computed without mutating the fact log.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    if (this.isComplete()) return false;

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const visit = this.openVisit();
    const priorDarts = visit ? visit.darts : [];
    const target = visit
      ? this.targetBeforeVisit(visit)
      : activeSeatState.currentTarget;

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

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) =>
        seatCompletesAt(this.config, seat.attempts, this.timerExpired),
      );
    return (
      seatCompletesAt(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && otherSeatsComplete
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
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (this.rejectionReason(activeSeatState, input) !== null) {
      return false;
    }

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) =>
        seatCompletesAt(this.config, seat.attempts, this.timerExpired),
      );
    return (
      seatCompletesAt(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && otherSeatsComplete
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
      return seatCompletesAt(
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
