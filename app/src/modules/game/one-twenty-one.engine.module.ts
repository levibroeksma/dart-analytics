import type {
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  Seated,
} from "@lib/types";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import { isCheckoutReachable } from "./checkout-reachability.module";
import {
  applyCheckoutVisit,
  foldCheckoutSeats,
  initialCheckoutSeat,
} from "./checkout-kernel.module";
import {
  ladderTarget,
  untilWon,
  walkTotalJudge,
  winAtCap,
} from "./checkout-policies";
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
import { raceWinner } from "./match-outcome.module";
import type {
  CheckoutRules,
  DartGameSpec,
  GameEngineFactory,
} from "./interfaces";
import type {
  CheckoutSeat,
  DartFact,
  DartObservation,
  EngineFacts,
  OneTwentyOneInput,
  OneTwentyOneSeatState,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  SeatState,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const DARTS_PER_VISIT = 3;
const MAX_VISIT_SCORE = 180;

/**
 * Both ruleset versions' seated config, unioned. `121_V1`'s carries no
 * duration fields at all (its schema is `{}`); `121_V2`'s always carries
 * `durationType`, and `durationValue` when the mode needs one.
 */
type OneTwentyOneEngineConfig =
  Seated<OneTwentyOneSnapshot> | Seated<OneTwentyOneV2Snapshot>;

/**
 * Normalizes either ruleset version's config into one shape. `"durationType"
 * in config` is false for every `121_V1` config (an empty `{seats}` — the
 * key is genuinely absent, not merely `undefined`), so a `121_V1`-created
 * engine always reads `TARGET` here regardless of what config it is handed —
 * behaviour identical to today, byte for byte.
 */
export function durationOf(config: OneTwentyOneEngineConfig): {
  durationType: "TARGET" | "ROUNDS" | "MINUTES";
  durationValue?: number;
} {
  if ("durationType" in config) {
    return {
      durationType: config.durationType,
      durationValue: config.durationValue,
    };
  }
  return { durationType: "TARGET" };
}

/**
 * Builds the `ROUND` stage for attempt `sequence`. Rounds are root stages —
 * 121 has no enclosing MATCH or SET stage, so every round's `parentClientKey`
 * is null and its `sequence` is its position in the session.
 */
function roundStage(sequence: number): StageFact {
  return {
    clientKey: `round-${sequence}`,
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence,
  };
}

/** A visit score is playable only as a whole number in `0..180`. */
function isPlayableVisitScore(scoreAttempted: number): boolean {
  return (
    Number.isInteger(scoreAttempted) &&
    scoreAttempted >= 0 &&
    scoreAttempted <= MAX_VISIT_SCORE
  );
}

/** The ladder on the Checkout kernel: 3 visits per attempt, +1 on a pass up to the cap, which wins. */
function rules(): CheckoutRules<null> {
  return {
    visitsPerAttempt: VISITS_PER_ATTEMPT,
    judge: walkTotalJudge,
    onAttemptClose: winAtCap(CAP_TARGET),
    nextTarget: untilWon(ladderTarget(1, 0, START_TARGET, CAP_TARGET)),
  };
}

function initialSeat(): CheckoutSeat<null> {
  return initialCheckoutSeat(START_TARGET, null);
}

/** Projects a kernel seat onto `OneTwentyOneSeatState`; a `WON` seat has 0 remaining. */
function seatState(
  seat: CheckoutSeat<null>,
  identity: SeatState,
): OneTwentyOneSeatState {
  const won = seat.status === "WON";
  return {
    participantRef: identity.participantRef,
    sideKey: identity.sideKey,
    currentTarget: seat.target,
    remainingInAttempt: won ? 0 : seat.remaining,
    visitsThisAttempt: seat.visitIndex,
    status: won ? "WON" : "IN_PROGRESS",
    attemptsCompleted: seat.attempts,
  };
}

/** The kernel seat a `OneTwentyOneSeatState` stands for, with its visit starting from `remainingInAttempt`. */
function seatFromState(state: OneTwentyOneSeatState): CheckoutSeat<null> {
  return {
    ...initialSeat(),
    target: state.currentTarget,
    visitStart: state.remainingInAttempt,
    remaining: state.remainingInAttempt,
    visitIndex: state.visitsThisAttempt,
    attemptIndex: state.attemptsCompleted,
    attempts: state.attemptsCompleted,
  };
}

/** A closed, dartless visit carrying `totalScore`. */
function storedVisit(totalScore: number): TurnFact {
  return {
    clientKey: "",
    stageClientKey: "",
    participantRef: "",
    sequence: 0,
    completedAt: "",
    totalScore,
    darts: [],
  };
}

/** 121 starting state: every configured seat at 121, seat 0 active, nobody has won. */
export function initialOneTwentyOneState(
  config: Seated<OneTwentyOneSnapshot>,
): OneTwentyOneState {
  return {
    activeParticipantRef: config.seats[0].participantRef,
    status: "IN_PROGRESS",
    winningSideKey: null,
    timerExpired: false,
    seats: config.seats.map((seat) => seatState(initialSeat(), seat)),
  };
}

/**
 * Resolves one visit against the remaining score of the attempt in play,
 * under the same bust matrix 501 uses: an overshoot busts; leaving exactly 1
 * busts because 1 cannot be finished on a double (D1 = 2); reaching exactly 0
 * busts unless the visit declares `finishedOnDouble`. A bust scores 0 and
 * leaves the remaining score untouched.
 */
function resolveOneTwentyOneVisit(
  remainingInAttempt: number,
  input: OneTwentyOneVisitInput,
): OneTwentyOneVisitOutcome {
  const outcome = resolveCheckoutAttempt(
    remainingInAttempt,
    input.scoreAttempted,
    input.finishedOnDouble === true,
  );

  if (outcome.busted) {
    return {
      isBust: true,
      scored: 0,
      checkedOut: false,
      remainingAfter: remainingInAttempt,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    checkedOut: outcome.checkedOut,
    remainingAfter: outcome.remainingAfter,
  };
}

/**
 * Why the reported dart counts are impossible for the visit being recorded, or
 * null when they fit it. Mirrors 501's guard: only a claimed checkout is
 * checked against the chart, and the counts are never persisted — a 121 visit
 * carries no dart rows under quick score.
 */
function checkoutDartsRejectionFor(
  seat: OneTwentyOneSeatState,
  input: OneTwentyOneVisitInput,
): string | null {
  if (input.finishedOnDouble !== true) return null;
  return checkoutDartsRejection(
    seat.remainingInAttempt,
    input.dartsUsed,
    input.dartsAtDouble,
    DARTS_PER_VISIT,
  );
}

/**
 * Whether the attempt's final (3rd) visit can no longer reach a double-out
 * finish with the darts still in hand; visits 1 and 2 never close this way.
 * `dartsThrown` is the visit's dart count so far.
 */
function finalVisitHasNoFinishLeft(
  visitIndex: number,
  remainingAfter: number,
  dartsThrown: number,
): boolean {
  return (
    visitIndex === VISITS_PER_ATTEMPT - 1 &&
    !isCheckoutReachable(remainingAfter, DARTS_PER_VISIT - dartsThrown)
  );
}

/**
 * Folds one FINISHED visit onto one seat's `OneTwentyOneSeatState`, as one
 * Checkout kernel step on the visit's stored total. A checkout at the cap
 * target (170) wins that seat's own race; any other checkout climbs the
 * target by one and opens a fresh 3-visit budget. A visit that neither checks
 * out nor is the attempt's 3rd carries its remaining score to the next visit;
 * the 3rd non-checkout visit stays on the same target with a fresh budget.
 * @throws when `scoreAttempted` is not a whole number within `0..180`, when
 *   the reported dart counts cannot finish the visit, or when the seat is
 *   already complete; the caller's state is left untouched.
 */
export function applyOneTwentyOneVisit(
  state: OneTwentyOneSeatState,
  input: OneTwentyOneVisitInput,
): OneTwentyOneSeatState {
  if (!isPlayableVisitScore(input.scoreAttempted)) {
    throw new Error(`Enter a score between 0 and ${MAX_VISIT_SCORE}.`);
  }
  const dartsRejection = checkoutDartsRejectionFor(state, input);
  if (dartsRejection) {
    throw new Error(dartsRejection);
  }
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a visit once the session is complete; undo first to correct it.",
    );
  }
  const scored = resolveOneTwentyOneVisit(
    state.remainingInAttempt,
    input,
  ).scored;
  return seatState(
    applyCheckoutVisit(seatFromState(state), storedVisit(scored), rules()),
    state,
  );
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own state delegates to and `one-twenty-one-play.data.ts` calls
 * directly for reactive display, so the engine and the play page can never
 * disagree about whose throw it is or what any seat's ladder position is.
 *
 * Every seat folds its own turns on the Checkout kernel; a seat's open turn
 * shows its live remainder without counting as a visit.
 *
 * A solo (1-seat) session's `winningSideKey` is always null: a lone seat
 * checking out at 170 is the only `finished` entry `raceWinner` would see.
 * Solo completion is read off `status` instead.
 *
 * `timerExpired` is threaded through so `state().timerExpired` is readable;
 * `ROUNDS`/`MINUTES` completion is the engine's `isComplete()`, not the fold's.
 */
export function foldOneTwentyOneState(
  facts: EngineFacts,
  config: OneTwentyOneEngineConfig,
  timerExpired: boolean,
): OneTwentyOneState {
  const seats = foldCheckoutSeats(
    facts.turns,
    config.seats,
    initialSeat(),
    rules(),
  ).map((seat, index) => seatState(seat, config.seats[index]));

  const winningSideKey =
    seats.length === 1
      ? null
      : raceWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            finished: seat.status === "WON",
          })),
        );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: seats.some((seat) => seat.status === "WON") ? "WON" : "IN_PROGRESS",
    winningSideKey,
    timerExpired,
    seats,
  };
}

