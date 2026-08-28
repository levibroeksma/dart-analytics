import type { OneTwentyOneSnapshot, Seated, SeatFact } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
import { isCheckoutReachable } from "./checkout-path.module";
import { registerEngineFactory } from "./engine.registry";
import {
  appendResolvedDart,
  cloneTurns,
  openVisit,
  resolveObservation,
  undoStagedTurn,
} from "./turn-log.module";
import { activeSeat } from "./seat-rota.module";
import { raceWinner } from "./match-outcome.module";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartObservation,
  EngineFacts,
  OneTwentyOneInput,
  OneTwentyOneSeatState,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const DARTS_PER_VISIT = 3;
const MAX_VISIT_SCORE = 180;

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

/**
 * Discriminates `OneTwentyOneInput` by shape, never by session mode: only
 * `DartObservation` carries `hitZoneKey`, so its presence is a sound type
 * guard no matter which mode the session was created in — mirrors
 * `five-oh-one.engine.module.ts`'s `isDartObservation`.
 */
function isDartObservation(input: OneTwentyOneInput): input is DartObservation {
  return "hitZoneKey" in input;
}

function initialSeatState(seat: SeatFact): OneTwentyOneSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    currentTarget: START_TARGET,
    remainingInAttempt: START_TARGET,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
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
    seats: config.seats.map(initialSeatState),
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
 * finish with the darts still in hand — see `settleVisit`'s own doc for why
 * only that visit is checked this way. `dartsThrown` is the visit's dart
 * count so far, so `DARTS_PER_VISIT - dartsThrown` is what remains of it.
 */
function finalVisitHasNoFinishLeft(
  before: OneTwentyOneSeatState,
  remainingAfter: number,
  dartsThrown: number,
): boolean {
  const isFinalVisit = before.visitsThisAttempt === VISITS_PER_ATTEMPT - 1;
  return (
    isFinalVisit &&
    !isCheckoutReachable(remainingAfter, DARTS_PER_VISIT - dartsThrown)
  );
}

/**
 * Pure reducer: folds one FINISHED visit onto one seat's `OneTwentyOneSeatState`.
 * A checkout at the cap target (170) wins that seat's own race; any other
 * checkout climbs the target by one and opens a fresh 3-visit budget. A
 * visit that neither checks out nor is the attempt's 3rd carries its
 * remaining score to the next visit in the same attempt. The 3rd
 * non-checkout visit applies the v1 fail rule — stay on the same target with
 * a fresh budget — whether that visit busted or simply fell short.
 *
 * Callers must only fold a visit that has actually resolved (checked out,
 * busted, or reached its 3rd dart) — this always treats its input as a
 * finished visit and will prematurely count `visitsThisAttempt` for a visit
 * still being thrown. `OneTwentyOneEngine.deriveState()` enforces this split.
 * Operates on one seat at a time — the caller folds it once per seat,
 * filtering `this.turns` on that seat's own `participantRef` first.
 * @throws when the seat is already complete, or when `scoreAttempted` is not
 *   a whole number within `0..180`; the caller's state is left untouched.
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

  const outcome = resolveOneTwentyOneVisit(state.remainingInAttempt, input);

  if (outcome.checkedOut) {
    if (state.currentTarget === CAP_TARGET) {
      return {
        ...state,
        remainingInAttempt: 0,
        visitsThisAttempt: 0,
        status: "WON",
      };
    }
    const nextTarget = state.currentTarget + 1;
    return {
      ...state,
      currentTarget: nextTarget,
      remainingInAttempt: nextTarget,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
  }

  const visitsThisAttempt = state.visitsThisAttempt + 1;
  if (visitsThisAttempt < VISITS_PER_ATTEMPT) {
    return {
      ...state,
      remainingInAttempt: outcome.remainingAfter,
      visitsThisAttempt,
    };
  }

  return {
    ...state,
    remainingInAttempt: state.currentTarget,
    visitsThisAttempt: 0,
  };
}

/** Folds every CLOSED turn for one seat as the finished visit that produced it. */
function deriveClosedSeatState(
  seat: SeatFact,
  turns: readonly TurnFact[],
): OneTwentyOneSeatState {
  return turns
    .filter(
      (turn) =>
        turn.participantRef === seat.participantRef &&
        turn.completedAt !== null,
    )
    .reduce(
      (state, turn) =>
        applyOneTwentyOneVisit(state, {
          scoreAttempted: turn.totalScore,
          finishedOnDouble: true,
        }),
      initialSeatState(seat),
    );
}

