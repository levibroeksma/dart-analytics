import type { TuodSnapshot, Seated, SeatFact } from "@lib/types";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import {
  foldCheckoutSeats,
  initialCheckoutSeat,
} from "./checkout-kernel.module";
import { ladderTarget, storedTotalJudge } from "./checkout-policies";
import {
  dartGameEngineClass,
  dartGameEngineFactory,
} from "./dart-engine-shell.module";
import { registerEngineFactory } from "./engine.registry";
import {
  isDartObservationInput,
  resolveObservation,
  sumDartScores,
} from "./turn-log.module";
import { activeSeat } from "./seat-rota.module";
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
import { scoreCompareOutcome } from "./match-outcome.module";
import type { CheckoutRules, DartGameSpec } from "./interfaces";
import type {
  CheckoutSeat,
  DartObservation,
  DartZoneKey,
  EngineFacts,
  TuodAttemptInput,
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
 * has checked out or busted. Shared by the spec's close (`isTuodVisitOpen`,
 * `settledTotal`) and `wouldComplete` so the bust/checkout rule — overshoot, exactly 1 left, reaching 0
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

const SESSION_COMPLETE =
  "Cannot record an attempt once the session is complete; undo first to correct it.";

const OPEN_VISIT_REFUSAL =
  "Finish the open attempt on the board before entering a keypad total.";

function initialSeat(config: TuodSnapshot): CheckoutSeat<null> {
  return initialCheckoutSeat(config.startingTarget, null);
}

function seatState(
  seat: CheckoutSeat<null>,
  identity: SeatFact,
): TuodSeatState {
  return {
    participantRef: identity.participantRef,
    sideKey: identity.sideKey,
    currentTarget: seat.target,
    remainingInAttempt: seat.remaining,
    attempts: seat.attempts,
    successes: seat.checkouts,
    failures: seat.attempts - seat.checkouts,
  };
}

function rules(config: TuodSnapshot): CheckoutRules<null> {
  return {
    visitsPerAttempt: 1,
    judge: storedTotalJudge,
    onAttemptClose: (seat) => seat,
    nextTarget: ladderTarget(
      config.finishBonus,
      config.missPenalty,
      MIN_FINISHABLE_TARGET,
      MAX_FINISHABLE_TARGET,
    ),
  };
}

/** The ladder as it stands before any attempt: every seat on the configured start target. */
export function initialTuodState(config: Seated<TuodSnapshot>): TuodState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map((seat) => seatState(initialSeat(config), seat)),
  };
}

/**
 * Pure reducer: folds one resolved attempt onto one seat's `TuodSeatState`. A
 * success moves the next target up by `finishBonus`; a failure moves it down
 * by `missPenalty`, floored at the double-out minimum. `remainingInAttempt`
 * resets to the new target: the attempt this closes is over, and the next
 * one starts on the ladder, never on a carried-over remainder.
 */