function ownSeat(
  state: OneTwentyOneState,
  participantRef: string,
): OneTwentyOneSeatState {
  return state.seats.find((seat) => seat.participantRef === participantRef)!;
}

/**
 * Settles a board visit's darts from `start`: a bust closes it stored as 0;
 * otherwise it closes on a checkout, on the 3rd dart, or on the attempt's
 * final visit once no double-out remains, stored as the darts' sum.
 */
function resolveDartVisit(
  start: number,
  visitIndex: number,
  darts: readonly DartFact[],
): { resolved: boolean; total: number } {
  const thrown = sumDartScores(darts);
  const last = darts.at(-1)!;
  const outcome = resolveCheckoutAttempt(
    start,
    thrown,
    last.hitZoneKey === "DOUBLE" || last.hitZoneKey === "INNER_BULL",
  );
  if (outcome.busted) return { resolved: true, total: 0 };
  return {
    resolved:
      outcome.checkedOut ||
      darts.length === DARTS_PER_VISIT ||
      finalVisitHasNoFinishLeft(
        visitIndex,
        outcome.remainingAfter,
        darts.length,
      ),
    total: thrown,
  };
}

/** Whether a board visit still takes darts; `state` shows its seat's live remainder. */
function isOneTwentyOneVisitOpen(
  turn: TurnFact,
  state: OneTwentyOneState,
): boolean {
  if (turn.completedAt !== null) return false;
  if (turn.darts.length === 0) return true;
  const seat = ownSeat(state, turn.participantRef);
  return !resolveDartVisit(
    seat.remainingInAttempt + sumDartScores(turn.darts),
    seat.visitsThisAttempt,
    turn.darts,
  ).resolved;
}