/**
 * Folds the whole fact log into the session's state — the same function the
 * engine's own `deriveState()` delegates to and `one-twenty-one-play.data.ts`
 * calls directly for reactive display, so the engine and the play page can
 * never disagree about whose throw it is or what any seat's ladder position
 * is, mirroring `foldFiveOhOneState`.
 *
 * Every closed turn folds fully per seat (this is where `currentTarget` /
 * `visitsThisAttempt` / `status` come from); the currently open turn, if
 * any, only overlays a live subtraction onto that one seat's
 * `remainingInAttempt`, never touching its visit counter.
 *
 * A solo (1-seat) session's `winningSideKey` is always null: a lone seat
 * checking out at 170 is the only `finished` entry `raceWinner` would see,
 * so it would report that seat's own side as having beaten nobody. Solo
 * completion is read off `status` instead, the same `seats.length === 1`
 * gate every other multi-seat engine's win condition already carries.
 */
export function foldOneTwentyOneState(
  facts: EngineFacts,
  config: Seated<OneTwentyOneSnapshot>,
): OneTwentyOneState {
  const openVisit =
    facts.turns.at(-1)?.completedAt === null ? facts.turns.at(-1)! : null;

  const seats = config.seats.map((seat) => {
    const closed = deriveClosedSeatState(seat, facts.turns);
    if (openVisit && openVisit.participantRef === seat.participantRef) {
      return {
        ...closed,
        remainingInAttempt: closed.remainingInAttempt - openVisit.totalScore,
      };
    }
    return closed;
  });

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
    seats,
  };
}

/**
 * 121: a checkout ladder from 121 to 170, each target attempted in up to 3
 * visits (9 darts) and won by a visit whose final dart lands in a double.
 * Race-to-finish: the first seat to check out at the cap target (170) wins
 * the match immediately — the trailing seat never gets another turn. Under
 * QUICK_SCORE the engine owns one turn per visit, carrying the visit total
 * with no dart rows. Under VISUAL_BOARD it owns one dart at a time.
 */
export class OneTwentyOneEngine implements GameEngine<
  OneTwentyOneInput,
  OneTwentyOneState