export function applyTuodAttempt(
  config: TuodSnapshot,
  state: TuodSeatState,
  succeeded: boolean,
): TuodSeatState {
  const currentTarget = rules(config).nextTarget(
    { ...initialSeat(config), target: state.currentTarget },
    succeeded,
  )!;
  return {
    ...state,
    currentTarget,
    remainingInAttempt: currentTarget,
    attempts: state.attempts + 1,
    successes: succeeded ? state.successes + 1 : state.successes,
    failures: succeeded ? state.failures : state.failures + 1,
  };
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * shell's `deriveState()` delegates to, mirroring `foldAroundTheClockState`.
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
 *
 * Only closed turns move the ladder; the open turn, if any, overlays a live
 * subtraction onto its own seat's `remainingInAttempt` and nothing else, so
 * a board session sees the score fall dart by dart while `currentTarget`
 * holds until the attempt resolves (#202). The subtraction reads the open
 * turn's darts rather than its `totalScore`, which TUOD leaves at 0 until
 * `settledTotal` decides whether the attempt scored at all.
 */
export function foldTuodState(
  facts: EngineFacts,
  config: Seated<TuodSnapshot>,
  timerExpired: boolean,
): TuodState {
  const seats = foldCheckoutSeats(
    facts.turns,
    config.seats,
    initialSeat(config),
    rules(config),
  ).map((seat, index) => seatState(seat, config.seats[index]));

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

function ownSeat(state: TuodState, participantRef: string): TuodSeatState {
  return state.seats.find((seat) => seat.participantRef === participantRef)!;
}

/**
 * Whether the session takes no more input: a decided 1v1 match, or a solo
 * ROUNDS session whose budget is played. A solo MINUTES session never reads
 * closed here; its timer ends it through `isComplete()`.
 */
function inputClosed(state: TuodState, config: Seated<TuodSnapshot>): boolean {
  if (state.seats.length > 1) return state.status !== "IN_PROGRESS";
  return durationSeatComplete(config, state.seats[0].attempts, false);
}

/**
 * Whether the dart just thrown closes the visit — a checkout, a bust, or the
 * last dart — against the target the visit started on. Shared by the shell's
 * reuse and close tests, `closedVisitTotal` and `wouldComplete`, so the rule
 * is written once.
 */
function resolveVisit(
  target: number,
  darts: readonly { score: number; hitZoneKey: DartZoneKey }[],
  maxDarts: number,
): { resolved: boolean; scored: boolean } {
  const last = darts.at(-1)!;
  const { checkedOut, busted } = visitOutcome(
    target,
    darts.reduce((sum, dart) => sum + dart.score, 0),
    last.hitZoneKey,
    maxDarts - darts.length,
  );
  return {
    resolved: checkedOut || busted || darts.length === maxDarts,
    scored: checkedOut && !busted,
  };
}

function isTuodVisitOpen(
  turn: TurnFact,
  state: TuodState,
  config: Seated<TuodSnapshot>,
): boolean {
  if (turn.completedAt !== null) return false;
  if (turn.darts.length === 0) return true;
  return !resolveVisit(
    ownSeat(state, turn.participantRef).currentTarget,
    turn.darts,
    config.maxDartsPerTurn,
  ).resolved;
}

function settledTotal(
  opened: TuodState,
  _closed: TuodState,
  participantRef: string,
  turn: TurnFact,
  config: Seated<TuodSnapshot>,
): number {
  const target = ownSeat(opened, participantRef).currentTarget;
  return resolveVisit(target, turn.darts, config.maxDartsPerTurn).scored
    ? sumDartScores(turn.darts)
    : 0;
}

function tuodVisitRefusal(
  state: TuodState,
  input: TuodAttemptInput,
  config: Seated<TuodSnapshot>,
  open: TurnFact | null,
): string | null {
  if (inputClosed(state, config)) return SESSION_COMPLETE;
  if (open !== null) return OPEN_VISIT_REFUSAL;
  if (!isTuodSuccess(input)) return null;
  return checkoutDartsRejection(
    ownSeat(state, state.activeParticipantRef).currentTarget,
    input.dartsUsed,
    input.dartsAtDouble,
    config.maxDartsPerTurn,
  );
}

function wouldCompleteSession(
  state: TuodState,
  input: DartObservation | TuodAttemptInput,
  config: Seated<TuodSnapshot>,
  open: TurnFact | null,
): boolean {
  if (inputClosed(state, config)) return false;
  const seat = ownSeat(state, state.activeParticipantRef);
  if (isDartObservationInput(input)) {
    const resolved = resolveObservation(input);
    const darts = [
      ...(open?.darts ?? []),
      { score: resolved.score, hitZoneKey: resolved.zoneKey },
    ];
    const target = open
      ? ownSeat(state, open.participantRef).currentTarget
      : seat.currentTarget;
    if (!resolveVisit(target, darts, config.maxDartsPerTurn).resolved)
      return false;
  } else if (tuodVisitRefusal(state, input, config, open) !== null) {
    return false;
  }
  return (
    durationSeatComplete(config, seat.attempts + 1, state.timerExpired) &&
    otherSeatsComplete(state.seats, seat.participantRef, (other) =>
      durationSeatComplete(config, other.attempts, state.timerExpired),
    )
  );
}

const tuodSpec: DartGameSpec<
  Seated<TuodSnapshot>,
  TuodState,
  TuodAttemptInput
> = {
  rulesetVersionKey: "TUOD_V1",
  stageOwnership: "PER_SEAT",
  fold: foldTuodState,
  refusal: (state, config) =>
    inputClosed(state, config) ? SESSION_COMPLETE : null,
  isVisitOpen: isTuodVisitOpen,
  wouldComplete: wouldCompleteSession,
  closedVisitTotal: settledTotal,
  visitInput: {
    isVisit: (input): input is TuodAttemptInput =>
      !isDartObservationInput(input),
    refusal: tuodVisitRefusal,
    total: (state, input) =>
      isTuodSuccess(input)
        ? ownSeat(state, state.activeParticipantRef).currentTarget
        : 0,
  },
  coordinateCapture: true,
  complete: (state, config) =>
    state.seats.length === 1
      ? durationSeatComplete(
          config,
          state.seats[0].attempts,
          state.timerExpired,
        )
      : state.status !== "IN_PROGRESS",
};

/**
 * Ten Up One Down: a checkout ladder per seat, starting at `startingTarget`,
 * climbing `finishBonus` on a checked-out attempt and falling `missPenalty`
 * on a failed one, played for a ROUNDS duration in 1v1 (MINUTES stays solo
 * -only — a single wall-clock timer running through two seats' alternating
 * turns is a separate, deferred capture problem). Score-compare: both seats
 * always play their own full round budget, then whichever reached the higher
 * target wins. On the Checkout kernel and the game shell; a board visit or a
 * keypad total is one attempt.
 */
export class TuodEngine extends dartGameEngineClass(tuodSpec) {}

export const tuodEngineFactory = dartGameEngineFactory(tuodSpec, TuodEngine);

registerEngineFactory(tuodEngineFactory);