/** The total a closing board visit stores, judged from the seat before it opened. */
function settledTotal(
  opened: OneTwentyOneState,
  _closed: OneTwentyOneState,
  participantRef: string,
  turn: TurnFact,
): number {
  const seat = ownSeat(opened, participantRef);
  return resolveDartVisit(
    seat.remainingInAttempt,
    seat.visitsThisAttempt,
    turn.darts,
  ).total;
}

function activeSeatOf(state: OneTwentyOneState): OneTwentyOneSeatState {
  return ownSeat(state, state.activeParticipantRef);
}

/** Why a keypad total is refused now, or null; `open` is a board visit still taking darts. */
function visitRefusal(
  state: OneTwentyOneState,
  input: OneTwentyOneVisitInput,
  _config: OneTwentyOneEngineConfig,
  open: TurnFact | null,
): string | null {
  if (state.status !== "IN_PROGRESS")
    return "Cannot record a visit once the match has ended; undo first to correct it.";
  if (open !== null)
    return "Finish the open visit on the board before entering a keypad total.";
  if (!isPlayableVisitScore(input.scoreAttempted))
    return `Enter a score between 0 and ${MAX_VISIT_SCORE}.`;
  return checkoutDartsRejectionFor(activeSeatOf(state), input);
}

/**
 * Whether a checkout leaving the sole seat's `attemptsCompleted` at
 * `attemptsAfter` also meets the session's duration rule.
 */
function durationSatisfied(
  config: OneTwentyOneEngineConfig,
  attemptsAfter: number,
  timerExpired: boolean,
): boolean {
  const { durationType, durationValue } = durationOf(config);
  if (durationType === "ROUNDS") return attemptsAfter >= (durationValue ?? 0);
  if (durationType === "MINUTES") return timerExpired;
  return false;
}

/** The dart counterpart of `wouldCompleteSession`: one dart checking out the live remainder. */
function wouldCompleteDart(
  seat: OneTwentyOneSeatState,
  observation: DartObservation,
  config: OneTwentyOneEngineConfig,
  timerExpired: boolean,
): boolean {
  const resolved = resolveObservation(observation);
  const { checkedOut } = resolveCheckoutAttempt(
    seat.remainingInAttempt,
    resolved.score,
    resolved.zoneKey === "DOUBLE" || resolved.zoneKey === "INNER_BULL",
  );
  if (!checkedOut) return false;
  if (seat.currentTarget === CAP_TARGET) return true;
  return durationSatisfied(config, seat.attemptsCompleted + 1, timerExpired);
}