> {
  readonly rulesetVersionKey = "121_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<OneTwentyOneSnapshot>,
    prior?: EngineFacts,
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : [roundStage(1)];
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): OneTwentyOneState {
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns },
      this.config,
    );
  }

  private openRound(): StageFact {
    const stage = this.stages.at(-1);
    if (!stage) {
      throw new Error("A 121 engine always has an open round stage.");
    }
    return stage;
  }

  private turnCountIn(stageClientKey: string): number {
    return this.turns.filter((turn) => turn.stageClientKey === stageClientKey)
      .length;
  }

  /** Appends an empty visit to the open round, for the given seat, and returns it. */
  private openNewVisit(activeParticipantRef: string): TurnFact {
    const round = this.openRound();
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      participantRef: activeParticipantRef,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * The seat state immediately before `visit` opened, for the seat that
   * threw it — every turn strictly before `visit` in `this.turns` is always
   * already closed (an engine only ever has one open turn, the last one), so
   * folding the whole log up to that point is safe and exact. `settleVisit`
   * reads both `remainingInAttempt` (to score the visit) and
   * `visitsThisAttempt` (to know whether `visit` is the attempt's last).
   */
  private seatBeforeVisit(visit: TurnFact): OneTwentyOneSeatState {
    const index = this.turns.indexOf(visit);
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns.slice(0, index) },
      this.config,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!;
  }

  /**
   * Appends one visit to the open round, then opens the next round's stage
   * when that visit resolved the active seat's attempt (checkout or a 3rd
   * non-checkout) and its own race continues. Stages and turns move
   * together so the log never holds a turn without its stage.
   * @throws when the match has already ended, when the active seat has
   *   already won its own race, or when the score is out of range; the fact
   *   log is left untouched.
   */
  private recordVisitTotal(input: OneTwentyOneVisitInput): OneTwentyOneState {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a visit once the match has ended; undo first to correct it.",
      );
    }
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    const after = applyOneTwentyOneVisit(activeSeatState, input);
    const outcome = resolveOneTwentyOneVisit(
      activeSeatState.remainingInAttempt,
      input,
    );

    const round = this.openRound();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      participantRef: before.activeParticipantRef,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    if (after.visitsThisAttempt === 0 && after.status === "IN_PROGRESS") {
      this.stages.push(roundStage(this.stages.length + 1));
    }

    return this.deriveState();
  }

  /**
   * Applies the bust and checkout rules to a visit that just took a dart,
   * and stamps `completedAt` when the visit resolves. A dart in the
   * attempt's 3rd (final) visit also closes the visit immediately once no
   * double-out route can still be reached with the darts left in it — the
   * outcome is already decided at that point (the fail rule below resets
   * `remainingInAttempt` to `currentTarget` regardless of what a further
   * dart would score), so nothing is gained by waiting for a dart that
   * cannot matter. Visits 1 and 2 never take this branch: a dart that
   * cannot finish those still carries its score into the next visit.
   * @returns whether this dart resolved (closed) the visit — the caller
   *   uses this, not merely "the round changed", to decide whether to open
   *   a new round stage, since an already-in-progress round's
   *   `visitsThisAttempt` can coincidentally read 0 before the round's very
   *   first visit has even closed.
   */
  private settleVisit(visit: TurnFact): boolean {
    const before = this.seatBeforeVisit(visit);
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const lastDart = visit.darts.at(-1)!;
    const { remainingAfter, checkedOut, busted } = resolveCheckoutAttempt(
      before.remainingInAttempt,
      thrown,
      lastDart.hitZoneKey === "DOUBLE",
    );

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    visit.totalScore = thrown;
    const resolved =
      checkedOut ||
      visit.darts.length === DARTS_PER_VISIT ||
      finalVisitHasNoFinishLeft(before, remainingAfter, visit.darts.length);
    if (resolved) {
      visit.completedAt = new Date().toISOString();
    }
    return resolved;
  }

  /**
   * Records one dart. The visit closes when it busts, when it checks out on
   * a double, or on the third dart — mirrors
   * `five-oh-one.engine.module.ts`'s `recordDart`, adapted for the round
   * boundary (see class-level doc).
   * @throws when the match has already ended, or the active seat has
   *   already won its own race; the fact log is left untouched.
   */
  private recordDart(observation: DartObservation): OneTwentyOneState {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") {
      throw new Error("Cannot record a visit once the match has ended");
    }
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") {
      throw new Error("Cannot record a visit once the session is complete");
    }

    const resolved = resolveObservation(observation);
    const visit =
      openVisit(this.turns) ?? this.openNewVisit(before.activeParticipantRef);

    appendResolvedDart(visit, observation, resolved);

    const visitResolved = this.settleVisit(visit);

    if (visitResolved) {
      const after = this.deriveState();
      const afterSeat = after.seats.find(
        (seat) => seat.participantRef === activeSeatState.participantRef,
      )!;
      if (
        afterSeat.visitsThisAttempt === 0 &&
        afterSeat.status === "IN_PROGRESS"
      ) {
        this.stages.push(roundStage(this.stages.length + 1));
      }
    }

    return this.deriveState();
  }

  record(input: OneTwentyOneInput): OneTwentyOneState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  /**
   * Pops the last recorded visit or dart, including one replayed from
   * persisted facts. Dispatches on the shape of the last recorded turn — a
   * turn built from a keypad total always has `darts: []`; a turn built
   * from a board dart always holds at least one dart from the moment it
   * exists in the log — mirrors `five-oh-one.engine.module.ts`'s `undo`.
   * @returns true if a dart or a visit was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    return undoStagedTurn(this.turns, this.stages);
  }

  /**
   * Whether the dart under consideration would check out the cap target —
   * the one way a 121 seat can win its own race on a single dart. Match
   * -level and seat-level completion are both checked before evaluating the
   * dart, so a trailing seat's own near-checkout never misreads as still
   * being able to end an already-decided match.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const resolved = resolveObservation(observation);
    const { checkedOut } = resolveCheckoutAttempt(
      activeSeatState.remainingInAttempt,
      resolved.score,
      resolved.zoneKey === "DOUBLE",
    );
    return checkedOut && activeSeatState.currentTarget === CAP_TARGET;
  }

  /**
   * Answers whether recording `input` would win the active seat's own race,
   * without mutating the fact log or the derived state. Only a checkout at
   * the cap target (170) can ever complete a seat's race — and only while
   * the match itself, not merely the active seat, is still `IN_PROGRESS`.
   */
  wouldComplete(input: OneTwentyOneInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (!isPlayableVisitScore(input.scoreAttempted)) return false;
    if (checkoutDartsRejectionFor(activeSeatState, input) !== null)
      return false;

    return applyOneTwentyOneVisit(activeSeatState, input).status === "WON";
  }

  isComplete(): boolean {
    return this.deriveState().status === "WON";
  }

  state(): OneTwentyOneState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: this.stages.map((stage) => ({ ...stage })),
      turns: cloneTurns(this.turns),
    };
  }
}

export const oneTwentyOneEngineFactory: GameEngineFactory<
  Seated<OneTwentyOneSnapshot>,
  OneTwentyOneInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V1",
  stageOwnership: "PER_SEAT",
  create(config: Seated<OneTwentyOneSnapshot>, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior);
  },
};

registerEngineFactory(oneTwentyOneEngineFactory);