/**
 * Whether recording `input` closes the active seat's attempt with a checkout
 * (climb or cap) that also completes the session. Only a checkout is
 * predicted; a 3rd-visit fail that ends the session completes silently.
 */
function wouldCompleteSession(
  state: OneTwentyOneState,
  input: OneTwentyOneInput,
  config: OneTwentyOneEngineConfig,
): boolean {
  if (state.status !== "IN_PROGRESS") return false;
  const seat = activeSeatOf(state);
  if (isDartObservationInput(input))
    return wouldCompleteDart(seat, input, config, state.timerExpired);
  if (!isPlayableVisitScore(input.scoreAttempted)) return false;
  if (checkoutDartsRejectionFor(seat, input) !== null) return false;
  const after = applyOneTwentyOneVisit(seat, input);
  if (after.status === "WON") return true;
  if (!resolveOneTwentyOneVisit(seat.remainingInAttempt, input).checkedOut)
    return false;
  return durationSatisfied(config, after.attemptsCompleted, state.timerExpired);
}

/**
 * A cap checkout ends the session in every `durationType`. `ROUNDS` also
 * ends it once the sole seat's `attemptsCompleted` reaches `durationValue`;
 * `MINUTES` once the clock has run out and an attempt has closed since
 * (`expiredAt`). Reads seat 0 — `ROUNDS`/`MINUTES` are solo by setup-UI
 * convention, not an engine guard.
 */
function isOneTwentyOneComplete(
  state: OneTwentyOneState,
  config: OneTwentyOneEngineConfig,
  expiredAt: OneTwentyOneState | null,
): boolean {
  if (state.status === "WON") return true;
  const { durationType, durationValue } = durationOf(config);
  if (durationType === "TARGET") return false;
  const seat = state.seats[0];
  if (durationType === "ROUNDS")
    return seat.attemptsCompleted >= (durationValue ?? 0);
  return (
    state.timerExpired &&
    seat.attemptsCompleted > (expiredAt?.seats[0].attemptsCompleted ?? 0)
  );
}

/** The round the state plays in: one per closed attempt across the seats, none after a win. */
function roundOf(state: OneTwentyOneState): StageFact {
  return roundStage(
    1 +
      state.seats.reduce(
        (rounds, seat) =>
          rounds + seat.attemptsCompleted - (seat.status === "WON" ? 1 : 0),
        0,
      ),
  );
}

const oneTwentyOneSpec: DartGameSpec<
  OneTwentyOneEngineConfig,
  OneTwentyOneState,
  OneTwentyOneVisitInput
> = {
  rulesetVersionKey: "121_V1",
  rulesetVersionKeys: ["121_V2"],
  stageOwnership: "PER_SEAT",
  fold: foldOneTwentyOneState,
  refusal: (state) =>
    state.status !== "IN_PROGRESS"
      ? "Cannot record a visit once the match has ended"
      : null,
  isVisitOpen: isOneTwentyOneVisitOpen,
  wouldComplete: (state, input, config) =>
    wouldCompleteSession(state, input, config),
  closedVisitTotal: settledTotal,
  visitInput: {
    isVisit: (input): input is OneTwentyOneVisitInput =>
      !isDartObservationInput(input),
    refusal: visitRefusal,
    total: (state, input) =>
      resolveOneTwentyOneVisit(activeSeatOf(state).remainingInAttempt, input)
        .scored,
  },
  coordinateCapture: true,
  liveTotal: true,
  complete: isOneTwentyOneComplete,
  stageFor: roundOf,
};

/**
 * 121: a checkout ladder from 121 to 170, each target attempted in up to 3
 * visits (9 darts) and won by a visit whose final dart lands in a double.
 * Race-to-finish: the first seat to check out at the cap target (170) wins
 * the match immediately — the trailing seat never gets another turn. Under
 * QUICK_SCORE a visit total is one dartless turn; under VISUAL_BOARD the
 * engine takes one dart at a time. One `ROUND` stage per attempt.
 */
export class OneTwentyOneEngine extends dartGameEngineClass(oneTwentyOneSpec) {}

export const oneTwentyOneEngineFactory: GameEngineFactory<
  Seated<OneTwentyOneSnapshot>,
  OneTwentyOneInput,
  OneTwentyOneState
> = dartGameEngineFactory(oneTwentyOneSpec, OneTwentyOneEngine);

registerEngineFactory(oneTwentyOneEngineFactory);

export const oneTwentyOneV2EngineFactory: GameEngineFactory<
  Seated<OneTwentyOneV2Snapshot>,
  OneTwentyOneInput,
  OneTwentyOneState
> = dartGameEngineFactory(oneTwentyOneSpec, OneTwentyOneEngine, "121_V2");

registerEngineFactory(oneTwentyOneV2EngineFactory);
